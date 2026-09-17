/**
 * 🇨🇳 2026-08-31:本地 KV 数据层(SQLite 模拟 FC KV)
 *
 * 在 M2 本地测试阶段,先用 SQLite 模拟阿里云 FC 自带的 KV 存储
 * 数据表:
 *   - users        用户主表(email/github_id/google_id 唯一)
 *   - auth_codes   邮箱验证码(6 位,10 分钟过期)
 *   - usage        额度记录(每月重置)
 *   - oauth_states GitHub/Google OAuth state 校验
 */
import { randomInt } from 'node:crypto';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { hashPassword, verifyPassword } from './auth-real.js';
const KV_DB_PATH = process.env.VITE_AUTH_KV_PATH || '/var/lib/jianhebox/kv.db';
// 🇨🇳 9-3 R49.8:数据库从 /tmp 迁到 /var/lib/jianhebox/,避免服务器重启数据丢失
//   可通过环境变量 VITE_AUTH_KV_PATH 覆盖(测试用)
console.log('[KV] 数据库路径:', KV_DB_PATH);
const db = new Database(KV_DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,                 -- 'email' | 'phone' | 'github' | 'google'
    email TEXT,
    phone TEXT,
    provider_id TEXT,                        -- GitHub id / Google sub / 邮箱地址 / 手机号
    password_hash TEXT,                      -- 仅 phone provider 可能设置(可选)
    name TEXT,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER NOT NULL,
    plan TEXT DEFAULT 'free',                -- 🇨🇳 R57:用户套餐(free/plus/pro/studio)
    plan_minutes INTEGER DEFAULT 0,          -- 🇨🇳 R57:订阅月度配额(分钟)
    topup_balance_min INTEGER DEFAULT 0,     -- 🇨🇳 R57:充值余额(分钟,永久有效)
    UNIQUE(provider, provider_id)
  );

  CREATE TABLE IF NOT EXISTS auth_codes (
    code TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email);

  CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT PRIMARY KEY,
    monthly_used_sec INTEGER DEFAULT 0,
    monthly_limit_sec INTEGER DEFAULT 1800,   -- 30 分钟
    last_reset_date TEXT,                      -- 'YYYY-MM'
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    redirect_after TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedbacks (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    email TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    page TEXT,
    timestamp TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_feedbacks_ip ON feedbacks(ip);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_ts ON feedbacks(timestamp DESC);
`);
// 🇨🇳 2026-09-11 增量迁移:给老 users 表补 phone / password_hash 列(老库无这俩列)
// SQLite 没有 IF NOT EXISTS for ADD COLUMN,用 try/catch 包一层
function safeAlter(sql) {
    try {
        db.exec(sql);
    }
    catch { /* column exists */ }
}
safeAlter(`ALTER TABLE users ADD COLUMN phone TEXT`);
safeAlter(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
// 🇨🇳 R57:支付字段
safeAlter(`ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'`);
safeAlter(`ALTER TABLE users ADD COLUMN plan_minutes INTEGER DEFAULT 0`);
safeAlter(`ALTER TABLE users ADD COLUMN topup_balance_min INTEGER DEFAULT 0`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL`);
export function findOrCreateUser(opts) {
    const existing = db.prepare(`
    SELECT * FROM users WHERE provider = ? AND provider_id = ?
  `).get(opts.provider, opts.provider_id);
    if (existing) {
        // 更新 last_login_at + 补充可能的字段(password_hash / phone / email)
        db.prepare(`
      UPDATE users SET last_login_at = ? WHERE user_id = ?
    `).run(Date.now(), existing.user_id);
        return { ...existing, last_login_at: Date.now() };
    }
    const user_id = nanoid(24);
    const now = Date.now();
    db.prepare(`
    INSERT INTO users (user_id, provider, email, phone, provider_id, password_hash, name, avatar_url, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user_id, opts.provider, opts.email ?? null, opts.phone ?? null, opts.provider_id, opts.password_hash ?? null, opts.name ?? null, opts.avatar_url ?? null, now, now);
    // 同时初始化额度
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    db.prepare(`
    INSERT INTO usage (user_id, monthly_used_sec, monthly_limit_sec, last_reset_date, updated_at)
    VALUES (?, 0, 1800, ?, ?)
  `).run(user_id, currentMonth, now);
    return {
        user_id,
        provider: opts.provider,
        email: opts.email ?? null,
        phone: opts.phone ?? null,
        provider_id: opts.provider_id,
        password_hash: opts.password_hash ?? null,
        name: opts.name,
        avatar_url: opts.avatar_url,
        created_at: now,
        last_login_at: now,
    };
}
/**
 * 🇨🇳 2026-09-11:手机号查用户(provider=phone)
 * 用于"验证码登录前判断是新用户还是老用户"以及"密码登录"。
 */
export function findUserByPhone(phone) {
    const u = db.prepare(`SELECT * FROM users WHERE provider = 'phone' AND phone = ?`).get(phone);
    return u ?? null;
}
/**
 * 🇨🇳 2026-09-11:邮箱查用户(provider=email)
 * 用于"send-code 时判断 register / login mode"。
 */
export function findUserByEmail(email) {
    const u = db.prepare(`SELECT * FROM users WHERE provider = 'email' AND email = ?`).get(email);
    return u ?? null;
}
export function getUserById(user_id) {
    const u = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(user_id);
    return u ?? null;
}
/**
 * 🇨🇳 2026-09-11 R53.2「个人中心」:更新用户资料
 *  - 只更新提供的字段(空值不动)
 *  - 头像 URL 可选(未来接 OSS / gravatar)
 */
export function updateUserProfile(user_id, patch) {
    const user = getUserById(user_id);
    if (!user)
        return null;
    const updates = [];
    const values = [];
    if (patch.name !== undefined) {
        const trimmed = patch.name.trim().slice(0, 40);
        if (trimmed) {
            updates.push('name = ?');
            values.push(trimmed);
        }
    }
    if (patch.avatar_url !== undefined && patch.avatar_url) {
        updates.push('avatar_url = ?');
        values.push(patch.avatar_url.slice(0, 500));
    }
    if (updates.length === 0)
        return user; // 没有要更新的,直接返回原值
    values.push(user_id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
    return getUserById(user_id);
}
/**
 * 🇨🇳 2026-09-11 R53.2:修改密码
 *  - 设过密码:current_password 必填且必须匹配
 *  - 没设过密码(纯验证码老用户):需要 email code
 *  - 设置后所有该用户 token 不失效(不强制登出),但服务端不存 token 黑名单(简盒 v1 简化)
 */
export async function setUserPassword(user_id, new_password, opts = {}) {
    const user = getUserById(user_id);
    if (!user)
        return { ok: false, error: '用户不存在' };
    if (user.password_hash) {
        // 已设过密码 — 必须验证 current_password(除非已经过 code 验证过,如 forgot-password 路径)
        if (!opts.require_code_consumed) {
            if (!opts.current_password) {
                return { ok: false, error: '请输入当前密码' };
            }
            const ok = await verifyPassword(opts.current_password, user.password_hash);
            if (!ok)
                return { ok: false, error: '当前密码错误' };
        }
    }
    const password_hash = await hashPassword(new_password);
    db.prepare(`UPDATE users SET password_hash = ? WHERE user_id = ?`).run(password_hash, user_id);
    return { ok: true };
}
/**
 * 🇨🇳 2026-09-11 R53.2:删除账号(注销)
 *  - 删除 users 行
 *  - 关联数据(usage / auth_codes)用 user_id 做兜底清理
 *  - 返回 ok 表示成功(简盒 v1 不做软删除)
 */
export function deleteUser(user_id) {
    db.prepare(`DELETE FROM users WHERE user_id = ?`).run(user_id);
    db.prepare(`DELETE FROM usage WHERE user_id = ?`).run(user_id);
    // auth_codes / oauth_states 不带 user_id 字段,不强清
    return { ok: true };
}
export function createAuthCode(email, ttlSec = 600) {
    // 🇨🇳 2026-08-31 M3.9 R34:用密码学安全随机(不要 Math.random — 可预测)
    const code = String(randomInt(100000, 1000000)); // 6 位
    const now = Date.now();
    const expires_at = now + ttlSec * 1000;
    db.prepare(`
    INSERT INTO auth_codes (code, email, expires_at, used, created_at)
    VALUES (?, ?, ?, 0, ?)
  `).run(code, email, expires_at, now);
    return { code, email, expires_at, used: 0, created_at: now };
}
export function consumeAuthCode(email, code) {
    const row = db.prepare(`
    SELECT * FROM auth_codes WHERE email = ? AND code = ? ORDER BY created_at DESC LIMIT 1
  `).get(email, code);
    if (!row)
        return { ok: false, reason: '验证码不存在' };
    if (row.used)
        return { ok: false, reason: '验证码已使用' };
    if (Date.now() > row.expires_at)
        return { ok: false, reason: '验证码已过期' };
    // 标记已用(防止同一码多次用)
    db.prepare(`UPDATE auth_codes SET used = 1 WHERE code = ?`).run(row.code);
    return { ok: true };
}
/** 读取用户额度(自动按月重置) */
export function getUsage(user_id) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    let u = db.prepare(`SELECT * FROM usage WHERE user_id = ?`).get(user_id);
    if (!u) {
        // 兜底创建
        db.prepare(`
      INSERT INTO usage (user_id, monthly_used_sec, monthly_limit_sec, last_reset_date, updated_at)
      VALUES (?, 0, 1800, ?, ?)
    `).run(user_id, currentMonth, Date.now());
        u = db.prepare(`SELECT * FROM usage WHERE user_id = ?`).get(user_id);
    }
    // 月份变了 → 重置
    if (u.last_reset_date !== currentMonth) {
        db.prepare(`
      UPDATE usage SET monthly_used_sec = 0, last_reset_date = ?, updated_at = ? WHERE user_id = ?
    `).run(currentMonth, Date.now(), user_id);
        u.monthly_used_sec = 0;
        u.last_reset_date = currentMonth;
    }
    return u;
}
/** 检查用户是否还有剩余额度(返回剩余秒数) */
export function checkQuota(user_id, neededSec) {
    const u = getUsage(user_id);
    const remaining = u.monthly_limit_sec - u.monthly_used_sec;
    if (remaining < neededSec) {
        return {
            ok: false,
            remainingSec: remaining,
            reason: `本月剩余额度 ${formatSec(remaining)}，需要 ${formatSec(neededSec)}`,
        };
    }
    return { ok: true, remainingSec: remaining };
}
/** 扣减额度 */
export function consumeQuota(user_id, usedSec) {
    const u = getUsage(user_id);
    const newUsed = Math.min(u.monthly_limit_sec, u.monthly_used_sec + Math.max(0, usedSec));
    db.prepare(`
    UPDATE usage SET monthly_used_sec = ?, updated_at = ? WHERE user_id = ?
  `).run(newUsed, Date.now(), user_id);
    return { ...u, monthly_used_sec: newUsed };
}
function formatSec(s) {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${String(ss).padStart(2, '0')}`;
}
// ========== OAuth state ==========
export function createOAuthState(provider, redirectAfter) {
    const state = nanoid(32);
    db.prepare(`
    INSERT INTO oauth_states (state, provider, redirect_after, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(state, provider, redirectAfter ?? null, Date.now() + 600_000, Date.now());
    return state;
}
export function consumeOAuthState(state) {
    const row = db.prepare(`
    SELECT * FROM oauth_states WHERE state = ? LIMIT 1
  `).get(state);
    if (!row)
        return { ok: false, reason: 'state 不存在' };
    if (Date.now() > row.expires_at)
        return { ok: false, reason: 'state 已过期' };
    // 一次性消费
    db.prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state);
    return { ok: true, provider: row.provider, redirect_after: row.redirect_after ?? undefined };
}
// ========== 问题反馈 ==========
// 🇨🇳 R57:支付相关 — 给用户加套餐/充值额度
export function setUserPlan(userId, plan, planMinutes) {
    db.prepare(`UPDATE users SET plan = ?, plan_minutes = ? WHERE user_id = ?`).run(plan, planMinutes, userId);
}
export function addTopupBalance(userId, minutes) {
    db.prepare(`UPDATE users SET topup_balance_min = topup_balance_min + ? WHERE user_id = ?`).run(minutes, userId);
}
export function saveFeedback(fb) {
    const timestamp = fb.timestamp ?? new Date().toISOString();
    db.prepare(`INSERT INTO feedbacks (id, ip, email, subject, message, page, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run(fb.id, fb.ip, fb.email, fb.subject, fb.message, fb.page, timestamp);
    return { ...fb, timestamp };
}
export function getLastFeedbackByIp(ip) {
    const row = db
        .prepare(`SELECT id, ip, email, subject, message, page, timestamp FROM feedbacks
       WHERE ip = ? ORDER BY timestamp DESC LIMIT 1`)
        .get(ip);
    return row ?? null;
}
export function listFeedbacks(limit = 50) {
    return db
        .prepare(`SELECT id, ip, email, subject, message, page, timestamp FROM feedbacks
       ORDER BY timestamp DESC LIMIT ?`)
        .all(limit);
}
// ========== 调试用：打印全部表 ==========
export function _debugDump() {
    const users = db.prepare(`SELECT * FROM users`).all();
    const codes = db.prepare(`SELECT * FROM auth_codes`).all();
    const usage = db.prepare(`SELECT * FROM usage`).all();
    const states = db.prepare(`SELECT * FROM oauth_states`).all();
    return { users, codes, usage, states, dbPath: KV_DB_PATH };
}
