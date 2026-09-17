/**
 * 🇨🇳 2026-08-31:认证 + 额度 Pinia Store
 *
 * 管理:
 *   - 当前登录用户(token + user 信息持久化在 localStorage)
 *   - 用户月度额度(本地 mock,从 /api/audio/quota 拉)
 *   - 登录/退出/刷新的 actions
 *
 * 用法:
 *   import { useAuthStore } from '@/stores/auth'
 *   const auth = useAuthStore()
 *   await auth.fetchUser()
 *   if (!auth.isLoggedIn) showLoginModal()
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AuthUser {
  user_id: string
  provider: 'email' | 'phone' | 'github' | 'google'
  email?: string
  phone?: string
  name?: string
  avatar_url?: string
  has_password?: boolean
  email_verified?: boolean
  created_at?: number
  last_login_at?: number
  plan?: 'free' | 'plus' | 'pro' | 'studio'
  quota?: {
    monthly_used_sec: number
    monthly_limit_sec: number
    remaining_sec: number
    last_reset_date: string
  }
}

export interface UsageInfo {
  user_id: string
  monthly_used_sec: number
  monthly_limit_sec: number
  last_reset_date: string
  updated_at: number
}

const TOKEN_KEY = 'jianhebox_auth_token'
const USER_KEY = 'jianhebox_auth_user'
const QUOTA_KEY = 'jianhebox_quota'

export const useAuthStore = defineStore('auth', () => {
  // ========== 状态(refs) ==========
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<AuthUser | null>(loadUser())
  const quota = ref<UsageInfo | null>(loadQuota())
  const loading = ref(false)
  const error = ref('')

  // ========== 计算属性 ==========
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const remainingSec = computed(() => {
    if (!quota.value) return 0
    return Math.max(0, quota.value.monthly_limit_sec - quota.value.monthly_used_sec)
  })
  const remainingLabel = computed(() => {
    const s = remainingSec.value
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${m}:${String(ss).padStart(2, '0')}`
  })
  const usedLabel = computed(() => {
    const s = quota.value?.monthly_used_sec || 0
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${m}:${String(ss).padStart(2, '0')}`
  })

  // ========== 内部辅助 ==========
  function loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  function loadQuota(): UsageInfo | null {
    try {
      const raw = localStorage.getItem(QUOTA_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  function persist() {
    if (token.value) localStorage.setItem(TOKEN_KEY, token.value)
    else localStorage.removeItem(TOKEN_KEY)
    if (user.value) localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    else localStorage.removeItem(USER_KEY)
  }
  function persistQuota() {
    if (quota.value) localStorage.setItem(QUOTA_KEY, JSON.stringify(quota.value))
  }

  /** 🇨🇳 R57:外部直接 setToken + setUser(手机验证码登录用) */
  function setTokenAndUser(newToken: string, newUser: any) {
    token.value = newToken
    user.value = newUser
    persist()
  }

  // ========== 通用 fetch 工具 ==========
  async function authFetch(path: string, init: RequestInit = {}): Promise<any> {
    if (!token.value) throw new Error('未登录')
    const r = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...getAuthHeader(),
      },
    })
    const data: any = await r.json().catch(() => ({}))
    if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`)
    return data
  }

  // ========== Actions ==========

  /** 🇨🇳 R55 2026-09-11:邮箱 + 密码登录(主路径)
   *  POST /api/auth/login → 存 token + user + 拉 quota
   */
  async function loginWithPassword(email: string, password: string): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      })
      const data: any = await r.json()
      if (!r.ok || !data.ok) {
        const err: any = new Error(data.error || `HTTP ${r.status}`)
        err.needResetPassword = data.needResetPassword
        throw err
      }
      token.value = data.token
      user.value = data.user
      persist()
      await fetchUser()
      await fetchQuota()
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 🇨🇳 R55 2026-09-11:注册(走 verify-code → 后端创建账号 → 立即调 /login 设密码)
   *  第一步:verify-code(收验证码 → 后端创建账号 + 返回 JWT)
   *  第二步:用密码登录(/login)并把密码同步给后端(用 /api/auth/change-password)
   *  注:此处的简化版流程是 — verify-code 完成后,前端立即跳「设密码」弹窗,用户输密码后调 change-password
   *  此函数只负责 verify-code 一步
   */
  async function registerWithCode(email: string, code: string): Promise<{ token: string; user: AuthUser }> {
    loading.value = true
    error.value = ''
    try {
      const r = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code }),
      })
      const data: any = await r.json()
      if (!r.ok || !data.ok) {
        const err: any = new Error(data.error || `HTTP ${r.status}`)
        err.redirect_to_login = data.redirect_to_login
        throw err
      }
      // 注册成功 → 自动登录态(token 先存)
      token.value = data.token
      user.value = data.user
      persist()
      await fetchUser()
      await fetchQuota()
      return { token: data.token, user: data.user }
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 🇨🇳 R55 2026-09-11:注册后设密码(让新账号能用邮箱 + 密码登录)
   *  走 /api/auth/change-password(已登录鉴权)
   *  - 新账号无 password_hash → current_password 不传,后端允许
   *  - 老账号有 password_hash → 必须传 current_password
   */
  /** 🇨🇳 R56 2026-09-11:注册流程中设密码
   * 复用 reset-password 接口(因为不需要 current_password,只需要验证码 + 新密码)
   * 前端已经验证过验证码,后端 reset-password 会再次校验
   */
  async function setPasswordAfterRegister(email: string, code: string, new_password: string): Promise<void> {
    const r = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim(), code, new_password }),
    })
    const data: any = await r.json()
    if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`)
  }

  /** 🇨🇳 R55 2026-09-11:忘记密码(走邮箱验证码 + 新密码)
   *  POST /api/auth/reset-password
   */
  async function resetPasswordWithCode(email: string, code: string, new_password: string): Promise<void> {
    const r = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        code,
        new_password,
      }),
    })
    const data: any = await r.json()
    if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`)
  }

  // 兼容旧调用(loginWithEmail 留作 alias → loginWithPassword,但只接 email+code 不再走 verify-code 主路径)
  /** @deprecated 用 loginWithPassword / registerWithCode 替代 */
  async function loginWithEmail(email: string, _code: string): Promise<void> {
    // 老调用:抛错提示用新 API(因为旧 verify-code 不再支持密码=验证码单步登录)
    throw new Error('请使用邮箱 + 密码登录(已废弃验证码单独登录)')
  }

  /** 跳 GitHub OAuth(后端会 302 到 github,然后回调到 /api/auth/github/callback 写 localStorage) */
  function loginWithGitHub() {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `/api/auth/github/start?redirect=${redirect}`
  }

  /** 跳 Google OAuth */
  function loginWithGoogle() {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `/api/auth/google/start?redirect=${redirect}`
  }

  /** 刷新 user 信息(OAuth 回调后 / 修改资料后) */
  async function fetchUser() {
    if (!token.value) return
    try {
      const r = await fetch(`/api/auth/me?token=${token.value}`)
      const data: any = await r.json()
      if (r.ok && data.ok) {
        user.value = data.user
        if (data.user?.quota) {
          quota.value = {
            user_id: data.user.user_id,
            monthly_used_sec: data.user.quota.monthly_used_sec,
            monthly_limit_sec: data.user.quota.monthly_limit_sec,
            last_reset_date: data.user.quota.last_reset_date,
            updated_at: Date.now(),
          }
          persistQuota()
        }
        persist()
      } else if (r.status === 401) {
        // token 过期
        logout()
      }
    } catch {
      // 网络错,保留旧 token
    }
  }

  /** 拉额度 */
  async function fetchQuota() {
    if (!token.value) return
    try {
      const r = await fetch(`/api/audio/quota?token=${token.value}`)
      const data: any = await r.json()
      if (r.ok && data.ok && data.quota) {
        quota.value = data.quota
        persistQuota()
      }
    } catch {}
  }

  /** 转写后 server 返回的新额度,直接 update */
  function updateQuota(newQuota: UsageInfo) {
    quota.value = newQuota
    persistQuota()
  }

  /** 🇨🇳 R53.2:更新昵称 / 头像 */
  async function updateProfile(patch: { name?: string; avatar_url?: string }): Promise<void> {
    const data = await authFetch('/api/auth/update-profile', {
      method: 'POST',
      body: JSON.stringify(patch),
    })
    user.value = { ...(user.value || {}), ...data.user }
    persist()
  }

  /** 🇨🇳 R53.2:已登录状态修改密码 */
  async function changePassword(current_password: string, new_password: string): Promise<void> {
    await authFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    })
    if (user.value) user.value.has_password = true
    persist()
  }

  /** 🇨🇳 R53.2:忘记密码(走邮箱验证码,无需登录) */
  async function forgotPassword(email: string, code: string, new_password: string): Promise<void> {
    const r = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password }),
    })
    const data: any = await r.json()
    if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`)
  }

  /** 🇨🇳 R53.2:注销账号 */
  async function deleteAccount(confirm_email: string): Promise<void> {
    await authFetch('/api/auth/delete-account', {
      method: 'POST',
      body: JSON.stringify({ confirm_email }),
    })
    // 服务端已删,清本地状态
    logout()
  }

  /** 退出登录 */
  function logout() {
    token.value = null
    user.value = null
    quota.value = null
    persist()
    localStorage.removeItem(QUOTA_KEY)
  }

  /** 拿当前 token(给 fetch API 加 Authorization header) */
  function getAuthHeader(): Record<string, string> {
    if (!token.value) return {}
    return { 'Authorization': `Bearer ${token.value}` }
  }

  return {
    token,
    user,
    quota,
    loading,
    error,
    isLoggedIn,
    remainingSec,
    remainingLabel,
    usedLabel,
    // 🇨🇳 R57:外部 setToken + setUser(手机验证码登录用)
    setTokenAndUser,
    // 🇨🇳 R55 2026-09-11:主路径登录(邮箱 + 密码)
    loginWithPassword,
    // 🇨🇳 R55 2026-09-11:注册(verify-code → 后端创建账号)
    registerWithCode,
    // 🇨🇳 R55 2026-09-11:注册后立即设密码(让新账号能用邮箱 + 密码登录)
    setPasswordAfterRegister,
    // 🇨🇳 R55 2026-09-11:忘记密码重置
    resetPasswordWithCode,
    // @deprecated 保留别名(已抛错引导用户用新 API)
    loginWithEmail,
    loginWithGitHub,
    loginWithGoogle,
    fetchUser,
    fetchQuota,
    updateQuota,
    updateProfile,
    changePassword,
    // @deprecated 旧 forgot-password 端点保留别名(前端不再用,只防 Account.vue 残留引用编译报错)
    forgotPassword,
    deleteAccount,
    logout,
    getAuthHeader,
  }
})
