<!--
  🇨🇳 R56 2026-09-11:忘记密码弹框(2 步 2 屏,参照 GitHub / 阿里云)
  Step 1: 邮箱 + 收验证码 + 输验证码 + 「下一步」
  Step 2: 新密码 + 确认密码 + 「重置密码」
  成功后关闭弹框,触发 openLogin 事件,登录页显示提示
-->
<template>
  <Teleport to="body">
    <div v-if="show" class="fp-modal-backdrop" @click.self="close">
      <div class="fp-modal">
        <button class="fp-modal-close" @click="close">×</button>

        <h2 class="fp-modal-title">重置密码</h2>
        <p class="fp-modal-sub">{{ step === 1 ? '第一步:验证您的邮箱' : '第二步:设置新密码' }}</p>

        <!-- 步骤指示器 -->
        <div class="fp-steps">
          <div class="fp-step-dot" :class="{ active: step >= 1, done: step > 1 }">1</div>
          <div class="fp-step-line" :class="{ done: step > 1 }"></div>
          <div class="fp-step-dot" :class="{ active: step >= 2 }">2</div>
        </div>

        <!-- Step 1: 邮箱 + 验证码 -->
        <div v-if="step === 1" class="fp-section">
          <label class="fp-label">邮箱</label>
          <input
            v-model="email"
            type="email"
            placeholder="your@email.com"
            class="fp-input"
            :disabled="submitting"
          />

          <label class="fp-label">邮箱验证码</label>
          <div class="fp-row">
            <input
              v-model="code"
              type="text"
              inputmode="numeric"
              placeholder="6 位数字"
              class="fp-input"
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

          <div v-if="errorMsg" class="fp-error">{{ errorMsg }}</div>
          <div v-if="debugCode && provider === 'mock'" class="fp-debug">
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

        <!-- Step 2: 新密码 -->
        <div v-else class="fp-section">
          <label class="fp-label">新密码(至少 6 位)</label>
          <input
            v-model="newPassword"
            type="password"
            placeholder="设置新密码"
            class="fp-input"
            :disabled="submitting"
            @keyup.enter="doReset"
          />

          <label class="fp-label">确认新密码</label>
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="再输一次"
            class="fp-input"
            :disabled="submitting"
            @keyup.enter="doReset"
          />

          <div v-if="confirmError" class="fp-error">{{ confirmError }}</div>

          <button
            class="btn btn-primary btn-block"
            :disabled="!canReset || submitting"
            @click="doReset"
          >
            {{ submitting ? '重置中...' : '重置密码' }}
          </button>

          <button class="link-btn" @click="step = 1" :disabled="submitting">← 返回上一步</button>
        </div>

        <div class="fp-bottom">
          <span class="fp-bottom-text">记起密码了?</span>
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
const newPassword = ref('')
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

const canReset = computed(() => {
  if (newPassword.value.length < 6) return false
  if (newPassword.value !== confirmPassword.value) return false
  return true
})

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
    // 这里只校验邮箱格式和验证码对不对
    // 后端没有单独的「check-code」接口,这里调 verify-code 来验证
    // 但 verify-code 会创建账号/登录,所以用 send-code 后端应该单独走流程
    // 简化:前端已经验证邮箱格式,验证码长度对就允许下一步
    // 后端的 reset-password 接口会再次校验
    step.value = 2
    newPassword.value = ''
    confirmPassword.value = ''
    confirmError.value = ''
  } catch (e: any) {
    errorMsg.value = e.message
  } finally {
    sending.value = false
  }
}

async function doReset() {
  if (!canReset.value) return
  if (newPassword.value !== confirmPassword.value) {
    confirmError.value = '两次密码不一致'
    return
  }
  confirmError.value = ''
  submitting.value = true
  try {
    await auth.resetPasswordWithCode(email.value, code.value, newPassword.value)
    emit('success')
    emit('openLogin')
    close()
  } catch (e: any) {
    confirmError.value = '重置失败: ' + (e?.message || '验证码或密码不符合要求')
  } finally {
    submitting.value = false
  }
}

function close() {
  emit('close')
}

watch(() => props.show, (v) => {
  if (v) {
    step.value = 1
    email.value = ''
    code.value = ''
    newPassword.value = ''
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
/* 样式和 RegisterModal 一致 */
.fp-modal-backdrop,
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

.fp-modal {
  position: relative;
  background: var(--card-bg, #1a1d29);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 32px 28px;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.fp-modal-close {
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

.fp-modal-close:hover {
  color: #fff;
}

.fp-modal-title {
  margin: 0 0 4px;
  font-size: 22px;
  color: #fff;
  text-align: center;
}

.fp-modal-sub {
  margin: 0 0 16px;
  color: #aaa;
  font-size: 13px;
  text-align: center;
}

.fp-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.fp-step-dot {
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

.fp-step-dot.active {
  background: #4a8eff;
  color: #fff;
  border-color: #4a8eff;
}

.fp-step-dot.done {
  background: #2a4;
  color: #fff;
  border-color: #2a4;
}

.fp-step-line {
  width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 8px;
}

.fp-step-line.done {
  background: #2a4;
}

.fp-section {
  margin-bottom: 12px;
}

.fp-label {
  display: block;
  color: #ccc;
  font-size: 13px;
  margin-bottom: 6px;
}

.fp-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.fp-input {
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

.fp-row .fp-input {
  margin-bottom: 0;
}

.fp-input:focus {
  outline: none;
  border-color: rgba(100, 150, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
}

.fp-input:disabled {
  opacity: 0.5;
}

.fp-error {
  color: #f88;
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 12px;
}

.fp-debug {
  color: #fc6;
  background: rgba(255, 200, 100, 0.1);
  border: 1px solid rgba(255, 200, 100, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  margin-bottom: 12px;
  font-family: monospace;
}

.fp-debug strong {
  color: #ff8;
  letter-spacing: 4px;
  font-size: 16px;
}

.fp-bottom {
  margin-top: 14px;
  text-align: center;
  color: #aaa;
  font-size: 13px;
}

.fp-bottom-text {
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