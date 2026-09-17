<!--
  🇨🇳 R56 2026-09-11:注册弹框(2 步 2 屏,参照 GitHub / 阿里云)
  Step 1: 邮箱 + 收验证码 + 输验证码 + 「下一步」
  Step 2: 密码 + 确认密码 + 「注册」
  成功后关闭弹框,触发 openLogin 事件,登录页显示提示
-->
<template>
  <Teleport to="body">
    <div v-if="show" class="reg-modal-backdrop" @click.self="close">
      <div class="reg-modal">
        <button class="reg-modal-close" @click="close">×</button>

        <h2 class="reg-modal-title">创建账号</h2>
        <p class="reg-modal-sub">{{ step === 1 ? '第一步:验证您的邮箱' : '第二步:设置密码' }}</p>

        <!-- 步骤指示器 -->
        <div class="reg-steps">
          <div class="reg-step-dot" :class="{ active: step >= 1, done: step > 1 }">1</div>
          <div class="reg-step-line" :class="{ done: step > 1 }"></div>
          <div class="reg-step-dot" :class="{ active: step >= 2 }">2</div>
        </div>

        <!-- Step 1: 邮箱 + 验证码 -->
        <div v-if="step === 1" class="reg-section">
          <label class="reg-label">邮箱</label>
          <div class="reg-row">
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="reg-input"
              :disabled="submitting"
            />
          </div>

          <label class="reg-label">邮箱验证码</label>
          <div class="reg-row">
            <input
              v-model="code"
              type="text"
              inputmode="numeric"
              placeholder="6 位数字"
              class="reg-input"
              maxlength="6"
              :disabled="submitting"
              @keyup.enter="nextStep"
            />
            <button
              class="btn btn-secondary btn-sm"
              :disabled="!canSendCode || submitting || cooldown > 0"
              @click="sendCode"
            >
              {{ cooldown > 0 ? `${cooldown}s 后重发` : '收验证码' }}
            </button>
          </div>

          <div v-if="errorMsg" class="reg-error">{{ errorMsg }}</div>
          <div v-if="debugCode && provider === 'mock'" class="reg-debug">
            🛠 Mock 验证码: <strong>{{ debugCode }}</strong>
          </div>

          <button
            class="btn btn-primary btn-block"
            :disabled="!canNext || submitting"
            @click="nextStep"
          >
            {{ submitting ? '验证中...' : '下一步' }}
          </button>
        </div>

        <!-- Step 2: 密码 -->
        <div v-else class="reg-section">
          <label class="reg-label">密码(至少 6 位)</label>
          <input
            v-model="password"
            type="password"
            placeholder="设置您的密码"
            class="reg-input"
            :disabled="submitting"
            @keyup.enter="doRegister"
          />

          <label class="reg-label">确认密码</label>
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="再输一次"
            class="reg-input"
            :disabled="submitting"
            @keyup.enter="doRegister"
          />

          <div v-if="confirmError" class="reg-error">{{ confirmError }}</div>

          <button
            class="btn btn-primary btn-block"
            :disabled="!canRegister || submitting"
            @click="doRegister"
          >
            {{ submitting ? '注册中...' : '注册' }}
          </button>

          <button class="link-btn" @click="step = 1" :disabled="submitting">← 返回上一步</button>
        </div>

        <div class="reg-bottom">
          <span class="reg-bottom-text">已有账号?</span>
          <button class="link-btn" @click="emit('openLogin')">去登录</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  show: boolean
}>()
const emit = defineEmits<{
  close: []
  openLogin: []
  success: []
}>()

const auth = useAuthStore()

// ========== Step 1 ==========
const code = ref('')
const sending = ref(false)
const errorMsg = ref('')
const debugCode = ref('')
const provider = ref<'smtp' | 'aliyun' | 'mock' | ''>('')
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

// ========== Step 2 ==========
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const confirmError = ref('')

// ========== 共用 ==========
const email = ref('')
const step = ref<1 | 2>(1)

const canSendCode = computed(() => {
  if (cooldown.value > 0) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
})

const canNext = computed(() => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return false
  if (!/^\d{6}$/.test(code.value)) return false
  return true
})

const canRegister = computed(() => {
  if (password.value.length < 6) return false
  if (password.value !== confirmPassword.value) return false
  return true
})

// ========== Actions ==========

async function sendCode() {
  if (!canSendCode.value) return
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
    provider.value = data.provider
    if (data.debugCode && data.provider === 'mock') {
      debugCode.value = data.debugCode
      code.value = data.debugCode
    }
    cooldown.value = 60
    if (cooldownTimer) clearInterval(cooldownTimer)
    cooldownTimer = setInterval(() => {
      cooldown.value -= 1
      if (cooldown.value <= 0 && cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }, 1000)
  } catch (e: any) {
    errorMsg.value = '发送失败: ' + e.message
  } finally {
    sending.value = false
  }
}

async function nextStep() {
  if (!canNext.value) return
  errorMsg.value = ''
  sending.value = true
  try {
    // 调用 verify-code 让后端校验验证码
    const r = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, code: code.value }),
    })
    const data: any = await r.json()
    if (!r.ok || !data.ok) throw new Error(data.error || '验证码错误')
    // 验证码正确,进入 step 2
    step.value = 2
    password.value = ''
    confirmPassword.value = ''
    confirmError.value = ''
  } catch (e: any) {
    errorMsg.value = e.message
  } finally {
    sending.value = false
  }
}

async function doRegister() {
  if (!canRegister.value) return
  confirmError.value = ''
  if (password.value !== confirmPassword.value) {
    confirmError.value = '两次密码不一致'
  }
  submitting.value = true
  try {
    // 调用 setPasswordAfterRegister 设置密码(走 reset-password 接口,验证码已经在 step 1 校验过)
    await auth.setPasswordAfterRegister(email.value, code.value, password.value)
    emit('success')
    emit('openLogin')
    close()
  } catch (e: any) {
    confirmError.value = '注册失败: ' + (e?.message || '未知错误')
  } finally {
    submitting.value = false
  }
}

function close() {
  emit('close')
}

// 重置
watch(() => props.show, (v) => {
  if (v) {
    step.value = 1
    email.value = ''
    code.value = ''
    password.value = ''
    confirmPassword.value = ''
    errorMsg.value = ''
    debugCode.value = ''
    provider.value = ''
    confirmError.value = ''
    cooldown.value = 0
    if (cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }
})
</script>

<style scoped>
.reg-modal-backdrop {
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

.reg-modal {
  position: relative;
  background: var(--card-bg, #1a1d29);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 32px 28px;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.reg-modal-close {
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

.reg-modal-close:hover {
  color: #fff;
}

.reg-modal-title {
  margin: 0 0 4px;
  font-size: 22px;
  color: #fff;
  text-align: center;
}

.reg-modal-sub {
  margin: 0 0 16px;
  color: #aaa;
  font-size: 13px;
  text-align: center;
}

.reg-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.reg-step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.reg-step-dot.active {
  background: #4a8eff;
  color: #fff;
  border-color: #4a8eff;
}

.reg-step-dot.done {
  background: #2a4;
  color: #fff;
  border-color: #2a4;
}

.reg-step-line {
  width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 8px;
}

.reg-step-line.done {
  background: #2a4;
}

.reg-section {
  margin-bottom: 12px;
}

.reg-label {
  display: block;
  color: #ccc;
  font-size: 13px;
  margin-bottom: 6px;
}

.reg-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.reg-input {
  flex: 1;
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

.reg-row .reg-input {
  margin-bottom: 0;
}

.reg-input:focus {
  outline: none;
  border-color: rgba(100, 150, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
}

.reg-input:disabled {
  opacity: 0.5;
}

.reg-error {
  color: #f88;
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 12px;
}

.reg-debug {
  color: #fc6;
  background: rgba(255, 200, 100, 0.1);
  border: 1px solid rgba(255, 200, 100, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  margin-bottom: 12px;
  font-family: monospace;
}

.reg-debug strong {
  color: #ff8;
  letter-spacing: 4px;
  font-size: 16px;
}

.reg-bottom {
  margin-top: 14px;
  text-align: center;
  color: #aaa;
  font-size: 13px;
}

.reg-bottom-text {
  margin-right: 6px;
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

.link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>