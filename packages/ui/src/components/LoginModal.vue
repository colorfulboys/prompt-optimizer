<!--
  🇨🇳 R57 2026-09-11:登录弹框(支持邮箱 + 手机)
  - 顶部切换 tab:邮箱 / 手机
  - 邮箱 tab:邮箱 + {{ t('login.password') }}
  - 手机 tab:手机号 + 短信验证码
  - 底部「{{ t('login.goRegister') }}」「忘记{{ t('login.password') }}?」链接
-->
<template>
  <Teleport to="body">
    <div v-if="show" class="login-modal-backdrop" @click.self="close">
      <div class="login-modal">
        <button class="login-modal-close" @click="close" aria-label="✕">×</button>

        <h2 class="login-modal-title">{{ t('login.title') }}</h2>
        <p class="login-modal-sub">{{ channel === 'email' ? t('login.emailHint') : t('login.phoneHint') }}</p>

        <!-- 顶部切换 tab -->
        <div class="login-channel-tabs">
          <button
            class="login-channel-tab"
            :class="{ active: channel === 'email' }"
            @click="switchChannel('email')"
          >{{ t('login.emailTab') }}</button>
          <button
            class="login-channel-tab"
            :class="{ active: channel === 'phone' }"
            @click="switchChannel('phone')"
          >{{ t('login.phoneTab') }}</button>
        </div>

        <!-- {{ t('login.emailTab') }} -->
        <div v-if="channel === 'email'" class="login-section">
          <label class="login-label">邮箱</label>
          <input
            v-model="email"
            type="email"
            placeholder="your@email.com"
            class="login-input"
            :disabled="submitting"
            @keyup.enter="doLogin"
          />

          <label class="login-label">{{ t('login.password') }}</label>
          <input
            v-model="password"
            type="password"
            placeholder="••••••"
            class="login-input"
            :disabled="submitting"
            @keyup.enter="doLogin"
          />

          <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>

          <button
            class="btn btn-primary btn-block"
            :disabled="!canSubmitEmail || submitting"
            @click="doLogin"
          >
            {{ submitting ? 'login.submitting' : '登录' }}
          </button>

          <div class="login-links">
            <button class="link-btn" @click="openForgot">忘记{{ t('login.password') }}?</button>
            <button class="link-btn" @click="openRegister">{{ t('login.goRegister') }}</button>
          </div>
        </div>

        <!-- {{ t('login.phoneTab') }} -->
        <div v-else class="login-section">
          <label class="login-label">手机号</label>
          <input
            v-model="phone"
            type="tel"
            inputmode="numeric"
            placeholder="11 位手机号"
            class="login-input"
            :disabled="submitting"
            @keyup.enter="doLogin"
          />

          <label class="login-label">短信验证码</label>
          <div class="login-row">
            <input
              v-model="smsCode"
              type="text"
              inputmode="numeric"
              placeholder="短信验证码"
              class="login-input"
              :disabled="submitting"
              @keyup.enter="doLogin"
            />
            <button
              class="btn btn-secondary btn-sm"
              :disabled="!canSendSms || submitting || smsCooldown > 0"
              @click="sendSms"
            >
              {{ smsCooldown > 0 ? smsCooldown + 's' : t('login.sendCode') }}
            </button>
          </div>

          <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>

          <button
            class="btn btn-primary btn-block"
            :disabled="!canSubmitPhone || submitting"
            @click="doLogin"
          >
            {{ submitting ? t('login.submitting') : t('login.submit') }}
          </button>

          <div class="login-links">
            <button class="link-btn" @click="openRegister">{{ t('login.goRegister') }}</button>
          </div>
        </div>

        <p class="login-terms">
          {{ t('login.termsHint') }} <a href="#">{{ t('login.terms') }}</a> {{ t('login.and') }} <a href="#">{{ t('login.privacy') }}</a>
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  close: []
  success: []
  openRegister: []
  openForgot: []
}>()

const auth = useAuthStore()

// ========== 状态 ==========
type Channel = 'email' | 'phone'
const channel = ref<Channel>('email')

// 邮箱
const email = ref('')
const password = ref('')

// 手机
const phone = ref('')
const smsCode = ref('')
const smsCooldown = ref(0)
let smsCooldownTimer: ReturnType<typeof setInterval> | null = null

// 通用
const submitting = ref(false)
const errorMsg = ref('')

// ========== 计算属性 ==========
const canSubmitEmail = computed(() => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return false
  if (password.value.length < 6) return false
  return true
})

const canSendSms = computed(() => /^1[3-9]\d{9}$/.test(phone.value))

const canSubmitPhone = computed(() => {
  if (!/^1[3-9]\d{9}$/.test(phone.value)) return false
  if (smsCode.value.length < 4) return false
  return true
})

// ========== Actions ==========

async function sendSms() {
  if (!canSendSms.value) return
  errorMsg.value = ''
  submitting.value = true
  try {
    const r = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.value }),
    })
    const data: any = await r.json()
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`)
    smsCooldown.value = 60
    if (smsCooldownTimer) clearInterval(smsCooldownTimer)
    smsCooldownTimer = setInterval(() => {
      smsCooldown.value -= 1
      if (smsCooldown.value <= 0 && smsCooldownTimer) {
        clearInterval(smsCooldownTimer)
        smsCooldownTimer = null
      }
    }, 1000)
  } catch (e: any) {
    errorMsg.value = '发送失败: ' + e.message
  } finally {
    submitting.value = false
  }
}

async function doLogin() {
  errorMsg.value = ''
  if (channel.value === 'email') {
    if (!canSubmitEmail.value) return
    submitting.value = true
    try {
      await auth.loginWithPassword(email.value, password.value)
      emit('success')
      close()
    } catch (e: any) {
      errorMsg.value = '登录失败: ' + (e?.message || '邮箱或密码错误')
    } finally {
      submitting.value = false
    }
  } else {
    if (!canSubmitPhone.value) return
    submitting.value = true
    try {
      // 手机验证码登录走 verify-code(后端自动创建/查账号)
      const r = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.value, code: smsCode.value }),
      })
      const data: any = await r.json()
      if (!r.ok || !data.ok) throw new Error(data.error || '验证码错误')
      // 存 token + user
      auth.setTokenAndUser(data.token, data.user)
      emit('success')
      close()
    } catch (e: any) {
      errorMsg.value = '登录失败: ' + (e?.message || '验证码错误')
    } finally {
      submitting.value = false
    }
  }
}

function switchChannel(ch: Channel) {
  channel.value = ch
  errorMsg.value = ''
}

function close() {
  emit('close')
}

function openRegister() {
  emit('openRegister')
}

function openForgot() {
  emit('openForgot')
}

// 重置
watch(() => props.show, (v) => {
  if (v) {
    password.value = ''
    smsCode.value = ''
    errorMsg.value = ''
    smsCooldown.value = 0
    if (smsCooldownTimer) {
      clearInterval(smsCooldownTimer)
      smsCooldownTimer = null
    }
  }
})
</script>

<style scoped>
.login-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.login-modal {
  position: relative;
  background: var(--card-bg, #1a1d29);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 32px 28px;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.login-modal-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
  padding: 0 8px;
}

.login-modal-close:hover {
  color: #fff;
}

.login-modal-title {
  margin: 0 0 4px;
  font-size: 22px;
  color: #fff;
  text-align: center;
}

.login-modal-sub {
  margin: 0 0 16px;
  color: #aaa;
  font-size: 13px;
  text-align: center;
}

.login-channel-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 3px;
}

.login-channel-tab {
  flex: 1;
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 13px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.login-channel-tab.active {
  background: rgba(100, 150, 255, 0.18);
  color: #6cf;
  font-weight: 500;
}

.login-channel-tab:hover:not(.active) {
  color: #ccc;
  background: rgba(255, 255, 255, 0.04);
}

.login-section {
  margin-bottom: 12px;
}

.login-label {
  display: block;
  color: #ccc;
  font-size: 13px;
  margin-bottom: 6px;
}

.login-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.login-row .login-input {
  margin-bottom: 0;
}

.login-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  margin-bottom: 12px;
  box-sizing: border-box;
}

.login-input:focus {
  outline: none;
  border-color: rgba(100, 150, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
}

.login-input:disabled {
  opacity: 0.5;
}

.login-error {
  color: #f88;
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 12px;
}

.login-links {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  padding: 0 4px;
}

.link-btn {
  background: transparent;
  border: none;
  color: #6cf;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  font-family: inherit;
}

.link-btn:hover {
  text-decoration: underline;
  color: #8df;
}

.login-terms {
  margin: 16px 0 0;
  text-align: center;
  font-size: 11px;
  color: #777;
}

.login-terms a {
  color: #6cf;
  text-decoration: none;
}

.login-terms a:hover {
  text-decoration: underline;
}
</style>