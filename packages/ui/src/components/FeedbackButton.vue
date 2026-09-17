<!--
  🇨🇳 2026-09-01:feedback.title按钮 + 弹窗

  使用:在 footer 加 `<FeedbackButton />` → 点击弹窗 → 提交留言 → POST /api/feedback

  重要:不用 naive-ui 的 useMessage(需 n-message-provider 包,这里没有),改用本地 toast 状态
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { NModal, NInput, NButton, NSpace, NCheckbox } from 'naive-ui'

const showModal = ref(false)
const content = ref('')
const email = ref('')
const includeEmail = ref(false)
const submitting = ref(false)
const cooldownLeft = ref(0)

// 本地 toast 状态(替代 useMessage)
const toast = ref<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)
let toastTimer: number | undefined
function showToast(type: 'success' | 'error' | 'warning', text: string, durationMs = 3000) {
  toast.value = { type, text }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = null }, durationMs)
}

const page = computed(() => {
  if (typeof window === 'undefined') return 'unknown'
  return window.location.pathname + window.location.hash
})

function open() {
  showModal.value = true
  if (cooldownLeft.value > 0) {
    showToast('warning', t('feedback.cooldown', { min: Math.ceil(cooldownLeft.value / 60) }))
  }
}

function close() {
  if (submitting.value) return
  showModal.value = false
}

async function submit() {
  if (!content.value.trim()) {
    showToast('error', t('feedback.emptyContent'))
    return
  }
  if (content.value.length > 2000) {
    showToast('error', 'feedback.tooLong')
    return
  }
  if (includeEmail.value && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email.value)) {
    showToast('error', 'feedback.invalidEmail')
    return
  }

  submitting.value = true
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content.value.trim(),
        email: includeEmail.value ? email.value.trim() : '',
        page: page.value,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast('error', data.error || t('feedback.submitFailed', { code: res.status }))
      if (res.status === 429) {
        cooldownLeft.value = 5 * 60
        const tick = setInterval(() => {
          cooldownLeft.value -= 1
          if (cooldownLeft.value <= 0) clearInterval(tick)
        }, 1000)
      }
      return
    }
    showToast('success', '留言已发送,感谢您的反馈！')
    content.value = ''
    email.value = ''
    includeEmail.value = false
    showModal.value = false
  } catch (e) {
    showToast('error', '网络错误,请稍后再试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <span class="feedback-button-wrap">
    <button class="feedback-button" @click="open" type="button">
      💬 feedback.title
    </button>

    <NModal v-model:show="showModal" preset="card" title="feedback.title" style="max-width: 560px">
      <NSpace vertical :size="14">
        <div class="feedback-hint">
          遇到问题或有建议?留言给我们,会发送到团队邮箱,我们会尽快查看。
        </div>

        <NInput
          v-model:value="content"
          type="textarea"
          placeholder="请描述您遇到的问题或建议...(最多 2000 字)"
          :rows="6"
          :maxlength="2000"
          show-count
          :autosize="{ minRows: 6, maxRows: 12 }"
        />

        <div class="feedback-email-row">
          <NCheckbox v-model:checked="includeEmail">
            留下邮箱(我们可能回复您)
          </NCheckbox>
          <NInput
            v-if="includeEmail"
            v-model:value="email"
            placeholder="您的邮箱"
            size="small"
            style="margin-top: 8px"
          />
        </div>
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="close" :disabled="submitting">取消</NButton>
          <NButton
            type="primary"
            @click="submit"
            :loading="submitting"
            :disabled="!content.trim() || cooldownLeft > 0"
          >
            {{ cooldownLeft > 0 ? `${Math.ceil(cooldownLeft / 60)} 分钟后可再发` : '提交反馈' }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 本地 toast -->
    <Transition name="feedback-fade">
      <div v-if="toast" :class="['feedback-toast', `feedback-toast-${toast.type}`]">
        {{ toast.text }}
      </div>
    </Transition>
  </span>
</template>

<style scoped>
.feedback-button-wrap {
  display: inline-block;
  position: relative;
}
.feedback-button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  margin: 0;
  font-size: inherit;
  text-decoration: none;
  transition: color 0.2s;
}
.feedback-button:hover {
  color: var(--color-primary, #2563eb);
  text-decoration: underline;
}
.feedback-hint {
  font-size: 13px;
  color: var(--color-text-3, #888);
  line-height: 1.6;
}
.feedback-email-row {
  font-size: 13px;
}

.feedback-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  pointer-events: none;
}
.feedback-toast-success {
  background: #18a058;
  color: #fff;
}
.feedback-toast-error {
  background: #d03050;
  color: #fff;
}
.feedback-toast-warning {
  background: #f0a020;
  color: #fff;
}
.feedback-fade-enter-active,
.feedback-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.feedback-fade-enter-from,
.feedback-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>