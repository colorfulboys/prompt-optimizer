<!--
  🇨🇳 2026-09-11 R53.2:忘记密码页(无需登录)
  - 邮箱 + 6 位验证码 + 新密码 + 确认
  - 成功后提示用新密码登录(自动跳 LoginModal)
-->
<template>
  <div class="forgot-page">
    <JianheboxToolNav class="forgot-tool-nav" />

    <div class="forgot-container">
      <header class="forgot-header">
        <button class="back-link" @click="$router.back()">← 返回</button>
        <h1>📧 忘记密码</h1>
        <p class="subtitle">通过邮箱验证码重置登录密码</p>
      </header>

      <div class="forgot-card">
        <form @submit.prevent="submit" class="forgot-form">
          <!-- 步骤 1:邮箱 -->
          <div class="field">
            <label class="field-label">注册邮箱</label>
            <input
              v-model="email"
              type="email"
              class="text-input"
              placeholder="your@email.com"
              :disabled="sending || submitting || success"
              @keyup.enter="sendCode"
            />
          </div>

          <!-- 步骤 2:验证码 -->
          <div class="field">
            <label class="field-label">6 位验证码</label>
            <div class="code-row">
              <input
                v-model="code"
                type="text"
                inputmode="numeric"
                maxlength="6"
                class="text-input code-input"
                placeholder="6 位数字"
                :disabled="submitting || success"
                @keyup.enter="focusNext('newPwd')"
              />
              <button
                type="button"
                class="btn-secondary"
                :disabled="!canSend || sending || success || cooldown > 0"
                @click="sendCode"
              >
                {{ sending ? '发送中...' : cooldown > 0 ? `${cooldown}s 后重发` : (sentOnce ? '重新发送' : '发送验证码') }}
              </button>
            </div>
          </div>

          <!-- 步骤 3:新密码 -->
          <div class="field">
            <label class="field-label">新密码</label>
            <input
              ref="newPwdInput"
              v-model="newPwd"
              type="password"
              class="text-input"
              placeholder="至少 6 位"
              minlength="6"
              :disabled="submitting || success"
              @keyup.enter="focusNext('confirmPwd')"
            />
          </div>
          <div class="field">
            <label class="field-label">确认新密码</label>
            <input
              ref="confirmPwdInput"
              v-model="confirmPwd"
              type="password"
              class="text-input"
              placeholder="再输入一遍"
              minlength="6"
              :disabled="submitting || success"
            />
          </div>

          <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
          <div v-if="success" class="form-success">
            ✅ 密码已重置,3 秒后自动跳到登录页...
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn-primary"
              :disabled="!canSubmit || submitting || success"
            >
              {{ submitting ? '提交中...' : '重置密码' }}
            </button>
            <button
              type="button"
              class="btn-secondary"
              :disabled="submitting"
              @click="$router.push('/')"
            >
              取消
            </button>
          </div>

          <div class="form-hint">
            密码要求:至少 6 位。重置后请用新密码 + 邮箱验证码登录。
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import JianheboxToolNav from '@/components/JianheboxToolNav.vue'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const code = ref('')
const newPwd = ref('')
const confirmPwd = ref('')

const sending = ref(false)
const submitting = ref(false)
const sentOnce = ref(false)
const errorMsg = ref('')
const success = ref(false)
const cooldown = ref(0)

const newPwdInput = ref<HTMLInputElement | null>(null)
const confirmPwdInput = ref<HTMLInputElement | null>(null)

let cooldownTimer: ReturnType<typeof setInterval> | null = null

const canSend = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))

const canSubmit = computed(() => {
  return canSend.value
    && /^\d{6}$/.test(code.value)
    && newPwd.value.length >= 6
    && newPwd.value === confirmPwd.value
})

function startCooldown() {
  cooldown.value = 60
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

async function sendCode() {
  if (!canSend.value || sending.value || cooldown.value > 0) return
  errorMsg.value = ''
  sending.value = true
  try {
    const r = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value }),
    })
    const data: any = await r.json()
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`)
    sentOnce.value = true
    startCooldown()
  } catch (e: any) {
    errorMsg.value = '发送失败:' + (e.message || '未知错误')
  } finally {
    sending.value = false
  }
}

function focusNext(_key: 'newPwd' | 'confirmPwd') {
  if (_key === 'newPwd') {
    nextTick(() => confirmPwdInput.value?.focus())
  }
}

async function submit() {
  if (!canSubmit.value || submitting.value || success.value) return
  errorMsg.value = ''
  submitting.value = true
  try {
    await auth.forgotPassword(email.value.trim(), code.value, newPwd.value)
    success.value = true
    setTimeout(() => {
      router.push('/')
    }, 3000)
  } catch (e: any) {
    errorMsg.value = e.message || '重置失败'
  } finally {
    submitting.value = false
  }
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<style scoped>
.forgot-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0a0f 0%, #11111a 100%);
  color: var(--white, #fff);
  padding-bottom: 60px;
}
.forgot-tool-nav { margin-top: 16px; }

.forgot-container {
  max-width: 480px;
  margin: 30px auto 0;
  padding: 0 20px;
}

.forgot-header { margin-bottom: 24px; }
.back-link {
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 10px;
  font-family: inherit;
}
.back-link:hover { color: #fff; }
.forgot-header h1 {
  margin: 0 0 6px;
  font-size: 24px;
  color: #fff;
}
.subtitle {
  margin: 0;
  color: #999;
  font-size: 14px;
}

.forgot-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
}
.forgot-form { display: flex; flex-direction: column; gap: 14px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 12px;
  color: #999;
  font-weight: 500;
}
.text-input {
  padding: 11px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
}
.text-input:focus {
  outline: none;
  border-color: rgba(0, 153, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
}
.text-input:disabled { opacity: 0.5; }

.code-row {
  display: flex;
  gap: 8px;
}
.code-input { flex: 1; }

.form-error {
  color: #f88;
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}
.form-success {
  color: #6c6;
  background: rgba(100, 200, 100, 0.08);
  border: 1px solid rgba(100, 200, 100, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.btn-primary {
  padding: 10px 18px;
  background: #09f;
  border: 1px solid #09f;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  flex: 1;
  transition: background 0.15s ease;
}
.btn-primary:hover:not(:disabled) {
  background: #0086e6;
  border-color: #0086e6;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #ddd;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
}
.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(0, 153, 255, 0.6);
}
.btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

.form-hint {
  font-size: 11px;
  color: #888;
}

@media (max-width: 600px) {
  .forgot-container { padding: 0 16px; }
  .code-row { flex-direction: column; }
  .form-actions { flex-direction: column; }
}
</style>
