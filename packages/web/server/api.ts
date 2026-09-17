/**
 * 🇨🇳 2026-08-31 by Hermes
 * 简盒后端 API(Hono)—— M1 音频转写 + M2 用户登录 + 额度持久化
 *
 * 本地 Mac 后端(vite dev 用),生产改 FC 函数计算
 *
 * 路由:
 *   GET  /api/health                                 - 健康检查
 *
 *   # 音频转写(M1)
 *   GET  /api/audio/upload-url?filename=xxx         - OSS 临时签名 URL
 *   POST /api/audio/transcribe                       - 提交 ASR 任务
 *   GET  /api/audio/quota?token=xxx                 - 查用户额度(M2)
 *
 *   # 用户登录(M2)
 *   POST /api/auth/send-code                        - 发邮箱验证码(Mock 写 log)
 *   POST /api/auth/verify-code                       - 验证 + 登录(返回 JWT)
 *   GET  /api/auth/github/start                      - 跳 GitHub OAuth
 *   GET  /api/auth/github/callback                   - GitHub 回调
 *   GET  /api/auth/google/start                      - 跳 Google OAuth
 *   GET  /api/auth/google/callback                   - Google 回调
 *   GET  /api/auth/me?token=xxx                      - 查当前用户
 *   POST /api/auth/logout                             - 退出(客户端删 token 即可)
 *
 *   # 一切皆可二维码 R43c(2026-09-02)
 *   GET  /api/qr/upload-url?filename=xxx              - 短链模式上传签名 URL(100MB 上限)
 *   POST /api/qr/commit                                - 提交短链(写 SQLite + 返回短链 id)
 *   GET  /api/qr/:short_id                            - 扫码落地页/下载重定向
 *   POST /api/qr/cleanup                              - cron 调用清理过期(3天)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT, jwtVerify } from 'jose'
import crypto from 'node:crypto'
import { createRequire as _createRequire } from 'node:module'  // 🇨🇳 9-3 R49.8:ESM require
const require_ = _createRequire(import.meta.url)
import { signOssPutUrl, signOssDeleteUrl } from './oss-sts'
import { signOssGetUrl } from './oss-get'
// 🇨🇳 2026-09-03 R49:火山 AI MediaKit — 纯音频人声分离(中转走阿里云 OSS,完全去腾讯化)
import { submitVolcSeparate, waitForVolcJob, VOLC_CONFIG } from './volc-mediakit'
import { transcribeByUrl } from './aliyun-asr'
// 🇨🇳 2026-09-11:旧 email.ts 保留(mock fallback),api.ts 已切到 sendEmailCode / sendSmsCode
import { exchangeOAuthCode, buildOAuthAuthorizeUrl } from './oauth'
import { registerFeedbackRoute } from './feedback'
// 🇨🇳 2026-09-04 R52:简盒后台埋点 + 仪表盘(用户自己看数据)
import { registerTrackingRoutes } from './tracking'
// 🇨🇳 2026-09-11:真发验证码 + bcrypt 密码哈希
import { sendEmailCode, sendSmsCode, checkSmsCode, hashPassword, verifyPassword, isValidPhone } from './auth-real'
// 🇨🇳 R55 2026-09-11:注册成功发欢迎邮件
import { sendWelcomeEmail } from './email'
// 🇨🇳 R43c:二维码短链数据层
import { nanoid } from 'nanoid'
import {
  insertShortLink, getShortLink, getTotalUsedBytes, deleteExpired, deleteShortLink,
  QR_MAX_FILE_SIZE, QR_TOTAL_QUOTA, QR_TTL_SHORTLINK_DAYS, QR_TTL_DIRECT_HOURS, QR_LINK_EXPIRY_SEC,
} from './qr-kv'

// 🇨🇳 2026-08-31 M3.9 R34:简单 in-memory rate limit (生产用 Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (entry.count >= max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count++
  return { ok: true }
}
// 5 分钟清理一次过期 entry(避免 Map 内存泄漏)
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k)
  }
}, 5 * 60 * 1000)
import {
  findOrCreateUser,
  getUserById,
  findUserByPhone,
  findUserByEmail,
  updateUserProfile,
  setUserPassword,
  deleteUser,
  createAuthCode,
  consumeAuthCode,
  getUsage,
  consumeQuota,
  checkQuota,
  createOAuthState,
  consumeOAuthState,
  _debugDump,  // 🇨🇳 9-3 R49.8:debug 端点用,避免 ESM require 报错
} from './kv'

// ========== 配置 ==========
function loadConfig() {
  return {
    oss: {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
      bucket: process.env.ALIYUN_OSS_BUCKET || '',
      region: process.env.ALIYUN_OSS_REGION || '',
      endpoint: process.env.ALIYUN_OSS_ENDPOINT || '',
    },
    asr: {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
      appKey: process.env.ALIYUN_ASR_APPKEY || '',
      region: process.env.ALIYUN_ASR_REGION || 'cn-shanghai',
    },
    jwt: {
      // 🇨🇳 R52.19:原 VITE_AUTH_JWT_SECRET 会被 vite 注入前端 bundle 公开,改名 AUTH_JWT_SECRET(非 VITE_ 前缀,不会 inject)
      // 🇨🇳 R52.22:生产环境强校验 AUTH_JWT_SECRET 必须配置,不能用默认弱密码
      //  默认弱密码只是 dev 救命用,生产环境部署时必须设 32+ 字节随机串
      secret: new TextEncoder().encode(
        process.env.AUTH_JWT_SECRET || (
          process.env.NODE_ENV === 'production'
            ? (() => { throw new Error('生产环境必须设置 AUTH_JWT_SECRET 环境变量(>= 32 字节随机)') })() as string
            : 'jianhebox-local-dev-secret-2026-08-31'
        )
      ),
      ttl: '7d',  // 7 天
    },
    serverKey: process.env.VITE_API_SERVER_KEY || process.env.JIANHEBOX_API_KEY || '',  // 🇨🇳 R43c:cron 端点鉴权(兼容两个名字)
  }
}

// ========== Hono app ==========
const app = new Hono()

// 🇨🇳 R52.19:CORS 白名单(替代 echo-origin + credentials:true 的风险配置)
//   - 显式列允许的源,不在白名单则拒绝
//   - 无 origin(同源 / curl / Postman)继续放行
//   - ALLOWED_ORIGINS 环境变量可覆盖,逗号分隔;留空走默认
//   - 生产建议配:ALLOWED_ORIGINS=https://jianhebox.cn,https://jianhebox.com,https://jianhebox.pages.dev
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:18181',           // vite dev 本机
  'http://localhost:5173',            // vite 默认端口
  'http://127.0.0.1:18181',
  'http://127.0.0.1:5173',
  'https://jianhebox.cn',
  'https://jianhebox.com',
  'https://jianhebox.pages.dev',
]
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean)

function isOriginAllowed(origin: string | undefined): boolean {
  // 同源请求 / curl / 服务端调用:origin 为 undefined,放行
  if (!origin) return true
  return ALLOWED_ORIGINS.includes(origin)
}

app.use('*', cors({
  // 🇨🇳 R52.19:从 echo-origin 改成白名单 + 拒绝未授权 origin
  origin: (origin) => (isOriginAllowed(origin) ? origin || ALLOWED_ORIGINS[0] : ''),
  allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ========== 健康检查 ==========
app.get('/api/health', (c) => c.json({
  ok: true,
  service: 'jianhebox-api',
  version: 'M2',
  time: new Date().toISOString(),
  env: {
    oss: !!process.env.ALIYUN_OSS_BUCKET,
    asr: !!process.env.ALIYUN_ASR_APPKEY,
    mock_email: process.env.VITE_AUTH_MOCK_EMAIL !== '0',
    mock_oauth: process.env.VITE_AUTH_MOCK_OAUTH !== '0',
  },
}))

// ============================================================
// 📝 问题反馈路由(每页 footer 触发)
// ============================================================
registerFeedbackRoute(app)

// 🇨🇳 2026-09-04 R52:埋点上报 + 仪表盘(用户原话:"桌面端实时调度,看 PV/工具使用/订阅/付费")
//   - POST /api/track 公开
//   - GET  /api/admin/dashboard 鉴权(JIANHEBOX_ADMIN_KEY header)
//   - GET  /api/admin/dashboard-stream SSE 实时推送
//   - GET  /api/admin/users 鉴权
registerTrackingRoutes(app)

// ============================================================
// 🎯 M2 用户认证路由
// ============================================================

/**
 * 🇨🇳 2026-09-11:发验证码 — 同时支持邮箱 + 手机
 *   - { email } → 邮件验证码(走 SMTP 真发或 mock 兜底)
 *   - { phone } → 短信验证码(走阿里云 Dysmsapi 真发或 mock 兜底)
 *
 * 响应里返回 mode: 'register' | 'login',前端按此切换注册/登录表单。
 */
app.post('/api/auth/send-code', async (c) => {
  // 🇨🇳 2026-09-11 R57:重新支持手机验证码(用阿里云 SendSmsVerifyCode 免费沙箱)
  const { email, phone } = await c.req.json() as { email?: string; phone?: string }
  if (!email && !phone) {
    return c.json({ ok: false, error: '请输入邮箱或手机号' }, 400)
  }

  const target = (email || phone)!
  const channel: 'email' | 'phone' = email ? 'email' : 'phone'

  if (channel === 'phone' && !isValidPhone(target)) {
    return c.json({ ok: false, error: '手机号格式不对' }, 400)
  }
  if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
    return c.json({ ok: false, error: '邮箱格式不对' }, 400)
  }

  // 🇨🇳 2026-08-31 M3.9 R34:rate limit 防轰炸(沿用同一套,key 兼容 email 和 phone)
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
  const ipLimit = rateLimit(`send-code:ip:${ip}`, 10, 60 * 60 * 1000)
  if (!ipLimit.ok) {
    return c.json({ ok: false, error: `请求太频繁,请 ${ipLimit.retryAfter} 秒后再试` }, 429)
  }
  const targetLimit = rateLimit(`send-code:${channel}:${target}`, 5, 60 * 1000)
  if (!targetLimit.ok) {
    return c.json({ ok: false, error: `该${channel === 'email' ? '邮箱' : '手机号'}请求太频繁,请 ${targetLimit.retryAfter} 秒后再试` }, 429)
  }

  // 短信验证码走阿里云 SendSmsVerifyCode(验证码由阿里云生成)
  if (channel === 'phone') {
    const sendResult = await sendSmsCode(target, 5)
    if (!sendResult.ok) {
      return c.json({ ok: false, error: `发送失败:${sendResult.error || '未知错误'}` }, 500)
    }
    const existing = !!findUserByPhone(target)
    return c.json({
      ok: true,
      channel: 'phone',
      mode: existing ? 'login' : 'register',
      purpose: existing ? 'login' : 'register',
      provider: sendResult.provider,
      // 🇨🇳 沙箱期会返回真实验证码(测试用),生产期是 undefined,前端要隐藏
      debugCode: sendResult.code,
      bizId: sendResult.bizId,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })
  }

  // 邮箱验证码:本端生成,存 KV
  const authCode = createAuthCode(target, 600)  // 10 分钟过期
  const sendResult = await sendEmailCode(target, authCode.code, 10)

  if (!sendResult.ok) {
    return c.json({ ok: false, error: `发送失败:${sendResult.error || '未知错误'}` }, 500)
  }

  // 模式:该 target 已有用户 → login,否则 register(用于前端展示不同文案)
  const existing = !!findUserByEmail(target)
  const mode = existing ? 'login' : 'register'
  // 🇨🇳 R55 2026-09-11:新增 purpose 字段(语义化):
  //   - register:邮箱未注册,验证码用于「注册流程」(前端收完码 → 调 verify-code 创建账号 → 再调 /login)
  //   - reset-password:邮箱已注册,验证码用于「忘记密码重置」
  //   - login:邮箱已注册 + 老账号无密码(理论上不会走到这里,留作兼容占位)
  const purpose: 'register' | 'reset-password' | 'login' = existing ? 'reset-password' : 'register'

  return c.json({
    ok: true,
    channel,
    mode,
    purpose,
    provider: sendResult.provider,
    // 🇨🇳 debugCode 只在 mock 模式返回,真发模式返回 undefined(防止日志泄露)
    debugCode: sendResult.provider === 'mock' ? authCode.code : undefined,
    expiresAt: authCode.expires_at,
  })
})

/**
 * 🇨🇳 R55 2026-09-11:验证验证码 — 注册专用
 *   - body: { email?, code, phone? }
 *   - email 路径:邮箱已注册 → 报错「该邮箱已注册,请用邮箱 + 密码登录」(引导走 /login)
 *              邮箱未注册 → 验证码对 → 创建账号(空 password_hash,name 从 email 拿) → 触发欢迎邮件 → 返回 JWT
 *   - phone 路径:调阿里云 CheckSmsVerifyCode → 通过则创建/登录用户 → 返回 JWT
 *   - 不再支持 password(老逻辑已废弃)
 */
app.post('/api/auth/verify-code', async (c) => {
  const { email, phone, code } = await c.req.json() as { email?: string; phone?: string; code?: string }
  if (!email && !phone) {
    return c.json({ ok: false, error: '请输入邮箱或手机号' }, 400)
  }
  if (!code || code.length < 4) {
    return c.json({ ok: false, error: '请填写验证码' }, 400)
  }

  // 短信验证码路径:走阿里云 CheckSmsVerifyCode
  if (phone) {
    if (!isValidPhone(phone)) {
      return c.json({ ok: false, error: '手机号格式不对' }, 400)
    }
    const check = await checkSmsCode(phone, code)
    if (!check.ok) {
      return c.json({ ok: false, error: check.error || '验证码错误' }, 400)
    }
    // 验证通过:查/建用户
    let user = findUserByPhone(phone)
    if (!user) {
      user = findOrCreateUser({
        provider: 'phone',
        provider_id: phone,
        phone,
        name: `用户${phone.slice(-4)}`,
      })
    }
    // 签 JWT
    const cfg = loadConfig()
    const token = await new SignJWT({
      sub: user.user_id,
      provider: user.provider,
      phone: user.phone ?? undefined,
      name: user.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(cfg.jwt.ttl)
      .sign(cfg.jwt.secret)
    return c.json({
      ok: true,
      token,
      user: {
        user_id: user.user_id,
        provider: user.provider,
        phone: user.phone ?? undefined,
        name: user.name,
        avatar_url: user.avatar_url,
      },
    })
  }

  const target = email!.toLowerCase().trim()

  // 🇨🇳 rate limit(同邮箱 10/小时,防爆破)
  const verifyLimit = rateLimit(`verify-code:email:${target}`, 10, 60 * 60 * 1000)
  if (!verifyLimit.ok) {
    return c.json({ ok: false, error: `验证尝试太频繁,请 ${verifyLimit.retryAfter} 秒后再试` }, 429)
  }

  const consume = consumeAuthCode(target, code)
  if (!consume.ok) {
    return c.json({ ok: false, error: consume.reason || '验证码错误' }, 400)
  }

  // 邮箱已注册 → 引导走密码登录(verify-code 现在只走注册路径)
  const existing = findUserByEmail(target)
  if (existing) {
    return c.json({
      ok: false,
      error: '该邮箱已注册,请用邮箱 + 密码登录',
      redirect_to_login: true,
    }, 409)
  }

  // 新邮箱用户:创建账号(密码由前端注册流程下一步设置 / 用户首次登录后引导)
  const user = findOrCreateUser({
    provider: 'email',
    provider_id: target,
    email: target,
    name: target.split('@')[0],
  })

  // 🇨🇳 R55:触发欢迎邮件(异步,失败不影响主流程)
  sendWelcomeEmail(target).catch((e) => {
    console.error('[verify-code] 欢迎邮件发送失败:', e?.message)
  })

  // 签 JWT
  const cfg = loadConfig()
  const token = await new SignJWT({
    sub: user.user_id,
    provider: user.provider,
    email: user.email ?? undefined,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(cfg.jwt.ttl)
    .sign(cfg.jwt.secret)

  return c.json({
    ok: true,
    token,
    user: {
      user_id: user.user_id,
      provider: user.provider,
      email: user.email ?? undefined,
      name: user.name,
      avatar_url: user.avatar_url,
    },
  })
})

/**
 * 🇨🇳 R55 2026-09-11:邮箱 + 密码登录(主路径)
 *   body: { email, password }
 *   - 邮箱未注册 → 报错「该邮箱未注册,请先注册」
 *   - 老账号无 password_hash(纯验证码遗留) → 报错「未设密码,请走忘记密码流程」
 *   - 密码错 → 报错(限流:同邮箱 5 次/分钟,5 次错锁 10 分钟)
 *   - 签发 JWT(7 天)
 */
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json() as { email?: string; password?: string }
  if (!email || !password) {
    return c.json({ ok: false, error: '请输入邮箱和密码' }, 400)
  }
  const target = email.toLowerCase().trim()

  // 限流:同邮箱 5 次/分钟
  const loginLimit = rateLimit(`login:email:${target}`, 5, 60 * 1000)
  if (!loginLimit.ok) {
    return c.json({ ok: false, error: `尝试太频繁,请 ${loginLimit.retryAfter} 秒后再试` }, 429)
  }

  const user = findUserByEmail(target)
  if (!user) {
    return c.json({ ok: false, error: '该邮箱未注册,请先注册' }, 404)
  }
  if (!user.password_hash) {
    return c.json({
      ok: false,
      error: '未设密码,请走忘记密码流程',
      needResetPassword: true,
    }, 400)
  }
  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) {
    // 🇨🇳 R55:5 次错锁 10 分钟(独立 key)
    const failLock = rateLimit(`login-fail:email:${target}`, 5, 10 * 60 * 1000)
    if (!failLock.ok) {
      return c.json({
        ok: false,
        error: `密码错误次数过多,请 ${failLock.retryAfter} 秒后再试或重置密码`,
      }, 429)
    }
    return c.json({ ok: false, error: '邮箱或密码错误' }, 401)
  }

  const cfg = loadConfig()
  const token = await new SignJWT({
    sub: user.user_id,
    provider: user.provider,
    email: user.email ?? undefined,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(cfg.jwt.ttl)
    .sign(cfg.jwt.secret)

  return c.json({
    ok: true,
    token,
    user: {
      user_id: user.user_id,
      provider: user.provider,
      email: user.email ?? undefined,
      name: user.name,
      avatar_url: user.avatar_url,
    },
  })
})

/**
 * 🇨🇳 R55 2026-09-11:忘记密码重置(走邮箱验证码)
 *   body: { email, code, new_password }
 *   - 邮箱未注册 → 报错
 *   - 验证码错 → 报错
 *   - new_password < 6 位 → 报错
 *   - 成功 → setUserPassword(user_id, new_password, { require_code_consumed: true }) → 返回 ok
 */
app.post('/api/auth/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({} as any)) as { email?: string; code?: string; new_password?: string }
  const email = (body.email || '').trim().toLowerCase()
  const code = (body.code || '').trim()
  const newPwd = body.new_password || ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ ok: false, error: '邮箱格式不对' }, 400)
  }
  if (!code || code.length < 4) {
    return c.json({ ok: false, error: '请填写验证码' }, 400)
  }
  if (newPwd.length < 6) {
    return c.json({ ok: false, error: '新密码至少 6 位' }, 400)
  }

  // 限流(同 send-code:5/分钟)
  const resetLimit = rateLimit(`reset-password:email:${email}`, 5, 60 * 1000)
  if (!resetLimit.ok) {
    return c.json({ ok: false, error: `请求太频繁,请 ${resetLimit.retryAfter} 秒后再试` }, 429)
  }

  const consume = consumeAuthCode(email, code)
  if (!consume.ok) return c.json({ ok: false, error: consume.reason || '验证码错误' }, 400)

  const user = findUserByEmail(email)
  if (!user) {
    return c.json({ ok: false, error: '该邮箱未注册' }, 404)
  }
  const result = await setUserPassword(user.user_id, newPwd, { require_code_consumed: true })
  if (!result.ok) return c.json({ ok: false, error: result.error }, 400)
  return c.json({ ok: true })
})

/** GitHub OAuth 启动 */
app.get('/api/auth/github/start', (c) => {
  const state = createOAuthState('github', c.req.query('redirect') || '/')
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/github/callback`
  const url = buildOAuthAuthorizeUrl('github', state, redirectUri)
  return c.redirect(url)
})

/** GitHub OAuth 回调 */
app.get('/api/auth/github/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')

  if (!code || !state) {
    return c.json({ ok: false, error: '缺少 code 或 state' }, 400)
  }

  const consumed = consumeOAuthState(state)
  if (!consumed.ok) {
    return c.json({ ok: false, error: consumed.reason }, 400)
  }

  const oauthResult = await exchangeOAuthCode('github', code)
  if (!oauthResult.ok || !oauthResult.user) {
    return c.json({ ok: false, error: oauthResult.error }, 500)
  }

  const user = findOrCreateUser({
    provider: 'github',
    provider_id: oauthResult.user.provider_id,
    email: oauthResult.user.email,
    name: oauthResult.user.name,
    avatar_url: oauthResult.user.avatar_url,
  })

  const cfg = loadConfig()
  const token = await new SignJWT({ sub: user.user_id, provider: user.provider })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(cfg.jwt.ttl)
    .sign(cfg.jwt.secret)

  // 用 HTML + form post 把 token 传给前端,再跳走
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>登录中...</title></head>
<body><script>
localStorage.setItem('jianhebox_auth_token', '${token}');
localStorage.setItem('jianhebox_auth_user', ${JSON.stringify(JSON.stringify({
    user_id: user.user_id,
    provider: user.provider,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
  }))});
window.location.href = '${consumed.redirect_after || '/'}';
</script></body></html>`
  return c.html(html)
})

/** Google OAuth 启动 */
app.get('/api/auth/google/start', (c) => {
  const state = createOAuthState('google', c.req.query('redirect') || '/')
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/google/callback`
  const url = buildOAuthAuthorizeUrl('google', state, redirectUri)
  return c.redirect(url)
})

/** Google OAuth 回调 */
app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')

  if (!code || !state) {
    return c.json({ ok: false, error: '缺少 code 或 state' }, 400)
  }

  const consumed = consumeOAuthState(state)
  if (!consumed.ok) {
    return c.json({ ok: false, error: consumed.reason }, 400)
  }

  const oauthResult = await exchangeOAuthCode('google', code)
  if (!oauthResult.ok || !oauthResult.user) {
    return c.json({ ok: false, error: oauthResult.error }, 500)
  }

  const user = findOrCreateUser({
    provider: 'google',
    provider_id: oauthResult.user.provider_id,
    email: oauthResult.user.email,
    name: oauthResult.user.name,
    avatar_url: oauthResult.user.avatar_url,
  })

  const cfg = loadConfig()
  const token = await new SignJWT({ sub: user.user_id, provider: user.provider })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(cfg.jwt.ttl)
    .sign(cfg.jwt.secret)

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>登录中...</title></head>
<body><script>
localStorage.setItem('jianhebox_auth_token', '${token}');
localStorage.setItem('jianhebox_auth_user', ${JSON.stringify(JSON.stringify({
    user_id: user.user_id,
    provider: user.provider,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
  }))});
window.location.href = '${consumed.redirect_after || '/'}';
</script></body></html>`
  return c.html(html)
})

/** 查当前登录用户(JWT 鉴权)
 * 🇨🇳 2026-09-11 R53.2:扩展字段(套餐 / 已验证 / 注册时间 / 是否有密码) */
app.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/, '') || c.req.query('token')
  if (!token) return c.json({ ok: false, error: '未登录' }, 401)

  try {
    const cfg = loadConfig()
    const { payload } = await jwtVerify(token, cfg.jwt.secret)
    const user = getUserById(payload.sub as string)
    if (!user) return c.json({ ok: false, error: '用户不存在' }, 404)

    const usage = getUsage(user.user_id)
    // 🇨🇳 R57:套餐从 user.plan 直接拿(不是从 monthly_limit_sec 推算)
    let plan: 'free' | 'plus' | 'pro' | 'studio' = (user.plan as any) || 'free'

    return c.json({
      ok: true,
      user: {
        user_id: user.user_id,
        provider: user.provider,
        email: user.email,
        phone: user.phone,
        name: user.name,
        avatar_url: user.avatar_url,
        has_password: !!user.password_hash,
        email_verified: !!user.email,  // MVP:邮箱存在即视为已验证(走验证码)
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        plan,
        plan_minutes: user.plan_minutes || 0,
        topup_balance_min: user.topup_balance_min || 0,
        quota: {
          monthly_used_sec: usage.monthly_used_sec,
          monthly_limit_sec: usage.monthly_limit_sec,
          remaining_sec: Math.max(0, usage.monthly_limit_sec - usage.monthly_used_sec),
          last_reset_date: usage.last_reset_date,
        },
      },
    })
  } catch (e: any) {
    return c.json({ ok: false, error: 'token 无效或过期' }, 401)
  }
})

/**
 * 🇨🇳 2026-09-11 R53.2:更新资料(昵称 / 头像)
 *  body: { name?: string, avatar_url?: string }
 *  → 200 + 更新后的 user
 */
app.post('/api/auth/update-profile', async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/, '') || c.req.query('token')
  if (!token) return c.json({ ok: false, error: '未登录' }, 401)
  let user_id: string
  try {
    const cfg = loadConfig()
    const { payload } = await jwtVerify(token, cfg.jwt.secret)
    user_id = payload.sub as string
  } catch {
    return c.json({ ok: false, error: 'token 无效' }, 401)
  }
  const body = await c.req.json().catch(() => ({} as any)) as { name?: string; avatar_url?: string }
  const user = updateUserProfile(user_id, { name: body.name, avatar_url: body.avatar_url })
  if (!user) return c.json({ ok: false, error: '用户不存在' }, 404)
  return c.json({
    ok: true,
    user: {
      user_id: user.user_id,
      provider: user.provider,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatar_url: user.avatar_url,
    },
  })
})

/**
 * 🇨🇳 2026-09-11 R53.2:修改密码(已登录)
 *  body: { current_password?: string, new_password: string }
 *  - 设过密码:current_password 必填
 *  - 没设过密码(早期纯验证码登录遗留):允许不传 current_password 直接设
 */
app.post('/api/auth/change-password', async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/, '') || c.req.query('token')
  if (!token) return c.json({ ok: false, error: '未登录' }, 401)
  let user_id: string
  try {
    const cfg = loadConfig()
    const { payload } = await jwtVerify(token, cfg.jwt.secret)
    user_id = payload.sub as string
  } catch {
    return c.json({ ok: false, error: 'token 无效' }, 401)
  }
  const body = await c.req.json().catch(() => ({} as any)) as { current_password?: string; new_password?: string }
  const newPwd = body.new_password || ''
  if (newPwd.length < 6) {
    return c.json({ ok: false, error: '新密码至少 6 位' }, 400)
  }
  const result = await setUserPassword(user_id, newPwd, { current_password: body.current_password })
  if (!result.ok) return c.json({ ok: false, error: result.error }, 400)
  return c.json({ ok: true })
})

/**
 * 🇨🇳 2026-09-11 R53.2:忘记密码(未登录 → 邮箱验证码重置)
 *  body: { email, code, new_password }
 *  - 不鉴权(重置密码本身就是重新验证邮箱)
 *  - 必须走 send-code 拿到 code 才能调这个
 */
app.post('/api/auth/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({} as any)) as { email?: string; code?: string; new_password?: string }
  const email = (body.email || '').trim().toLowerCase()
  const code = (body.code || '').trim()
  const newPwd = body.new_password || ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ ok: false, error: '邮箱格式不对' }, 400)
  }
  if (!code || code.length < 4) {
    return c.json({ ok: false, error: '请填写验证码' }, 400)
  }
  if (newPwd.length < 6) {
    return c.json({ ok: false, error: '新密码至少 6 位' }, 400)
  }
  const consume = consumeAuthCode(email, code)
  if (!consume.ok) return c.json({ ok: false, error: consume.reason || '验证码错误' }, 400)

  const user = findUserByEmail(email)
  if (!user) {
    return c.json({ ok: false, error: '该邮箱未注册' }, 404)
  }
  const result = await setUserPassword(user.user_id, newPwd, { require_code_consumed: true })
  if (!result.ok) return c.json({ ok: false, error: result.error }, 400)
  return c.json({ ok: true })
})

/**
 * 🇨🇳 2026-09-11 R53.2:注销账号
 *  body: { confirm_email: string }
 *  - 必须确认输入注册邮箱,防止误删
 */
app.post('/api/auth/delete-account', async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/, '') || c.req.query('token')
  if (!token) return c.json({ ok: false, error: '未登录' }, 401)
  let user_id: string
  try {
    const cfg = loadConfig()
    const { payload } = await jwtVerify(token, cfg.jwt.secret)
    user_id = payload.sub as string
  } catch {
    return c.json({ ok: false, error: 'token 无效' }, 401)
  }
  const body = await c.req.json().catch(() => ({} as any)) as { confirm_email?: string; confirm_phone?: string }
  const user = getUserById(user_id)
  if (!user) return c.json({ ok: false, error: '用户不存在' }, 404)
  // 🇨🇳 R57:支持邮箱或手机号二次确认
  const target = body.confirm_email || body.confirm_phone
  if (!target) {
    return c.json({ ok: false, error: '请输入您的邮箱或手机号以确认注销' }, 400)
  }
  const expected = (user.email || user.phone || '').toLowerCase()
  if (target.trim().toLowerCase() !== expected) {
    return c.json({ ok: false, error: '输入的邮箱或手机号与账号不匹配' }, 400)
  }
  deleteUser(user_id)
  return c.json({ ok: true })
})

// ============================================================
// 🎵 M1 音频转写路由
// ============================================================

/** 拿 OSS 上传签名 URL(需要登录) */
app.get('/api/audio/upload-url', async (c) => {
  // 🇨🇳 M2:鉴权(必需)
  const token = c.req.query('token') || c.req.header('Authorization')?.replace(/^Bearer\s+/, '')
  if (!token) {
    return c.json({ ok: false, error: '需要登录' }, 401)
  }
  let user_id: string
  try {
    const cfg = loadConfig()
    const { payload } = await jwtVerify(token, cfg.jwt.secret)
    user_id = payload.sub as string
  } catch {
    return c.json({ ok: false, error: 'token 无效' }, 401)
  }

  // 🇨🇳 R52.23:上传 URL 限流(防止恶意签发签名 URL 撑爆阿里云 API)
  //  每用户每分钟最多 10 次(上传签名 URL 实际消耗小,放宽容忍)
  const uploadLimit = rateLimit(`upload-url:user:${user_id}`, 10, 60 * 1000)
  if (!uploadLimit.ok) {
    return c.json({ ok: false, error: `上传请求太频繁,请 ${uploadLimit.retryAfter} 秒后再试` }, 429)
  }

  const ossCfg = loadConfig().oss
  if (!ossCfg.accessKeyId || !ossCfg.bucket) {
    return c.json({ error: 'OSS 凭证未配置' }, 500)
  }

  const filename = c.req.query('filename') || `audio-${Date.now()}.mp3`
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
  const objectKey = `audio/${today}/${Date.now()}-${safeFilename}`

  const signed = signOssPutUrl(ossCfg, objectKey, 300, {
    contentType: 'application/octet-stream',
  })

  const getSignedUrl = signOssGetUrl(
    ossCfg.accessKeyId,
    ossCfg.accessKeySecret,
    ossCfg.bucket,
    ossCfg.endpoint,
    signed.objectKey,
    { expiresSec: 600 },
  )

  return c.json({
    ok: true,
    uploadUrl: signed.uploadUrl,
    objectKey: signed.objectKey,
    bucket: ossCfg.bucket,
    region: ossCfg.region,
    endpoint: ossCfg.endpoint,
    publicUrl: `https://${ossCfg.bucket}.${ossCfg.endpoint}/${signed.objectKey}`,
    verifyUrl: getSignedUrl,
    expiresAt: signed.expiresAt,
  })
})

/** 提交 ASR 转写(需要登录 + 额度检查) */
app.post('/api/audio/transcribe', async (c) => {
  // 🇨🇳 M2:鉴权
  const token = c.req.query('token') || c.req.header('Authorization')?.replace(/^Bearer\s+/, '')
  if (!token) {
    return c.json({ ok: false, error: '需要登录' }, 401)
  }

  let user_id: string
  try {
    const cfg = loadConfig()
    const { payload } = await jwtVerify(token, cfg.jwt.secret)
    user_id = payload.sub as string
  } catch {
    return c.json({ ok: false, error: 'token 无效' }, 401)
  }

  // 🇨🇳 R52.23:ASR 转写限流(防止恶意刷转写刷钱)
  //  每用户每分钟最多 3 次(3 次 ≈ 用户正常试 3 个不同方言/语种)
  //  5 分钟内 10 次封顶(防止分桶打)
  const transcribeLimit = rateLimit(`transcribe:user:${user_id}`, 3, 60 * 1000)
  if (!transcribeLimit.ok) {
    return c.json({ ok: false, error: `转写请求太频繁,请 ${transcribeLimit.retryAfter} 秒后再试` }, 429)
  }

  const cfg = loadConfig()
  const body = await c.req.json() as {
    objectKey: string
    format?: string
    durationSec?: number  // 🇨🇳 前端预估音频时长,用于额度预扣
  }

  if (!body.objectKey) {
    return c.json({ ok: false, error: 'objectKey 不能为空' }, 400)
  }

  // 额度预检查(用前端预估时长,失败时返还)
  const estimatedSec = body.durationSec || 0
  if (estimatedSec > 0) {
    const quota = checkQuota(user_id, estimatedSec)
    if (!quota.ok) {
      return c.json({
        ok: false,
        error: quota.reason,
        quota: getUsage(user_id),
      }, 402)  // 402 Payment Required
    }
  }

  const audioUrl = `https://${cfg.oss.bucket}.${cfg.oss.endpoint}/${body.objectKey}`
  const format = body.format || 'mp3'

  console.log('[AudioTool] ASR 提交任务 user=', user_id, 'audioUrl=', audioUrl, 'format=', format)

  try {
    const result = await transcribeByUrl(cfg.asr, audioUrl, format)

    // 🇨🇳 M2:用阿里云返回的真实时长扣额度(如果返回)
    const actualSec = (result as any).durationSec || estimatedSec
    if (actualSec > 0) {
      consumeQuota(user_id, actualSec)
    }

    return c.json({
      ok: true,
      text: result.result || '',
      sentences: result.sentences || [],
      status: result.status,
      durationSec: actualSec,
      quota: getUsage(user_id),
    })
  } catch (err: any) {
    console.error('[AudioTool] ASR 失败:', err.message)
    return c.json({
      ok: false,
      error: err.message || 'ASR 调用失败',
    }, 500)
  }
})

/**
 * 🇨🇳 9-3 R49.7:流式转写进度端点(SSE)
 * GET /api/audio/transcribe-stream?objectKey=&format=
 *
 * 流式返回:
 *  - event: progress  data: {stage, taskId, elapsedMs}
 *  - event: complete data: {text, sentences, durationSec, quota}
 *  - event: error    data: {error}
 *
 * 前端用 EventSource / fetch + ReadableStream 接收,实时显示"提交中 → 转写中 → 完成"
 */
app.get('/api/audio/transcribe-stream', async (c) => {
  // 鉴权
  const token = c.req.query('token') || c.req.header('Authorization')?.replace(/^Bearer\s+/, '')
  if (!token) {
    return c.json({ ok: false, error: '需要登录' }, 401)
  }
  let user_id: string
  try {
    const cfg = loadConfig()
    const { payload } = await jwtVerify(token, cfg.jwt.secret)
    user_id = payload.sub as string
  } catch {
    return c.json({ ok: false, error: 'token 无效' }, 401)
  }

  const objectKey = c.req.query('objectKey')
  const format = c.req.query('format') || 'mp3'
  if (!objectKey) {
    return c.json({ ok: false, error: 'objectKey 不能为空' }, 400)
  }

  const cfg = loadConfig()
  const audioUrl = `https://${cfg.oss.bucket}.${cfg.oss.endpoint}/${objectKey}`

  // SSE 响应头
  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')
  c.header('X-Accel-Buffering', 'no')

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        try {
          controller.enqueue(new TextEncoder().encode(payload))
        } catch (e) {
          // controller 已关闭(浏览器断开)
        }
      }

      const startTime = Date.now()
      try {
        const result = await transcribeByUrl(cfg.asr, audioUrl, format, (stage, taskId) => {
          // 🇨🇳 每次 poll 都推一个 progress 事件
          send('progress', {
            stage,
            taskId,
            elapsedMs: Date.now() - startTime,
          })
        })

        // 扣减额度
        const durationSec = (result as any).durationSec || 0
        if (durationSec > 0) {
          consumeQuota(user_id, durationSec)
        }

        send('complete', {
          ok: true,
          text: result.result || '',
          sentences: result.sentences || [],
          status: result.status,
          durationSec,
          quota: getUsage(user_id),
        })
      } catch (err: any) {
        send('error', { error: err.message || 'ASR 失败' })
      } finally {
        controller.close()
      }
    },
  })

  return c.body(stream, 200)
})

/** 查用户额度(需要登录) */
app.get('/api/audio/quota', async (c) => {
  const token = c.req.query('token') || c.req.header('Authorization')?.replace(/^Bearer\s+/, '')
  if (!token) {
    return c.json({ ok: false, error: '需要登录' }, 401)
  }

  let user_id: string
  try {
    const cfg = loadConfig()
    const { payload } = await jwtVerify(token, cfg.jwt.secret)
    user_id = payload.sub as string
  } catch {
    return c.json({ ok: false, error: 'token 无效' }, 401)
  }

  return c.json({
    ok: true,
    quota: getUsage(user_id),
  })
})

// ============================================================
// 🇨🇳 R49:人声分离中转已切到阿里云 OSS(浏览器直传),不再用腾讯云
// 这里定义 vocal-upload + vocal-separate-volc,确保在 export default 之前注册
// ============================================================

/**
 * POST /api/audio/vocal-upload
 * body: { filename: string, mimeType?: string, size?: number }
 *  → 签发阿里云 OSS PUT 签名 URL(浏览器直接上传,不走 server 中转)
 *  → 返回 { uploadUrl, objectKey, publicUrl, expiresAt, maxSize }
 */
app.post('/api/audio/vocal-upload', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({} as any))
    const filename = (body.filename || '').trim() || `audio-${Date.now()}.mp3`
    const mimeType = body.mimeType || guessMimeFromExt(filename)
    const size = Number(body.size) || 0

    // 限制:人声分离文件不超过 200MB(火山 MediaKit separate-voice 单文件上限)
    const MAX_SIZE = 200 * 1024 * 1024
    if (size > MAX_SIZE) {
      return c.json({ ok: false, error: `文件超过 ${MAX_SIZE / 1024 / 1024}MB 上限` }, 400)
    }

    // 文件 key 加日期前缀 + uuid 防止覆盖
    const uuid = crypto.randomUUID().slice(0, 8)
    const today = new Date().toISOString().slice(0, 10)
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `voice-input/${today}/${uuid}-${safeFilename}`

    // 签阿里云 OSS PUT URL(5 分钟有效,够浏览器上传)
    const cfg = ossCfg()  // 复用 api.ts 里已有的 oss 配置块,见下面
    if (!cfg.accessKeyId) {
      return c.json({ ok: false, error: '阿里云 OSS 未配置' }, 500)
    }
    const signed = signOssPutUrl(cfg, objectKey, 300, { contentType: mimeType })

    // 给火山引擎用的 publicUrl(也签 4h,等 vocal-separate-volc 调用时再签一次最新 4h URL)
    const publicUrlBase = `https://${cfg.bucket}.${cfg.endpoint}/${objectKey}`

    return c.json({
      ok: true,
      uploadUrl: signed.uploadUrl,
      objectKey,
      publicUrl: publicUrlBase,  // 火山引擎 GET 时由 server 重新签 4h URL
      mimeType,
      expiresAt: signed.expiresAt,
      maxSize: MAX_SIZE,
    })
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || '签 URL 失败' }, 500)
  }
})

/** 简易 oss 配置封装(读 process.env) */
function ossCfg() {
  return {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    bucket: process.env.ALIYUN_OSS_BUCKET || '',
    region: process.env.ALIYUN_OSS_REGION || '',
    endpoint: process.env.ALIYUN_OSS_ENDPOINT || '',
  }
}

/** 从扩展名猜 mime */
function guessMimeFromExt(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const m: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
    mp4: 'video/mp4', mov: 'video/quicktime', ogg: 'audio/ogg',
    flac: 'audio/flac', aac: 'audio/aac',
  }
  return m[ext] || 'application/octet-stream'
}

/**
 * POST /api/audio/vocal-separate-volc
 *  body: { objectKey, outputFormat? }
 *  → 用 objectKey 生成 4h 签名 GET URL
 *  → 调用火山 AI MediaKit separate-voice
 *  → 轮询直到完成
 *  → 返回 vocals + background 临时 URL(24h 有效)
 */
app.post('/api/audio/vocal-separate-volc', async (c) => {
  if (!VOLC_CONFIG.Enabled) {
    return c.json({ ok: false, error: '火山引擎未配置(VOLC_MEDIAKIT_API_KEY)' }, 500)
  }

  // 🇨🇳 R52.23:人声分离限流(火山引擎 API 按调用收费)
  //  同一 IP 每分钟最多 2 次(人声分离是 30 秒以上的活,1 分钟内不会正经用 3 次)
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
  const vocalLimit = rateLimit(`vocal:ip:${ip}`, 2, 60 * 1000)
  if (!vocalLimit.ok) {
    return c.json({ ok: false, error: `人声分离请求太频繁,请 ${vocalLimit.retryAfter} 秒后再试` }, 429)
  }

  const body = await c.req.json().catch(() => ({}))
  const { objectKey, publicUrl, outputFormat = 'mp3' } = body

  if (!objectKey && !publicUrl) {
    return c.json({ ok: false, error: '需要 objectKey 或 publicUrl' }, 400)
  }

  try {
    // 如果前端传了 objectKey,server 用它生成最新 4h 签名 URL
    let audioUrl: string = publicUrl || ''
    if (objectKey && typeof objectKey === 'string') {
      const cfg = ossCfg()
      if (!cfg.accessKeyId || !cfg.bucket) {
        return c.json({ ok: false, error: '阿里云 OSS 未配置,无法生成签名 URL' }, 500)
      }
      // 4h 签名 URL(火山上 4h 内必须拉完)
      audioUrl = signOssGetUrl(cfg.accessKeyId, cfg.accessKeySecret, cfg.bucket, cfg.endpoint, objectKey, { expiresSec: 14400 })
      console.log(`[vocal-separate-volc] 用 objectKey 签 4h URL: ${objectKey}`)
    }

    const { taskId } = await submitVolcSeparate({ audioUrl, outputFormat })
    const job = await waitForVolcJob(taskId)

    const urls = {
      vocals: job.result?.voice_audio_url || null,
      accompaniment: job.result?.background_audio_url || null,
    }
    return c.json({
      ok: true,
      taskId,
      urls,
      duration: job.result?.duration || 0,
      engine: 'volc-mediakit',
    })
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || '火山人声分离失败' }, 500)
  }
})

// ============================================================
// 🛠 调试端点(9-3 R49.8:加 ServerKey 鉴权,防生产泄露用户数据)
//   启用条件: NODE_ENV !== 'production' OR 传正确 ServerKey
// ============================================================

/** 调试鉴权:显式开启 + 正确 ServerKey
 * 🇨🇳 9-3 R49.8:默认不开放,需要:
 *   1. JIANHEBOX_ALLOW_DEBUG=1 启用调试端点
 *   2. ServerKey 鉴权(JIANHEBOX_DEBUG_KEY)
 */
function isDebugAllowed(c: any): boolean {
  if (process.env.JIANHEBOX_ALLOW_DEBUG !== '1') return false
  const provided = c.req.header('x-api-key') || c.req.query('key') || ''
  const expected = process.env.JIANHEBOX_DEBUG_KEY || process.env.VITE_API_SERVER_KEY || ''
  return !!expected && provided === expected
}

/** 调试:看 KV 全部数据 */
app.get('/api/debug/kv', (c) => {
  if (!isDebugAllowed(c)) {
    return c.json({ ok: false, error: '需要 ServerKey 鉴权' }, 401)
  }
  const debug = _debugDump()
  return c.json({ ok: true, ...debug })
})

/** 调试:看邮件 log */
app.get('/api/debug/emails', (c) => {
  if (!isDebugAllowed(c)) {
    return c.json({ ok: false, error: '需要 ServerKey 鉴权' }, 401)
  }
  // 🇨🇳 9-3 R49.8:改用 ESM import,避免 require 不工作
  const fs = require_('node:fs')
  const nodePath = require_('node:path')
  const nodeOs = require_('node:os')
  const logPath = nodePath.join(nodeOs.tmpdir(), 'jianhebox_emails.log')
  try {
    const content = fs.readFileSync(logPath, 'utf-8')
    return c.json({ ok: true, log: content })
  } catch {
    return c.json({ ok: true, log: '(no emails yet)' })
  }
})

// ============================================================
// 🇨🇳 2026-09-02 M3.9 R43c:一切皆可二维码(短链模式)
// ============================================================

// 🇨🇳 简单 IP rate limit:同一 IP 1 分钟最多 5 次 upload-url
function qrRateLimit(ip: string): { ok: boolean } {
  return rateLimit(`qr-upload-${ip}`, 5, 60_000) as any
}

/** GET /api/qr/upload-url?filename=&size=&mime=
 *  返回 OSS PutObject 签名 URL(5 分钟过期),前端用它直接上传
 *  检查:单文件 <= 100MB,总配额 <= 10GB
 */
app.get('/api/qr/upload-url', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!qrRateLimit(ip).ok) {
    return c.json({ ok: false, error: '请求过于频繁,请稍后再试' }, 429)
  }
  const ossCfg = loadConfig().oss
  if (!ossCfg.accessKeyId || !ossCfg.bucket) {
    return c.json({ ok: false, error: 'OSS 凭证未配置' }, 500)
  }

  const filename = c.req.query('filename') || `qr-${Date.now()}.bin`
  const size = parseInt(c.req.query('size') || '0', 10)
  const mime = c.req.query('mime') || 'application/octet-stream'

  // 1) 单文件大小限制
  if (size > QR_MAX_FILE_SIZE) {
    return c.json({
      ok: false,
      error: `文件过大: ${(size / 1024 / 1024).toFixed(1)} MB,单文件上限 ${QR_MAX_FILE_SIZE / 1024 / 1024} MB`,
      limit: QR_MAX_FILE_SIZE,
    }, 413)
  }
  // 2) 总配额
  const used = getTotalUsedBytes()
  if (used + size > QR_TOTAL_QUOTA) {
    return c.json({
      ok: false,
      error: `存储配额不足:已用 ${(used / 1024 / 1024 / 1024).toFixed(2)} GB,本次 ${(size / 1024 / 1024 / 1024).toFixed(2)} GB,上限 ${QR_TOTAL_QUOTA / 1024 / 1024 / 1024} GB`,
      used, limit: QR_TOTAL_QUOTA,
    }, 413)
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
  const objectKey = `qr/${today}/${Date.now()}-${nanoid(6)}-${safeFilename}`

  const signed = signOssPutUrl(ossCfg, objectKey, 300, { contentType: mime })

  return c.json({
    ok: true,
    uploadUrl: signed.uploadUrl,
    objectKey: signed.objectKey,
    bucket: ossCfg.bucket,
    region: ossCfg.region,
    endpoint: ossCfg.endpoint,
    publicUrl: `https://${ossCfg.bucket}.${ossCfg.endpoint}/${signed.objectKey}`,
    expiresAt: signed.expiresAt,
    limits: {
      maxFileSize: QR_MAX_FILE_SIZE,
      totalQuota: QR_TOTAL_QUOTA,
      directLinkMinutes: Math.floor(QR_LINK_EXPIRY_SEC / 60),
      directFileHours: QR_TTL_DIRECT_HOURS,
      shortlinkDays: QR_TTL_SHORTLINK_DAYS,
    },
  })
})

/** POST /api/qr/commit
 *  body: { objectKey, filename, mime, size }
 *  写 SQLite + 返回 short_id
 */
app.post('/api/qr/commit', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!qrRateLimit(ip).ok) {
    return c.json({ ok: false, error: '请求过于频繁' }, 429)
  }
  const body = await c.req.json().catch(() => null) as any
  if (!body || !body.objectKey || !body.filename || !body.mime || !body.size) {
    return c.json({ ok: false, error: '参数缺失' }, 400)
  }
  if (body.size > QR_MAX_FILE_SIZE) {
    return c.json({ ok: false, error: '文件过大' }, 413)
  }

  const shortId = nanoid(8)
  const expiresAt = Date.now() + QR_TTL_SHORTLINK_DAYS * 24 * 60 * 60 * 1000
  insertShortLink({
    short_id: shortId,
    mode: 'shortlink',
    object_key: body.objectKey,
    filename: body.filename,
    mime: body.mime,
    size: body.size,
    expires_at: expiresAt,
  })

  return c.json({
    ok: true,
    shortId,
    shortUrl: `/q/${shortId}`,
    fullUrl: `https://jianhebox.cn/q/${shortId}`,
    expiresAt,
    expiresInDays: QR_TTL_SHORTLINK_DAYS,
  })
})

/** GET /api/qr/limits — 返回所有规则限制,前端 UI 展示 */
app.get('/api/qr/limits', (c) => {
  return c.json({
    ok: true,
    limits: {
      maxFileSize: QR_MAX_FILE_SIZE,
      totalQuota: QR_TOTAL_QUOTA,
      directLinkMinutes: Math.floor(QR_LINK_EXPIRY_SEC / 60),
      directFileHours: QR_TTL_DIRECT_HOURS,
      shortlinkDays: QR_TTL_SHORTLINK_DAYS,
    },
  })
})

/** GET /api/qr/direct-link?key=xxx
 *  拿一个 OSS 签名 GET URL(10 分钟有效),前端把 URL 塞进二维码
 *  客户扫码 → 浏览器打开 → 自动下载
 *  path 用 "direct-link" 而非 "direct",避免被 /api/qr/:shortId 抢匹配
 */
app.get('/api/qr/direct-link', async (c) => {
  const ossCfg = loadConfig().oss
  if (!ossCfg.accessKeyId) {
    return c.json({ ok: false, error: 'OSS 凭证未配置' }, 500)
  }
  // objectKey 通过 query string 传,避免路径 segment 问题
  const objectKey = c.req.query('key') || ''
  if (!objectKey || objectKey.includes('..')) {
    return c.json({ ok: false, error: '非法的 objectKey' }, 400)
  }

  // 🇨🇳 写入 SQLite(cron 24h 后会清理)
  const shortId = 'dir-' + nanoid(8)
  const fileExpiresAt = Date.now() + QR_TTL_DIRECT_HOURS * 60 * 60 * 1000
  try {
    // 从 OSS head 拿文件名 + size
    const headUrl = signOssGetUrl(
      ossCfg.accessKeyId, ossCfg.accessKeySecret,
      ossCfg.bucket, ossCfg.endpoint,
      objectKey, { expiresSec: 60 },
    )
    const headResp = await fetch(headUrl, { method: 'HEAD' })
    const contentType = headResp.headers.get('content-type') || 'application/octet-stream'
    const contentLength = parseInt(headResp.headers.get('content-length') || '0', 10)
    // 从 key 取文件名(最后一段)
    const filename = decodeURIComponent(objectKey.split('/').pop() || 'file.bin')

    insertShortLink({
      short_id: shortId,
      mode: 'direct',
      object_key: objectKey,
      filename,
      mime: contentType,
      size: contentLength || 0,
      expires_at: fileExpiresAt,
    })
  } catch (e) {
    // OSS head 失败也允许,只标记 direct
    insertShortLink({
      short_id: shortId,
      mode: 'direct',
      object_key: objectKey,
      filename: decodeURIComponent(objectKey.split('/').pop() || 'file.bin'),
      mime: 'application/octet-stream',
      size: 0,
      expires_at: fileExpiresAt,
    })
  }

  // 加 Content-Disposition 让浏览器下载(10 分钟签名)
  const downloadUrl = signOssGetUrl(
    ossCfg.accessKeyId, ossCfg.accessKeySecret,
    ossCfg.bucket, ossCfg.endpoint,
    objectKey,
    { expiresSec: QR_LINK_EXPIRY_SEC, responseContentDisposition: 'attachment' },
  )
  return c.json({
    ok: true,
    shortId,
    objectKey,
    downloadUrl,
    linkExpiresAt: Date.now() + QR_LINK_EXPIRY_SEC * 1000,
    fileExpiresAt,
    linkExpiresInMin: Math.floor(QR_LINK_EXPIRY_SEC / 60),
    fileExpiresInHours: QR_TTL_DIRECT_HOURS,
  })
})

/** GET /api/qr/:shortId
 *  返回文件元数据 + OSS 签名 GET URL(10 分钟有效)
 *  前端拿到 URL 直接触发下载 / 跳转
 */
app.get('/api/qr/:shortId', async (c) => {
  const shortId = c.req.param('shortId')
  const link = getShortLink(shortId)
  if (!link) {
    return c.json({ ok: false, error: '短链不存在或已过期' }, 404)
  }
  if (link.expires_at <= Date.now()) {
    // 🇨🇳 区分过期原因:直链 24h,短链 3 天 — 文案要对应
    const hoursAgo = Math.floor((Date.now() - link.expires_at) / (60 * 60 * 1000))
    const msg = link.mode === 'direct'
      ? `文件已过期(${hoursAgo} 小时前删除,直链文件只保留 24 小时)`
      : `文件已过期(${Math.floor(hoursAgo / 24)} 天前删除,短链文件只保留 3 天)`
    return c.json({ ok: false, error: msg }, 410)
  }
  const ossCfg = loadConfig().oss
  if (!ossCfg.accessKeyId) {
    return c.json({ ok: false, error: 'OSS 凭证未配置' }, 500)
  }
  const downloadUrl = signOssGetUrl(
    ossCfg.accessKeyId, ossCfg.accessKeySecret,
    ossCfg.bucket, ossCfg.endpoint,
    link.object_key,
    { expiresSec: 600 },
  )
  const expiresInMs = link.expires_at - Date.now()
  return c.json({
    ok: true,
    filename: link.filename,
    mime: link.mime,
    size: link.size,
    downloadUrl,
    expiresAt: link.expires_at,
    expiresInHours: Math.floor(expiresInMs / (60 * 60 * 1000)),
  })
})

/** POST /api/qr/cleanup
 *  cron 每天 04:00 调用,清理过期短链 + OSS 文件
 *  生产应加鉴权,这里简化用 API_SERVER_KEY
 */
app.post('/api/qr/cleanup', async (c) => {
  const apiKey = c.req.header('x-api-key') || ''
  const cfg = loadConfig()
  if (!cfg.serverKey || apiKey !== cfg.serverKey) {
    return c.json({ ok: false, error: '鉴权失败' }, 401)
  }
  const objectKeys = deleteExpired()
  const ossCfg = cfg.oss
  const results: any[] = []
  if (ossCfg.accessKeyId && objectKeys.length > 0) {
    // 用 fetch + DELETE 签名 URL 调 OSS DeleteObject(2026-09-02 修复:之前用 GET 签名做 DELETE 一直 403)
    for (const key of objectKeys) {
      try {
        const signedDeleteUrl = signOssDeleteUrl(ossCfg, key, 60)
        const resp = await fetch(signedDeleteUrl, { method: 'DELETE' })
        results.push({ key, ok: resp.ok || resp.status === 204, status: resp.status })
      } catch (e: any) {
        results.push({ key, ok: false, error: e.message })
      }
    }
  }
  return c.json({ ok: true, cleanedCount: objectKeys.length, results })
})

// ============================================================
// 启动
// ============================================================

// 🇨🇳 2026-09-01 M3.9 R38:启动段单独提到 start.ts(api.ts 只 export app,不内嵌启动逻辑)
// 修法原因:import.meta.url 检查在 jiti / vite-dev middleware / node --import 三种模式下行为不一致,
// 直接导致 server 启动段永远不会跑 / 或跑了之后崩溃.
// 启动 entry 改用 server/start.ts。

// 🇨🇳 2026-09-03 R49.7:vocal-upload / vocal-separate-volc 路由已统一移到 export default 之前
// (见 quota 路由之后),保证 ESM 模块副作用顺序正确
// 原位置的路由块已删除,避免重复定义

// 🇨🇳 2026-09-03 R49.7:export default 放到文件最末尾,确保所有 app.post/get 都在它之前注册
// 🇨🇳 R57:支付端点也加在这里
import { setUserPlan, addTopupBalance } from './kv.ts'
import {
  createOrder as dbCreateOrder,
  getOrder as dbGetOrder,
  markOrderPaid as dbMarkOrderPaid,
  listUserOrders as dbListUserOrders,
} from './order-kv.ts'

import {
  createNativeOrder as wechatCreateOrder,
  queryOrder as wechatQueryOrder,
  verifyCallbackSignature as wechatVerifySig,
  decryptCallbackResource as wechatDecrypt,
  generateOutTradeNo,
} from './wechat-pay.ts'

/** 🇨🇳 R57:支付套餐定义(前端 PaywallDialog 一致) */
const PAY_PLANS: Record<string, { name: string; type: 'subscription' | 'topup'; amountCents: number; minutes: number; description: string }> = {
  // 订阅
  plus: { name: 'Plus 月度', type: 'subscription', amountCents: 2900, minutes: 60, description: '简盒 JianHeBox Plus 月度订阅' },
  pro: { name: 'Pro 月度', type: 'subscription', amountCents: 6900, minutes: 200, description: '简盒 JianHeBox Pro 月度订阅' },
  studio: { name: 'Studio 月度', type: 'subscription', amountCents: 12900, minutes: 600, description: '简盒 JianHeBox Studio 月度订阅' },
  // 充值包
  mini: { name: '体验包', type: 'topup', amountCents: 900, minutes: 60, description: '简盒 JianHeBox 体验充值包' },
  value: { name: '划算包', type: 'topup', amountCents: 4900, minutes: 400, description: '简盒 JianHeBox 划算充值包' },
  bulk: { name: '大量包', type: 'topup', amountCents: 19900, minutes: 2000, description: '简盒 JianHeBox 大量充值包' },
}

/** 🇨🇳 R57:创建订单(调微信 Native 下单,返回二维码 URL) */
app.post('/api/pay/create-order', async (c) => {
  // 鉴权
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/, '') || c.req.query('token')
  if (!token) return c.json({ ok: false, error: '未登录' }, 401)
  const cfg = loadConfig()
  try {
    const { payload: jwtPayload } = await jwtVerify(token, cfg.jwt.secret)
    const userId = jwtPayload.sub as string
    if (!userId) return c.json({ ok: false, error: 'token 无效' }, 401)

    const body = await c.req.json().catch(() => ({} as any))
    const planId = String(body?.planId || '')
    if (!planId || !PAY_PLANS[planId]) {
      return c.json({ ok: false, error: '无效套餐' }, 400)
    }
    const plan = PAY_PLANS[planId]

    // 生成商户订单号
    const outTradeNo = generateOutTradeNo(userId)
    const expiresAt = Date.now() + 30 * 60 * 1000  // 30 分钟过期

    // 调微信 Native 下单(返回 code_url)
    const wechatRes = await wechatCreateOrder({
      outTradeNo,
      description: plan.description,
      amountCents: plan.amountCents,
      attach: JSON.stringify({ userId, planId }),
    })

    // 存订单到 KV
    dbCreateOrder({
      orderId: outTradeNo,
      userId,
      planId,
      planType: plan.type,
      amountCents: plan.amountCents,
      minutes: plan.minutes,
      expiresAt,
      wechatCodeUrl: wechatRes.codeUrl,
    })

    return c.json({
      ok: true,
      orderId: outTradeNo,
      planId,
      amountCents: plan.amountCents,
      codeUrl: wechatRes.codeUrl,
      mock: wechatRes.mock || false,
      expiresAt,
    })
  } catch (e) {
    return c.json({ ok: false, error: '订单创建失败: ' + (e as Error).message }, 500)
  }
})

/** 🇨🇳 R57:查订单状态(前端轮询用) */
app.get('/api/pay/order-status', async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/, '') || c.req.query('token')
  const orderId = c.req.query('orderId') as string
  if (!token) return c.json({ ok: false, error: '未登录' }, 401)
  if (!orderId) return c.json({ ok: false, error: '缺少 orderId' }, 400)
  const cfg = loadConfig()
  try {
    const { payload: jwtPayload } = await jwtVerify(token, cfg.jwt.secret)
    const userId = jwtPayload.sub as string

    const order = dbGetOrder(orderId)
    if (!order) return c.json({ ok: false, error: '订单不存在' }, 404)
    if (order.user_id !== userId) return c.json({ ok: false, error: '订单不属于当前用户' }, 403)

    // 主动查微信(避免回调延迟)
    if (order.status === 'pending') {
      try {
        const wq = await wechatQueryOrder(orderId)
        if (wq && wq.status === 'paid') {
          const paid = dbMarkOrderPaid(orderId, wq.transactionId || '')
          if (paid) {
            applyOrderToUser(paid)
            return c.json({ ok: true, status: 'paid', order: paid })
          }
        }
      } catch {
        // 查失败不影响本地订单状态
      }
      // 检查过期
      if (order.expires_at < Date.now()) {
        return c.json({ ok: true, status: 'expired', order })
      }
    }

    return c.json({ ok: true, status: order.status, order })
  } catch (e) {
    return c.json({ ok: false, error: '查询失败: ' + (e as Error).message }, 500)
  }
})

/** 🇨🇳 R57:微信回调(异步通知) */
app.post('/api/pay/wechat-callback', async (c) => {
  const timestamp = c.req.header('Wechatpay-Timestamp') as string
  const nonce = c.req.header('Wechatpay-Nonce') as string
  const signature = c.req.header('Wechatpay-Signature') as string
  const body = await c.req.text()

  // 验签(防伪造回调)
  if (!wechatVerifySig(timestamp, nonce, body, signature)) {
    return c.json({ code: 'SIGN_INVALID', message: '签名验证失败' }, 401)
  }

  const payload = JSON.parse(body)
  const resource = payload.resource || {}
  if (!resource.ciphertext || !resource.associated_data || !resource.nonce) {
    return c.json({ code: 'PARAM_ERROR', message: '资源格式错误' }, 400)
  }

  // 解密
  let decrypted: any
  try {
    const plain = wechatDecrypt(resource.ciphertext, resource.associated_data, resource.nonce)
    decrypted = JSON.parse(plain)
  } catch (e) {
    return c.json({ code: 'DECRYPT_ERROR', message: '解密失败' }, 400)
  }

  const outTradeNo = decrypted.out_trade_no
  const transactionId = decrypted.transaction_id
  if (!outTradeNo) {
    return c.json({ code: 'PARAM_ERROR', message: '缺少 out_trade_no' }, 400)
  }

  // 标记订单已支付
  const paid = dbMarkOrderPaid(outTradeNo, transactionId)
  if (paid) {
    applyOrderToUser(paid)
  }

  // 必须返回 200,微信才认为成功
  return c.json({ code: 'SUCCESS', message: '成功' })
})

/** 🇨🇳 R57:把订单内容应用到用户额度(订阅 = 设套餐,充值 = 加分钟) */
function applyOrderToUser(order: any) {
  try {
    if (order.plan_type === 'subscription') {
      // 订阅:更新用户的 plan + monthly_limit(分钟 → 秒)
      setUserPlan(order.user_id, order.plan_id, order.minutes * 60)
    } else if (order.plan_type === 'topup') {
      // 充值:把分钟加到 topup_balance
      addTopupBalance(order.user_id, order.minutes)
    }
  } catch (e) {
    console.error('[applyOrderToUser] error:', e)
  }
}

/** 🇨🇳 R57:列出当前用户的订单 */
app.get('/api/pay/orders', async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/, '') || c.req.query('token')
  if (!token) return c.json({ ok: false, error: '未登录' }, 401)
  const cfg = loadConfig()
  try {
    const { payload: jwtPayload } = await jwtVerify(token, cfg.jwt.secret)
    const userId = jwtPayload.sub as string
    const orders = dbListUserOrders(userId, 50)
    return c.json({ ok: true, orders })
  } catch (e) {
    return c.json({ ok: false, error: '查询失败' }, 401)
  }
})

/** 🇨🇳 R57:Mock 模式 — 强制确认订单(模拟扫码支付完成)
 *  仅当 VITE_PAY_MOCK=1 时启用,生产环境不应该有
 */
app.post('/api/pay/mock-confirm', async (c) => {
  if (process.env.VITE_PAY_MOCK !== '1') {
    return c.json({ ok: false, error: 'Mock 模式未启用' }, 403)
  }
  const body = await c.req.json().catch(() => ({} as any))
  const orderId = String(body?.orderId || '')
  if (!orderId) return c.json({ ok: false, error: '缺少 orderId' }, 400)

  const paid = dbMarkOrderPaid(orderId, `MOCK_TXN_${orderId}`)
  if (!paid) return c.json({ ok: false, error: '订单不存在或已支付' }, 400)
  applyOrderToUser(paid)
  return c.json({ ok: true, order: paid })
})

export default app