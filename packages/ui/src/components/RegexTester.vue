<template>
  <div class="regex-page">
    <header class="page-header">
      <h1>🔍 正则表达式测试器</h1>
      <p class="subtitle">实时高亮匹配，支持捕获组，所有计算在浏览器本地完成</p>
    </header>

    <div class="regex-form">
      <div class="form-row">
        <label>正则表达式</label>
        <div class="pattern-input-wrap">
          <span class="slash">/</span>
          <input
            v-model="pattern"
            type="text"
            placeholder="例如：[a-z]+"
            class="pattern-input"
            @input="onTest"
          />
          <span class="slash">/</span>
          <input
            v-model="flags"
            type="text"
            placeholder="flags"
            class="flags-input"
            maxlength="6"
            @input="onTest"
          />
        </div>
        <div v-if="errorMsg" class="error-msg">⚠️ {{ errorMsg }}</div>
      </div>

      <div class="form-row">
        <label>测试文本</label>
        <textarea
          v-model="text"
          class="text-input"
          placeholder="在此粘贴需要测试的文本..."
          @input="onTest"
        ></textarea>
      </div>

      <div class="form-row">
        <label>
          高亮预览
          <span class="match-count">{{ matchCount }} 个匹配</span>
        </label>
        <div class="highlight-output" v-html="highlightedHtml"></div>
      </div>

      <div v-if="matches.length" class="form-row">
        <label>匹配详情</label>
        <div class="matches-table">
          <div class="match-row match-header">
            <div>#</div>
            <div>位置</div>
            <div>匹配内容</div>
          </div>
          <div v-for="(m, i) in matches" :key="i" class="match-row">
            <div>{{ i + 1 }}</div>
            <div>{{ m.index }}-{{ (m.index ?? 0) + m[0].length }}</div>
            <div class="match-content">{{ m[0] }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="quick-examples">
      <h3>💡 常用正则</h3>
      <div class="example-chips">
        <button v-for="ex in examples" :key="ex.label" class="chip" @click="applyExample(ex)">
          {{ ex.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const pattern = ref('')
const flags = ref('g')
const text = ref('')
const errorMsg = ref('')
const matches = ref<RegExpExecArray[]>([])

const examples = [
  { label: '邮箱', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+', flags: 'g' },
  { label: '手机号', pattern: '1[3-9]\\d{9}', flags: 'g' },
  { label: 'URL', pattern: 'https?://[\\w.-]+(?:\\.[\\w.-]+)+[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]*', flags: 'g' },
  { label: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g' },
  { label: '日期 YYYY-MM-DD', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g' },
  { label: '身份证', pattern: '\\d{17}[\\dXx]', flags: 'g' },
  { label: '中文字符', pattern: '[\\u4e00-\\u9fa5]+', flags: 'g' }
]

function applyExample(ex: { pattern: string; flags: string }) {
  pattern.value = ex.pattern
  flags.value = ex.flags
  onTest()
}

function onTest() {
  errorMsg.value = ''
  matches.value = []
  if (!pattern.value) {
    errorMsg.value = ''
    return
  }
  try {
    const re = new RegExp(pattern.value, flags.value)
    if (flags.value.includes('g')) {
      const collected: RegExpExecArray[] = []
      let m: RegExpExecArray | null
      while ((m = re.exec(text.value)) !== null) {
        collected.push(m)
        if (m.index === re.lastIndex) re.lastIndex++ // 防止零宽死循环
      }
      matches.value = collected
    } else {
      const m = re.exec(text.value)
      if (m) matches.value = [m]
    }
  } catch (e: any) {
    errorMsg.value = `正则语法错误：${e?.message || String(e)}`
  }
}

const matchCount = computed(() => matches.value.length)

const highlightedHtml = computed(() => {
  if (!pattern.value || matches.value.length === 0) {
    return escapeHtml(text.value).replace(/\n/g, '<br>')
  }
  try {
    const re = new RegExp(pattern.value, flags.value.includes('g') ? flags.value : flags.value + 'g')
    return escapeHtml(text.value).replace(re, (match) => `<mark>${escapeHtml(match)}</mark>`).replace(/\n/g, '<br>')
  } catch {
    return escapeHtml(text.value)
  }
})

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
}
</script>

<style scoped>
.regex-page { max-width: 1000px; margin: 0 auto; padding: 24px; }
.page-header h1 { margin: 0 0 8px 0; font-size: 28px; }
.subtitle { margin: 0 0 24px 0; color: #666; }
.regex-form { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0; }
.form-row { margin-bottom: 16px; }
.form-row label { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 13px; margin-bottom: 6px; }
.match-count { color: #2563eb; font-weight: 400; font-size: 12px; }
.pattern-input-wrap { display: flex; align-items: center; gap: 4px; background: #f7f7f7; padding: 8px; border-radius: 6px; border: 1px solid #ddd; }
.slash { color: #999; font-family: monospace; font-size: 16px; }
.pattern-input { flex: 1; border: none; background: transparent; font-family: monospace; font-size: 14px; outline: none; padding: 4px; }
.flags-input { width: 60px; border: none; background: transparent; font-family: monospace; font-size: 14px; outline: none; padding: 4px; border-left: 1px solid #ddd; }
.text-input { width: 100%; min-height: 180px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-family: monospace; font-size: 13px; resize: vertical; outline: none; box-sizing: border-box; }
.highlight-output { min-height: 100px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; background: #fafafa; font-family: monospace; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-all; }
.highlight-output :deep(mark) { background: #fef08a; padding: 1px 3px; border-radius: 2px; color: #1f2937; }
.matches-table { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; max-height: 300px; overflow-y: auto; }
.match-row { display: grid; grid-template-columns: 50px 100px 1fr; padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; align-items: center; }
.match-header { background: #f7f7f7; font-weight: 600; }
.match-content { font-family: monospace; word-break: break-all; }
.error-msg { color: #c00; font-size: 12px; margin-top: 4px; }
.quick-examples { margin-top: 24px; }
.quick-examples h3 { margin: 0 0 12px 0; }
.example-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { background: white; border: 1px solid #ddd; padding: 6px 12px; border-radius: 16px; cursor: pointer; font-size: 13px; }
.chip:hover { background: #f1f5f9; border-color: #94a3b8; }
</style>