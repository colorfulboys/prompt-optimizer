/**
 * 🇨🇳 2026-08-31:GitHub / Google OAuth 客户端(本地 Mock + 真实模式)
 *
 * 本地测试:
 *   - 设置 VITE_AUTH_MOCK_OAUTH=1(默认)
 *   - 直接返回固定 mock user
 *
 * 生产部署:
 *   - 设置 VITE_AUTH_MOCK_OAUTH=0
 *   - 配置 GitHub OAuth App + Google OAuth Client
 *   - 用真 client_id / client_secret 走标准 OAuth 流程
 *
 * GitHub OAuth 文档:
 *   1. https://github.com/login/oauth/authorize?client_id=XXX&scope=user:email&state=YYY
 *   2. 用户同意 → 回调 /auth/github/callback?code=XXX&state=YYY
 *   3. POST https://github.com/login/oauth/access_token (拿 access_token)
 *   4. GET https://api.github.com/user (拿用户信息)
 *
 * Google OAuth 文档:
 *   1. https://accounts.google.com/o/oauth2/v2/auth?client_id=XXX&...&scope=openid+email+profile
 *   2. 用户同意 → 回调 ?code=XXX&state=YYY
 *   3. POST https://oauth2.googleapis.com/token (拿 id_token + access_token)
 *   4. 解析 id_token (JWT) 或 GET https://www.googleapis.com/oauth2/v3/userinfo
 */

const USE_MOCK_OAUTH = process.env.VITE_AUTH_MOCK_OAUTH !== '0'

export interface OAuthUserInfo {
  provider: 'github' | 'google'
  provider_id: string
  email: string
  name: string
  avatar_url: string
}

export interface OAuthExchangeResult {
  ok: boolean
  user?: OAuthUserInfo
  error?: string
}

// ========== Mock 模式 ==========
async function mockOAuth(provider: 'github' | 'google'): Promise<OAuthExchangeResult> {
  // 本地测试:返回固定 mock 用户
  const mockUsers: Record<string, OAuthUserInfo> = {
    github: {
      provider: 'github',
      provider_id: 'mock-github-100001',
      email: 'mock-github@jianhebox.local',
      name: 'Mock GitHub User',
      avatar_url: 'https://avatars.githubusercontent.com/u/0?v=4',
    },
    google: {
      provider: 'google',
      provider_id: 'mock-google-100002',
      email: 'mock-google@jianhebox.local',
      name: 'Mock Google User',
      avatar_url: 'https://lh3.googleusercontent.com/a/default-user',
    },
  }

  return {
    ok: true,
    user: mockUsers[provider],
  }
}

// ========== 真实 OAuth 模式 ==========
async function realOAuth(provider: 'github' | 'google', code: string): Promise<OAuthExchangeResult> {
  if (provider === 'github') {
    return realGitHub(code)
  }
  return realGoogle(code)
}

async function realGitHub(code: string): Promise<OAuthExchangeResult> {
  // 🇨🇳 R52.19:原 VITE_GITHUB_OAUTH_CLIENT_SECRET 会进前端 bundle 公开,改名 GITHUB_OAUTH_CLIENT_SECRET
  const clientId = process.env.VITE_GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'GitHub OAuth 未启用(client_id/secret 缺失)' }
  }

  try {
    // 1. code → access_token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })
    const tokenData: any = await tokenRes.json()
    if (!tokenData.access_token) {
      return { ok: false, error: `GitHub 拿 token 失败: ${JSON.stringify(tokenData)}` }
    }
    const accessToken = tokenData.access_token

    // 2. access_token → user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}`, 'User-Agent': 'jianhebox' },
    })
    const userData: any = await userRes.json()

    // 3. 拿邮箱(可能是 private,需要单独调 /user/emails)
    let email = userData.email
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `token ${accessToken}`, 'User-Agent': 'jianhebox' },
      })
      const emails: any[] = await emailRes.json()
      const primary = emails.find((e) => e.primary) || emails[0]
      email = primary?.email || `${userData.login}@users.noreply.github.com`
    }

    return {
      ok: true,
      user: {
        provider: 'github',
        provider_id: String(userData.id),
        email,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
      },
    }
  } catch (e: any) {
    return { ok: false, error: `GitHub OAuth 失败: ${e.message}` }
  }
}

async function realGoogle(code: string): Promise<OAuthExchangeResult> {
  // 🇨🇳 R52.19:原 VITE_GOOGLE_OAUTH_CLIENT_SECRET 会进前端 bundle 公开,改名 GOOGLE_OAUTH_CLIENT_SECRET
  const clientId = process.env.VITE_GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.VITE_GOOGLE_OAUTH_REDIRECT_URI

  if (!clientId || !clientSecret) {
    return { ok: false, error: 'Google OAuth 未启用(client_id/secret 缺失)' }
  }

  try {
    // 1. code → tokens
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri || '',
      grant_type: 'authorization_code',
    })
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const tokenData: any = await tokenRes.json()
    if (!tokenData.access_token) {
      return { ok: false, error: `Google 拿 token 失败: ${JSON.stringify(tokenData)}` }
    }

    // 2. access_token → userinfo
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userData: any = await userRes.json()

    return {
      ok: true,
      user: {
        provider: 'google',
        provider_id: userData.sub,
        email: userData.email,
        name: userData.name,
        avatar_url: userData.picture,
      },
    }
  } catch (e: any) {
    return { ok: false, error: `Google OAuth 失败: ${e.message}` }
  }
}

/**
 * 🇨🇳 统一入口:用 code 换 user info
 */
export async function exchangeOAuthCode(provider: 'github' | 'google', code: string): Promise<OAuthExchangeResult> {
  if (USE_MOCK_OAUTH) {
    return mockOAuth(provider)
  }
  return realOAuth(provider, code)
}

/**
 * 构造 OAuth 授权 URL
 */
export function buildOAuthAuthorizeUrl(provider: 'github' | 'google', state: string, redirectUri: string): string {
  if (USE_MOCK_OAUTH) {
    // Mock 模式:直接跳 callback
    const u = new URL(redirectUri)
    u.searchParams.set('code', `mock-code-${provider}`)
    u.searchParams.set('state', state)
    return u.toString()
  }

  if (provider === 'github') {
    const u = new URL('https://github.com/login/oauth/authorize')
    u.searchParams.set('client_id', process.env.VITE_GITHUB_OAUTH_CLIENT_ID || '')
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('scope', 'user:email')
    u.searchParams.set('state', state)
    return u.toString()
  }

  if (provider === 'google') {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    u.searchParams.set('client_id', process.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '')
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', 'openid email profile')
    u.searchParams.set('state', state)
    u.searchParams.set('access_type', 'offline')
    return u.toString()
  }

  throw new Error(`Unknown OAuth provider: ${provider}`)
}