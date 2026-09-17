<!--
  🇨🇳 R47.5:Tab 1 - 转写(完整版)
  - 接 useUserPlan store
  - 配额用完 → 弹 PaywallDialog
  - 续费逻辑(只能 1 次 30 分)
-->
<template>
  <div class="transcribe-tab">
    <div class="tab-intro">
      <h2>🎙 音频转文字</h2>
      <p>阿里云智能语音识别 · 中文准确率高 · 导出 SRT/Word/TXT</p>
    </div>

    <!-- 🇨🇳 R47.5:未登录拦截 -->
    <div v-if="!auth.isLoggedIn" class="login-required">
      <div class="login-icon">🔒</div>
      <h3>登录后才能使用转写</h3>
      <p>新用户免费使用</p>
      <button class="btn-primary" @click="triggerLogin">立即登录</button>
    </div>

    <!-- 已登录:文件上传区 -->
    <div v-else class="upload-zone">
      <h3>1️⃣ 选音频</h3>
      <div class="drop-area" :class="{ dragging: isDragging }"
           @dragover.prevent="isDragging = true"
           @dragleave="isDragging = false"
           @drop.prevent="onDrop">
        <input ref="fileInput" type="file" accept="audio/*" hidden @change="onFilePick" />
        <p v-if="!selectedFile">📁 拖拽音频到这里 或 <a href="#" @click.prevent="fileInput?.click()">点此选择</a></p>
        <p v-else>✅ {{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})</p>
      </div>

      <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="startTranscribe">
        {{ isProcessing ? '转写中...' : '开始转写' }}
      </button>

      <!-- 🇨🇳 R49.5:转写结果(可编辑 + 批量替换 + 下载 + 重新转写) -->
      <div v-if="result" class="result-zone">
        <h3>2️⃣ 转写结果</h3>
        <div class="result-meta">
          <span>耗时 {{ result.elapsed }}s · 音频 {{ result.durationSec }}s</span>
          <span class="result-status">{{ formatStatus(result.status) }}</span>
        </div>

        <!-- 🇨🇳 R49.6:句子明细(让用户知道阿里云 ASR 识别了多少句) -->
        <details v-if="result.sentences.length > 0" class="sentence-details">
          <summary>📋 查看 {{ result.sentences.length }} 个时间码片段</summary>
          <ol class="sentence-list">
            <li v-for="(s, i) in result.sentences" :key="i">
              <span class="time-code">[{{ fmtSrtTime(s.begin_time ?? s.BeginTime ?? 0) }} → {{ fmtSrtTime(s.end_time ?? s.EndTime ?? 0) }}]</span>
              <span class="sentence-text">{{ s.text ?? s.Text ?? '' }}</span>
            </li>
          </ol>
        </details>

        <!-- 🇨🇳 R49.5:重新转写按钮(避免不能换文件) -->
        <div class="result-topbar">
          <button class="btn-secondary" @click="resetForNext">🔄 重新转写</button>
          <span v-if="result.consumedSec > 0" class="consumed-info">本次扣减 {{ result.consumedSec }}s(本月剩余 {{ userPlan.transcribeRemainingMin }} 分钟)</span>
        </div>

        <!-- 🇨🇳 R49.4:批量替换工具栏(R47 找回) -->
        <div class="replace-bar">
          <input
            v-model="replaceFrom"
            class="replace-input"
            placeholder="查找内容"
            @keyup.enter="applyReplace"
          />
          <span class="replace-arrow">→</span>
          <input
            v-model="replaceTo"
            class="replace-input"
            placeholder="替换为(留空=删除)"
            @keyup.enter="applyReplace"
          />
          <label class="replace-regex">
            <input type="checkbox" v-model="useRegex" /> 正则
          </label>
          <button class="btn-secondary" @click="applyReplace">🔁 替换全部</button>
          <button v-if="replaceFrom || replaceTo" class="btn-secondary" @click="clearReplace">清除</button>
        </div>

        <textarea
          v-model="result.text"
          class="result-text"
          rows="8"
          placeholder="转写结果会显示在这里"
        ></textarea>
        <div class="result-actions">
          <button class="btn-secondary" @click="copyText">📋 复制文字</button>
          <button class="btn-secondary" @click="downloadSrt">📥 下载 SRT</button>
          <button class="btn-secondary" @click="downloadTxt">📄 下载 TXT</button>
          <button class="btn-secondary" @click="downloadDoc">📝 下载 Word</button>
        </div>
        <div v-if="replaceStats" class="replace-stats">
          ✅ 已替换 {{ replaceStats.replaced }} 处{{ replaceStats.before ? `(${replaceStats.before} 字 → ${replaceStats.after} 字)` : '' }}
        </div>
      </div>

      <!-- 🇨🇳 R57:删试用/付费相关 UI -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserPlanStore } from '@/stores/useUserPlan'

const auth = useAuthStore()
const userPlan = useUserPlanStore()

// 🇨🇳 R47.5:文件状态
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const isProcessing = ref(false)

// 🇨🇳 R49.5:转写结果(可编辑 + 可下载 + 扣减记录)
const result = ref<{
  text: string
  sentences: any[]
  status: number | string
  durationSec: number
  elapsed: string
  consumedSec: number  // 🇨🇳 本次转写扣减的秒数
} | null>(null)

// 🇨🇳 R49.4:批量替换(R47 找回)
const replaceFrom = ref('')
const replaceTo = ref('')
const useRegex = ref(false)
const replaceStats = ref<{ replaced: number; before: number; after: number } | null>(null)

// 🇨🇳 R57:删付费弹窗
// const showPaywall = ref(false)
// const paywallMode = ref<'transcribe' | 'vocal'>('transcribe')

const planName = computed(() => {
  return { free: '免费', plus: 'Plus', pro: 'Pro', studio: 'Studio' }[userPlan.plan]
})

const progressPercent = computed(() => {
  if (userPlan.transcribeQuotaMin === -1) return 0  // 不限
  const used = userPlan.transcribeQuotaMin - userPlan.transcribeRemainingMin
  return (used / userPlan.transcribeQuotaMin) * 100
})

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function onFilePick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) selectedFile.value = f
}
function onDrop(e: DragEvent) {
  isDragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) selectedFile.value = f
}

function triggerLogin() {
  // 🇨🇳 R57:触发右上角"登录"按钮 → 弹登录弹框
  document.querySelector('.av-login-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

// 🇨🇳 R57:删付费检查,直接跑转写
async function startTranscribe() {
  if (!selectedFile.value) return
  // (R57:删配额限制检查 — 试用期间不限)

  isProcessing.value = true
  const file = selectedFile.value
  const startTime = Date.now()
  try {
    // Step 1:拿签名 URL + objectKey
    const ext = file.name.split('.').pop() || 'mp3'
    const signRes = await fetch('/api/audio/vocal-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || `audio/${ext}`,
        size: file.size,
      }),
    })
    const sign = await signRes.json()
    if (!sign.ok) throw new Error(sign.error || '签名失败')

    // Step 2:PUT 到阿里云 OSS
    const putRes = await fetch(sign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || `audio/${ext}` },
      body: file,
    })
    if (!putRes.ok) throw new Error(`OSS 上传失败 HTTP ${putRes.status}`)

    // Step 3:获取预估时长(用 audio.duration)
    const durationSec = await new Promise<number>((resolve) => {
      const audio = new Audio()
      audio.src = URL.createObjectURL(file)
      audio.addEventListener('loadedmetadata', () => resolve(Math.ceil(audio.duration || 0)))
      audio.addEventListener('error', () => resolve(0))
    })

    // Step 4:调 ASR(需要登录态)
    const token = auth.token || ''
    const asrRes = await fetch('/api/audio/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        objectKey: sign.objectKey,
        format: ext,
        durationSec,
      }),
    })
    const asr = await asrRes.json()
    if (!asr.ok) {
      // 🇨🇳 401 未登录 / 402 配额 / 500 服务异常
      if (asrRes.status === 401) {
        alert('请先登录再转写')
      } else if (asrRes.status === 402) {
        alert(`本月配额已用完\n${asr.error || ''}`)
      } else {
        alert(`转写失败: ${asr.error || '未知错误'}`)
      }
      return
    }

    // 成功:把结果存到 UI(可编辑 + 可下载)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    // 🇨🇳 9-3 R49.5:先存结果(让 Vue 完成响应式),再累加额度
    result.value = {
      text: asr.text || '',
      sentences: asr.sentences || [],
      status: asr.status || 'success',
      durationSec: asr.durationSec || 0,
      elapsed,
      consumedSec: asr.durationSec || 0,
    }

    // 🇨🇳 9-3 R49.5:本地累加转写秒数(用真实音频时长)—— 放在 nextTick 之后,
    //                  避免触发 Vue 响应式循环警告(reportAllChanges + startTime undefined)
    const consumedSec = asr.durationSec || 0
    if (consumedSec > 0) {
      nextTick(() => {
        userPlan.consumeTranscribe(consumedSec)
      })
    }

    // 🇨🇳 R49.5:重新拉配额(后端 consumeQuota 兜底)
    try {
      const quotaRes = await fetch('/api/audio/quota', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const quotaData = await quotaRes.json()
      if (quotaData.ok && quotaData.usage?.usedSec !== undefined) {
        console.log('[Transcribe] 服务器已用秒数:', quotaData.usage.usedSec)
      }
    } catch (e) {
      console.warn('[Transcribe] 配额刷新失败(非阻塞):', e)
    }
  } catch (e: any) {
    alert(`❌ 转写失败: ${e.message || '未知错误'}`)
  } finally {
    isProcessing.value = false
  }
}

// 🇨🇳 R49.4:格式化 ASR 状态码(可读 + 中文)
function formatStatus(status: number | string | undefined): string {
  if (status === undefined || status === null) return '未知'
  if (typeof status === 'string') return status
  const map: Record<number, string> = {
    20000000: '✅ 成功',
    21050000: '✅ 成功',
    21050003: '✅ 成功(无语音)',
    20000001: '⏳ 等待中',
    20000002: '⏳ 运行中',
    20000003: '⏳ 处理中',
    40000000: '❌ 请求错误',
    41000000: '❌ 鉴权失败',
    43000000: '❌ 超过配额',
    44000000: '❌ 文件下载失败',
  }
  return map[status] || `状态码 ${status}`
}

// 🇨🇳 R49.4:批量替换(支持正则)
function applyReplace() {
  if (!result.value || !replaceFrom.value) return
  const before = result.value.text.length
  let replaced = 0
  let newText = ''
  try {
    if (useRegex.value) {
      const re = new RegExp(replaceFrom.value, 'g')
      replaced = (result.value.text.match(re) || []).length
      newText = result.value.text.replace(re, replaceTo.value)
    } else {
      // 简单字面量替换(全局)
      const from = replaceFrom.value
      const to = replaceTo.value
      const parts = result.value.text.split(from)
      replaced = parts.length - 1
      newText = parts.join(to)
    }
    result.value.text = newText
    replaceStats.value = { replaced, before, after: newText.length }
    // 3 秒后清除提示
    setTimeout(() => { replaceStats.value = null }, 3000)
  } catch (e: any) {
    alert(`替换失败: ${e.message}`)
  }
}

// 🇨🇳 R49.5:开始新一轮转写(清空所有状态,允许用户选新文件)
function resetForNext() {
  result.value = null
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''  // 清空 input,允许重新选同一文件
  }
  replaceFrom.value = ''
  replaceTo.value = ''
  useRegex.value = false
  replaceStats.value = null
}

function clearReplace() {
  replaceFrom.value = ''
  replaceTo.value = ''
  useRegex.value = false
  replaceStats.value = null
}

// 🇨🇳 R49.4:下载辅助函数(修复 insecure blob warning:revokeURL 延迟 + 显式 noopener)
function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 延迟 revoke,避免 blob 还没下载完就被回收
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function copyText() {
  if (!result.value) return
  navigator.clipboard.writeText(result.value.text).then(() => {
    // 简单反馈
    const btn = document.activeElement as HTMLButtonElement
    if (btn) {
      const orig = btn.textContent
      btn.textContent = '✅ 已复制'
      setTimeout(() => { btn.textContent = orig }, 1500)
    }
  })
}

// 🇨🇳 R49.4:TXT 下载(加 UTF-8 BOM,Word 打开不乱码)
function downloadTxt() {
  if (!result.value) return
  const filename = (selectedFile.value?.name || 'transcribe').replace(/\.[^.]+$/, '') + '.txt'
  // 🇨🇳 加 \uFEFF BOM,Windows Word/记事本能识别 UTF-8
  downloadFile(filename, '\uFEFF' + result.value.text, 'text/plain;charset=utf-8')
}

// 🇨🇳 R49.4:SRT 下载 - 总是有时间码(如果有 sentences 用句子时间,否则按 durationSec 平均切片)
function downloadSrt() {
  if (!result.value) return
  let srt = ''
  const sentences = result.value.sentences || []

  if (sentences.length > 0) {
    let idx = 1
    for (const s of sentences) {
      // 兼容下划线 + 驼峰
      const start = s.begin_time ?? s.BeginTime ?? s.startTime ?? 0
      const end = s.end_time ?? s.EndTime ?? s.endTime ?? (start + 1000)
      const text = s.text ?? s.Text ?? ''
      if (!text) continue
      srt += `${idx++}\n${fmtSrtTime(start)} --> ${fmtSrtTime(end)}\n${text}\n\n`
    }
  }

  if (!srt) {
    // 降级:整段一个 SRT 块(用 durationSec 作总时长)
    const totalSec = result.value.durationSec || 10
    srt = `1\n00:00:00,000 --> ${fmtSrtTime(totalSec * 1000)}\n${result.value.text}\n\n`
  }

  const filename = (selectedFile.value?.name || 'transcribe').replace(/\.[^.]+$/, '') + '.srt'
  // SRT 也加 BOM,Word 打开更友好
  downloadFile(filename, '\uFEFF' + srt, 'application/x-subrip;charset=utf-8')
}

function fmtSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  const milli = Math.floor(ms % 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(milli).padStart(3, '0')}`
}

// 🇨🇳 R49.4:Word 下载 - 用 HTML 格式(.doc 后缀,Word 能打开,无乱码)
function downloadDoc() {
  if (!result.value) return
  // Word 的"另存为 HTML"格式,实际是 mso 命名空间的 HTML,Word 完美打开不乱码
  const text = result.value.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>转写结果</title>
<!--[if gte mso 9]><xml>
 <w:WordDocument><w:View>Print</w:View></w:WordDocument>
</xml><![endif]-->
<style>
  body { font-family: "Microsoft YaHei", "微软雅黑", Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
  p { margin: 0 0 10pt 0; }
</style>
</head>
<body>
<p>${text}</p>
</body>
</html>`
  const filename = (selectedFile.value?.name || 'transcribe').replace(/\.[^.]+$/, '') + '.doc'
  // 加 UTF-8 BOM,Word 双击直接识别中文
  downloadFile(filename, '\uFEFF' + html, 'application/msword;charset=utf-8')
}

// 🇨🇳 R57:删续费(mock 不做)
// function onRenew() { ... }
</script>

<style scoped>
/* 🇨🇳 R57:统一登录提示样式 */
.login-required {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 60px 20px;
  text-align: center;
  color: #fff;
}
.login-icon { font-size: 64px; margin-bottom: 16px; }
.login-required h3 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
.login-required p { color: rgba(255,255,255,0.6); font-size: 14px; margin: 0 0 24px; }
.transcribe-tab { color: #ffffff; }
.tab-intro h2 { font-size: 24px; margin: 0 0 6px; }
.tab-intro p { color: rgba(255,255,255,0.65); margin: 0 0 24px; }

.login-required {
  text-align: center;
  padding: 60px 24px;
  background: rgba(255,255,255,0.04);
  border: 1px dashed rgba(0,153,255,0.4);
  border-radius: 16px;
}
.login-icon { font-size: 64px; margin-bottom: 16px; }
.login-required h3 { font-size: 22px; margin: 0 0 8px; }
.login-required p { color: rgba(255,255,255,0.6); margin: 0 0 24px; }

.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  border: none;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-primary { background: #0099ff; color: #ffffff; }
.btn-primary:hover:not(:disabled) { background: #007acc; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,153,255,0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: transparent; border: 1px solid rgba(255,255,255,0.3); color: #ffffff; }
.btn-secondary:hover { border-color: #0099ff; background: rgba(0,153,255,0.1); }

.upload-zone { padding: 0; }
.upload-zone h3 { font-size: 16px; margin: 0 0 12px; }

.drop-area {
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: 12px;
  padding: 40px 24px;
  text-align: center;
  font-size: 14px;
  color: rgba(255,255,255,0.65);
  margin-bottom: 16px;
  transition: all 0.15s ease;
}
.drop-area.dragging {
  border-color: rgba(0,153,255,0.6);
  background: rgba(0,153,255,0.08);
}
.drop-area a { color: #0099ff; text-decoration: underline; }

.quota-bar {
  padding: 14px 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  margin-bottom: 16px;
}
.quota-text {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: rgba(255,255,255,0.75);
  margin-bottom: 8px;
}
.plan-badge {
  padding: 2px 10px;
  background: linear-gradient(90deg, rgba(0,153,255,0.3), rgba(0,153,255,0.15));
  border: 1px solid rgba(0,153,255,0.4);
  border-radius: 9999px;
  color: #99ddff;
  font-weight: 600;
}
.quota-progress {
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 9999px;
  overflow: hidden;
}
.quota-fill {
  height: 100%;
  background: linear-gradient(90deg, #00cc88, #0099ff);
  transition: width 0.3s ease;
}
.quota-out {
  margin-top: 8px;
  color: #ff8866;
  font-size: 13px;
}
.quota-renewed {
  margin-top: 8px;
  color: #00cc88;
  font-size: 13px;
}

.renew-zone {
  margin-top: 16px;
  padding: 14px 16px;
  background: rgba(255,200,0,0.08);
  border: 1px solid rgba(255,200,0,0.25);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.renew-zone p { margin: 0; font-size: 13px; color: rgba(255,255,255,0.8); }

.topup-info {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(0,153,255,0.08);
  border-radius: 8px;
  font-size: 13px;
  color: rgba(255,255,255,0.75);
}

/* 🇨🇳 R49:转写结果区 */
.result-zone {
  margin-top: 24px;
  padding: 16px;
  background: rgba(0,255,150,0.04);
  border: 1px solid rgba(0,255,150,0.25);
  border-radius: 12px;
}
.result-zone h3 { font-size: 16px; margin: 0 0 12px; color: #88ffcc; }
.result-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  margin-bottom: 10px;
}
.result-status { color: #00cc88; }

/* 🇨🇳 R49.6:句子明细折叠 */
.sentence-details {
  margin-bottom: 10px;
  background: rgba(0,0,0,0.25);
  border-radius: 8px;
  padding: 8px 12px;
}
.sentence-details summary {
  cursor: pointer;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  user-select: none;
}
.sentence-list {
  margin: 8px 0 0 0;
  padding-left: 24px;
  max-height: 280px;
  overflow-y: auto;
}
.sentence-list li {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 6px;
  line-height: 1.5;
}
.time-code {
  color: #ffc864;
  margin-right: 8px;
  font-family: monospace;
  font-size: 12px;
}
.sentence-text {
  color: rgba(255, 255, 255, 0.95);
}

/* 🇨🇳 R49.5:重新转写按钮 + 扣减信息 */
.result-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.result-topbar .consumed-info {
  font-size: 12px;
  color: rgba(255, 200, 100, 0.9);
}

.result-text {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
}
/* 🇨🇳 R49.4:批量替换工具栏 */
.replace-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
  padding: 8px;
  background: rgba(0,0,0,0.25);
  border-radius: 8px;
}
.replace-input {
  flex: 1;
  min-width: 100px;
  padding: 6px 10px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-family: inherit;
}
.replace-input:focus {
  outline: none;
  border-color: #0099ff;
}
.replace-arrow { color: rgba(255,255,255,0.5); font-weight: bold; }
.replace-regex {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
}
.replace-stats {
  margin-top: 8px;
  font-size: 13px;
  color: #00cc88;
  text-align: center;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
</style>