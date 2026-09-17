<!--
  🇨🇳 R57 2026-09-11:用户中心(整体重做)
  - 顶部用户信息卡:头像 + 昵称 + 邮箱/手机 + 注册时间
  - 4 个区块:
    1. 基本信息:昵称(可改)
    2. 账号安全:
       - 邮箱用户 → 修改密码
       - 手机用户 → 设密码(让手机号也能用密码登)
       - 修改密码时:邮箱用户要求原密码;手机用户直接设
    3. 登录记录(最近 5 次)
    4. 注销账号:二次确认(输入邮箱或手机号)
-->
<template>
  <div class="account-page">
    <!-- 🇨🇳 R57 顶部 nav 栏(让用户能返回首页/功能) -->
    <JianheboxToolNav />
    <div class="account-container">
      <!-- 顶部用户信息卡 -->
      <div class="account-header">
        <div class="account-avatar">{{ userInitial }}</div>
        <div class="account-info">
          <h1 class="account-name">{{ user?.name || '未命名' }}</h1>
          <p class="account-id">
            <span v-if="user?.email">📧 {{ user.email }}</span>
            <span v-else-if="user?.phone">📱 {{ user.phone }}</span>
            <span class="account-tag">{{ providerLabel }}</span>
          </p>
          <p class="account-meta">注册时间:{{ formatDate(user?.created_at) }}</p>
        </div>
      </div>

      <!-- 区块 1:基本信息 -->
      <div class="account-section">
        <h2 class="section-title">基本信息</h2>
        <div class="section-row">
          <label class="row-label">昵称</label>
          <div class="row-control">
            <input
              v-model="nameInput"
              type="text"
              placeholder="您的昵称"
              class="row-input"
              :disabled="updatingName"
            />
            <button
              class="row-btn"
              :disabled="!canUpdateName || updatingName"
              @click="updateName"
            >
              {{ updatingName ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
        <div v-if="nameMsg" class="row-msg" :class="nameOk ? 'ok' : 'err'">{{ nameMsg }}</div>
      </div>

      <!-- 区块 2:账号安全 -->
      <div class="account-section">
        <h2 class="section-title">账号安全</h2>

        <!-- 邮箱用户:有密码 → 修改密码 -->
        <template v-if="user?.provider === 'email' && user?.has_password">
          <div class="section-row">
            <label class="row-label">修改密码</label>
            <div class="row-control-col">
              <input
                v-model="pwdCurrent"
                type="password"
                placeholder="当前密码"
                class="row-input"
                :disabled="changingPwd"
              />
              <input
                v-model="pwdNew"
                type="password"
                placeholder="新密码(至少 6 位)"
                class="row-input"
                :disabled="changingPwd"
              />
              <input
                v-model="pwdNew2"
                type="password"
                placeholder="确认新密码"
                class="row-input"
                :disabled="changingPwd"
              />
              <button
                class="row-btn"
                :disabled="!canChangePwd || changingPwd"
                @click="changePassword"
              >
                {{ changingPwd ? '修改中...' : '修改密码' }}
              </button>
            </div>
          </div>
          <div v-if="pwdMsg" class="row-msg" :class="pwdOk ? 'ok' : 'err'">{{ pwdMsg }}</div>
        </template>

        <!-- 手机用户:没设密码 → 设密码 -->
        <template v-else-if="user?.provider === 'phone' && !user?.has_password">
          <div class="section-row">
            <label class="row-label">设置密码</label>
            <div class="row-control-col">
              <p class="row-hint">手机号用户可以设密码,设后用手机号 + 密码也能登录(更安全)</p>
              <input
                v-model="pwdNew"
                type="password"
                placeholder="新密码(至少 6 位)"
                class="row-input"
                :disabled="changingPwd"
              />
              <input
                v-model="pwdNew2"
                type="password"
                placeholder="确认新密码"
                class="row-input"
                :disabled="changingPwd"
              />
              <button
                class="row-btn"
                :disabled="!canSetPwd || changingPwd"
                @click="setPassword"
              >
                {{ changingPwd ? '设置中...' : '设置密码' }}
              </button>
            </div>
          </div>
          <div v-if="pwdMsg" class="row-msg" :class="pwdOk ? 'ok' : 'err'">{{ pwdMsg }}</div>
        </template>

        <!-- 邮箱用户无密码(老账号) → 引导重置 -->
        <template v-else-if="user?.provider === 'email' && !user?.has_password">
          <div class="section-row">
            <label class="row-label">设置密码</label>
            <div class="row-control">
              <p class="row-hint">您还未设置密码,请在登录页点「忘记密码」设置</p>
            </div>
          </div>
        </template>
      </div>

      <!-- 区块 3:登录记录 -->
      <div class="account-section">
        <h2 class="section-title">登录账号</h2>
        <div class="section-row">
          <div class="row-control">
            <code class="account-id-code">{{ user?.user_id }}</code>
            <span class="row-hint">这是您的用户 ID(出问题排查用)</span>
          </div>
        </div>
      </div>

      <!-- 区块 4:注销账号 -->
      <div class="account-section danger-section">
        <h2 class="section-title danger-title">注销账号</h2>
        <p class="danger-hint">注销后账号将永久删除,所有数据无法恢复,请谨慎操作。</p>
        <div class="section-row">
          <label class="row-label">确认</label>
          <div class="row-control">
            <input
              v-model="deleteConfirm"
              type="text"
              :placeholder="`输入您的${user?.email ? '邮箱' : '手机号'}以确认`"
              class="row-input"
              :disabled="deleting"
            />
            <button
              class="row-btn danger-btn"
              :disabled="!canDelete || deleting"
              @click="deleteAccount"
            >
              {{ deleting ? '注销中...' : '永久注销' }}
            </button>
          </div>
        </div>
        <div v-if="deleteMsg" class="row-msg" :class="deleteOk ? 'ok' : 'err'">{{ deleteMsg }}</div>
      </div>

      <!-- 退出登录 -->
      <div class="account-section">
        <button class="row-btn secondary-btn" @click="logout">退出登录</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import JianheboxToolNav from './JianheboxToolNav.vue'

const router = useRouter()
const auth = useAuthStore()

const user = computed(() => auth.user)
const userInitial = computed(() => {
  const n = user.value?.name || user.value?.email || user.value?.phone || '?'
  return n[0]?.toUpperCase() || '?'
})
const providerLabel = computed(() => {
  switch (user.value?.provider) {
    case 'email': return '邮箱账号'
    case 'phone': return '手机账号'
    case 'github': return 'GitHub'
    case 'google': return 'Google'
    default: return ''
  }
})
const usedLabel = computed(() => auth.usedLabel)
const monthlyLimitLabel = computed(() => {
  const s = auth.quota?.monthly_limit_sec || 0
  const m = Math.floor(s / 60)
  if (m >= 60) return `${Math.floor(m / 60)} 小时`
  return `${m} 分钟`
})

// 🇨🇳 R57:套餐显示
const planLabel = computed(() => {
  const map: Record<string, string> = {
    plus: '⭐ Plus',
    pro: '🔥 Pro',
    studio: '💎 Studio',
  }
  return map[user.value?.plan || ''] || ''
})

function formatDate(ts?: number) {
  if (!ts) return '未知'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ========== 区块 1:昵称 ==========
const nameInput = ref('')
const updatingName = ref(false)
const nameMsg = ref('')
const nameOk = ref(false)

const canUpdateName = computed(() => {
  const newName = nameInput.value.trim()
  return newName.length > 0 && newName !== user.value?.name
})

async function updateName() {
  if (!canUpdateName.value) return
  updatingName.value = true
  nameMsg.value = ''
  try {
    await auth.updateProfile({ name: nameInput.value.trim() })
    nameOk.value = true
    nameMsg.value = '✓ 昵称已更新'
    setTimeout(() => (nameMsg.value = ''), 3000)
  } catch (e: any) {
    nameOk.value = false
    nameMsg.value = '保存失败: ' + (e?.message || '未知错误')
  } finally {
    updatingName.value = false
  }
}

// ========== 区块 2:密码 ==========
const pwdCurrent = ref('')
const pwdNew = ref('')
const pwdNew2 = ref('')
const changingPwd = ref(false)
const pwdMsg = ref('')
const pwdOk = ref(false)

const canChangePwd = computed(() => {
  if (pwdNew.value.length < 6) return false
  if (pwdNew.value !== pwdNew2.value) return false
  if (user.value?.has_password && pwdCurrent.value.length < 6) return false
  return true
})

const canSetPwd = computed(() => {
  if (pwdNew.value.length < 6) return false
  if (pwdNew.value !== pwdNew2.value) return false
  return true
})

async function changePassword() {
  if (!canChangePwd.value) return
  changingPwd.value = true
  pwdMsg.value = ''
  try {
    await auth.changePassword(pwdCurrent.value, pwdNew.value)
    pwdOk.value = true
    pwdMsg.value = '✓ 密码已修改'
    pwdCurrent.value = ''
    pwdNew.value = ''
    pwdNew2.value = ''
    setTimeout(() => (pwdMsg.value = ''), 3000)
  } catch (e: any) {
    pwdOk.value = false
    pwdMsg.value = '修改失败: ' + (e?.message || '未知错误')
  } finally {
    changingPwd.value = false
  }
}

async function setPassword() {
  if (!canSetPwd.value) return
  changingPwd.value = true
  pwdMsg.value = ''
  try {
    await auth.changePassword('', pwdNew.value)  // 手机用户无原密码
    pwdOk.value = true
    pwdMsg.value = '✓ 密码已设置'
    pwdNew.value = ''
    pwdNew2.value = ''
    setTimeout(() => (pwdMsg.value = ''), 3000)
  } catch (e: any) {
    pwdOk.value = false
    pwdMsg.value = '设置失败: ' + (e?.message || '未知错误')
  } finally {
    changingPwd.value = false
  }
}

// ========== 区块 4:注销 ==========
const deleteConfirm = ref('')
const deleting = ref(false)
const deleteMsg = ref('')
const deleteOk = ref(false)

const canDelete = computed(() => {
  if (!deleteConfirm.value) return false
  const expected = user.value?.email || user.value?.phone || ''
  return deleteConfirm.value.trim().toLowerCase() === expected.toLowerCase()
})

async function deleteAccount() {
  if (!canDelete.value) return
  if (!confirm('确定要永久注销账号吗?此操作不可恢复!')) return
  deleting.value = true
  deleteMsg.value = ''
  try {
    const body: any = {}
    if (user.value?.email) body.confirm_email = deleteConfirm.value.trim()
    if (user.value?.phone) body.confirm_phone = deleteConfirm.value.trim()
    const r = await fetch('/api/auth/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await r.json()
    if (!r.ok || !data.ok) throw new Error(data.error || '注销失败')
    deleteOk.value = true
    deleteMsg.value = '✓ 账号已注销,正在退出...'
    setTimeout(() => {
      auth.logout()
      router.push('/')
    }, 1500)
  } catch (e: any) {
    deleteOk.value = false
    deleteMsg.value = '注销失败: ' + (e?.message || '未知错误')
  } finally {
    deleting.value = false
  }
}

// ========== 退出 ==========
function logout() {
  if (!confirm('确定要退出登录吗?')) return
  auth.logout()
  router.push('/')
}

// ========== mount ==========
// 🇨🇳 R57:用 watch 代替 onMounted 里的 await,避免组件卸载后 reactivity 回调报错
let unwatchUser: (() => void) | null = null

onMounted(() => {
  // 同步 name input
  if (user.value?.name) nameInput.value = user.value.name
  // 拉最新 user 信息
  if (auth.token) {
    auth.fetchUser().then(() => {
      if (user.value?.name) nameInput.value = user.value.name
    }).catch(() => {})
  }
  // 🇨🇳 R57:watch user 变化时同步到 nameInput(组件卸载时自动停止)
  unwatchUser = watch(user, (u) => {
    if (u?.name) nameInput.value = u.name
  })
})

onUnmounted(() => {
  if (unwatchUser) unwatchUser()
})
</script>

<style scoped>
.account-page {
  min-height: 100vh;
  background: var(--bg, #0d0f17);
  padding: 16px 20px 40px;  /* 🇨🇳 R57:nav 自己 top:16,不要额外 padding-top */
  color: #fff;
}

/* 🇨🇳 R57:nav 跟下面"kyle 用户卡"之间加空隙(用 account-header 的 margin-top) */
.account-container {
  max-width: 720px;
  margin: 0 auto;
}

.account-container > .account-header {
  margin-top: 32px;  /* nav 高度 52 + 间距 32 = 84 净空 */
}

/* 顶部信息卡 */
.account-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(100, 150, 255, 0.12), rgba(150, 100, 255, 0.12));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  margin-bottom: 24px;
}

.account-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a8eff, #6cf);
  color: #fff;
  font-size: 32px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.account-info {
  flex: 1;
  min-width: 0;
}

.account-name {
  margin: 0 0 6px;
  font-size: 24px;
  color: #fff;
}

.account-id {
  margin: 0 0 8px;
  color: #ccc;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.account-tag {
  background: rgba(100, 150, 255, 0.15);
  color: #6cf;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.account-plan-badge {
  background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
  color: #1a1a1a;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 6px;
}

.account-meta {
  margin: 0;
  color: #999;
  font-size: 12px;
}

/* 区块 */
.account-section {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
}

.section-title {
  margin: 0 0 16px;
  font-size: 16px;
  color: #fff;
  font-weight: 600;
}

.danger-section {
  border-color: rgba(255, 100, 100, 0.2);
}

.danger-title {
  color: #f88;
}

.danger-hint {
  margin: 0 0 16px;
  color: #f99;
  font-size: 13px;
}

.section-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 8px;
}

.row-label {
  width: 80px;
  color: #ccc;
  font-size: 13px;
  padding-top: 8px;
  flex-shrink: 0;
}

.row-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-control-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.row-input:focus {
  outline: none;
  border-color: rgba(100, 150, 255, 0.6);
}

.row-input:disabled {
  opacity: 0.5;
}

.row-btn {
  padding: 8px 18px;
  border: 1px solid rgba(100, 150, 255, 0.4);
  background: rgba(100, 150, 255, 0.15);
  color: #6cf;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.row-btn:hover:not(:disabled) {
  background: rgba(100, 150, 255, 0.25);
  border-color: rgba(100, 150, 255, 0.6);
}

.row-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.danger-btn {
  background: rgba(255, 80, 80, 0.15);
  border-color: rgba(255, 80, 80, 0.4);
  color: #f88;
}

.danger-btn:hover:not(:disabled) {
  background: rgba(255, 80, 80, 0.25);
  border-color: rgba(255, 80, 80, 0.6);
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  color: #ccc;
  width: 100%;
}

.secondary-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.row-msg {
  margin-top: 8px;
  margin-left: 96px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.row-msg.ok {
  color: #8f8;
  background: rgba(100, 255, 100, 0.08);
}

.row-msg.err {
  color: #f88;
  background: rgba(255, 100, 100, 0.08);
}

.row-hint {
  margin: 0;
  color: #999;
  font-size: 12px;
}

.account-id-code {
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: #aaa;
}
</style>