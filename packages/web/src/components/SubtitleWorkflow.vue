<!--
  🇨🇳 2026-09-17 by Hermes
  字幕工作流页(上传视频/音频 → ASR → 编辑 → 导出)
  - 用户视角:拖文件 → 点转写 → 拿到字幕(和大厂一样)
  - 后端自动用 .env 里的 ASR key,前端不暴露任何配置细节
  - 配置状态只在出错时才告诉用户(像剪映一样:"服务暂时不可用")
-->
<template>
  <div class="subtitle-workflow-page">
    <JianheboxToolNav class="page-tool-nav" />

    <div class="workflow-container">
      <header class="page-header">
        <div class="header-badge">⚙️ 字幕工作流</div>
        <h1>上传视频/音频 → 转字幕 → 编辑 → 导出</h1>
        <p class="subtitle">阿里云 ASR 智能转写 · 中文识别率高 · 拿到时间码字幕</p>
      </header>

      <!-- Step 1: 上传文件 -->
      <div class="step-card">
        <h3>1️⃣ 选文件</h3>
        <p class="step-desc">
          支持 mp4 / mov / avi / mkv / mp3 / wav / m4a / flac
        </p>

        <div class="upload-zone" :class="{ dragging: isDragging }"
             @dragover.prevent="isDragging = true"
             @dragleave="isDragging = false"
             @drop.prevent="onDrop">
          <input ref="fileInput" type="file" accept="audio/*,video/*" hidden @change="onFilePick" />
          <div v-if="!selectedFile" class="upload-empty">
            <div class="upload-emoji">📁</div>
            <p>拖拽文件到这里 或 <a href="#" @click.prevent="fileInput?.click()">点此选择</a></p>
            <p class="upload-hint">最大 500MB</p>
          </div>
          <div v-else class="upload-info">
            <div class="file-icon">🎬</div>
            <div class="file-meta">
              <div class="file-name">{{ selectedFile.name }}</div>
              <div class="file-size">{{ formatSize(selectedFile.size) }} · {{ fileExt }}</div>
            </div>
            <button class="btn-reset" @click="resetFile">🔄 换文件</button>
          </div>
        </div>
      </div>

      <!-- Step 2: 转写 -->
      <div class="step-card">
        <h3>2️⃣ 开始转写</h3>

        <div v-if="!auth.isLoggedIn" class="login-required">
          <div class="login-icon">🔒</div>
          <p>登录后才能使用转写</p>
          <button class="btn-primary" @click="triggerLogin">立即登录</button>
        </div>

        <div v-else>
          <button class="btn-primary"
                  :disabled="!selectedFile || isProcessing"
                  @click="startTranscribe">
            {{ isProcessing ? `转写中... (${progressStage})` : '🎙 开始转写' }}
          </button>

          <!-- 转写进度 -->
          <div v-if="isProcessing" class="progress-zone">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ progressStage }} · 已耗时 {{ elapsedSeconds }}s
            </div>
          </div>

          <!-- 错误:和大厂一样,只显示用户友好的提示 -->
          <div v-if="errorMessage" class="alert alert-error">
            {{ errorMessage }}
          </div>
        </div>
      </div>

      <!-- Step 3: 转写结果 -->
      <div v-if="result" class="step-card result-card">
        <h3>3️⃣ 转写完成 ({{ result.sentences.length }} 段)</h3>
        <p class="step-desc">
          ✅ 耗时 {{ result.elapsed }}s · 音频时长 {{ result.durationSec }}s
        </p>

        <!-- 句子预览 -->
        <details class="sentence-details" open>
          <summary>📋 查看 {{ result.sentences.length }} 个时间码片段</summary>
          <ol class="sentence-list">
            <li v-for="(s, i) in result.sentences" :key="i">
              <span class="time-code">[{{ fmtTime(s.begin_time) }} → {{ fmtTime(s.end_time) }}]</span>
              <span class="sentence-text">{{ s.text }}</span>
            </li>
          </ol>
        </details>

        <!-- 导出按钮 -->
        <div class="export-row">
          <button class="btn-export btn-primary" @click="exportSrt">📥 下载 SRT</button>
          <button class="btn-export" @click="exportVtt">📥 下载 VTT</button>
          <button class="btn-export" @click="exportTxt">📄 下载 TXT</button>
          <router-link to="/tools/subtitle/edit" class="btn-export btn-link"
                       @click="goToEditor">
            ✏️ 去编辑
          </router-link>
        </div>

        <button class="btn-secondary" @click="resetAll">🔄 转写新文件</button>
      </div>

      <!-- 配额信息 -->
      <div v-if="auth.isLoggedIn && quota && quota.usedMin !== undefined" class="quota-card">
        <span class="quota-label">本月转写:</span>
        <span class="quota-value">{{ quota.usedMin }} / {{ quota.quotaMin || '∞' }} 分钟</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import JianheboxToolNav from './JianheboxToolNav.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const isProcessing = ref(false)
const errorMessage = ref('')
const progressStage = ref('')
const elapsedSeconds = ref(0)
const startTime = ref(0)

const fileExt = computed(() => selectedFile.value?.name.split('.').pop()?.toLowerCase() || '')

const progressPercent = computed(() => {
  if (!isProcessing.value) return 0
  const total = 90
  return Math.min(95, (elapsedSeconds.value / total) * 100)
})

interface AsrSentence {
  text: string
  begin_time: number
  end_time: number
}

const result = ref<{
  text: string
  sentences: AsrSentence[]
  status: number | string
  durationSec: number
  elapsed: string
} | null>(null)

const quota = ref<{ usedMin?: number; quotaMin?: number } | null>(null)

onMounted(async () => {
  await refreshQuota()
})

// 🇨🇳 和大厂一样:用户看不到"是否配置",只看到错误时提示
async function refreshQuota() {
  if (!auth.token) return
  try {
    const res = await fetch('/api/audio/quota', {
      headers: { 'Authorization': `Bearer ${auth.token}` },
    })
    const data = await res.json()
    if (data.ok && data.usage) {
      quota.value = {
        usedMin: Math.round((data.usage.usedSec || 0) / 60),
        quotaMin: Math.round((data.usage.quotaSec || 0) / 60),
      }
    }
  } catch {}
}

function triggerLogin() {
  document.querySelector('.av-login-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
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

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function resetFile() {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function resetAll() {
  resetFile()
  result.value = null
  errorMessage.value = ''
}

function fmtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  const milli = Math.floor(ms % 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(milli).padStart(3, '0')}`
}

// 🇨🇳 主流程:拿 OSS 签名 URL → PUT 到 OSS → 调 ASR → 拿到时间码字幕
async function startTranscribe() {
  if (!selectedFile.value || !auth.token) return
  isProcessing.value = true
  errorMessage.value = ''
  result.value = null
  startTime.value = Date.now()
  elapsedSeconds.value = 0

  const timer = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - startTime.value) / 1000)
  }, 1000)

  const file = selectedFile.value
  const ext = file.name.split('.').pop() || 'mp3'

  try {
    progressStage.value = '上传中'
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
    if (!sign.ok) throw new Error('服务暂时不可用,请稍后再试')

    progressStage.value = '上传完成'
    const putRes = await fetch(sign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || `audio/${ext}` },
      body: file,
    })
    if (!putRes.ok) throw new Error('文件上传失败,请重试')

    const durationSec = await new Promise<number>((resolve) => {
      const audio = new Audio()
      audio.src = URL.createObjectURL(file)
      audio.addEventListener('loadedmetadata', () => resolve(Math.ceil(audio.duration || 0)))
      audio.addEventListener('error', () => resolve(0))
    })

    progressStage.value = 'AI 转写中'
    const asrRes = await fetch('/api/audio/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        objectKey: sign.objectKey,
        format: ext,
        durationSec,
      }),
    })
    const asr = await asrRes.json()
    if (!asr.ok) {
      if (asrRes.status === 401) throw new Error('登录已过期,请重新登录')
      if (asrRes.status === 402) throw new Error(`本月额度已用完:${asr.error || ''}`)
      // 🇨🇳 和大厂一样:不告诉用户具体后端错误,只说"服务暂时不可用"
      throw new Error('转写服务暂时不可用,请稍后再试')
    }

    progressStage.value = '完成'
    const elapsed = ((Date.now() - startTime.value) / 1000).toFixed(1)

    const sentences: AsrSentence[] = (asr.sentences || []).map((s: any) => ({
      text: s.text ?? s.Text ?? '',
      begin_time: s.begin_time ?? s.BeginTime ?? 0,
      end_time: s.end_time ?? s.EndTime ?? 0,
    }))

    result.value = {
      text: asr.text || sentences.map((s) => s.text).join(''),
      sentences,
      status: asr.status || 'success',
      durationSec: asr.durationSec || durationSec,
      elapsed,
    }

    await refreshQuota()
  } catch (e: any) {
    errorMessage.value = e.message || '出错了,请稍后再试'
  } finally {
    clearInterval(timer)
    isProcessing.value = false
    progressStage.value = ''
  }
}

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
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function generateSrt(sentences: AsrSentence[]): string {
  let srt = ''
  let idx = 1
  for (const s of sentences) {
    if (!s.text) continue
    srt += `${idx++}\n${fmtTime(s.begin_time)} --> ${fmtTime(s.end_time)}\n${s.text}\n\n`
  }
  return '\uFEFF' + srt
}

function generateVtt(sentences: AsrSentence[]): string {
  let vtt = 'WEBVTT\n\n'
  let idx = 1
  for (const s of sentences) {
    if (!s.text) continue
    const start = fmtTime(s.begin_time).replace(',', '.')
    const end = fmtTime(s.end_time).replace(',', '.')
    vtt += `${idx}\n${start} --> ${end}\n${s.text}\n\n`
    idx++
  }
  return '\uFEFF' + vtt
}

function generateTxt(sentences: AsrSentence[]): string {
  return '\uFEFF' + sentences.map((s) => s.text).filter(Boolean).join('\n')
}

function exportSrt() {
  if (!result.value) return
  const filename = (selectedFile.value?.name || 'transcribe').replace(/\.[^.]+$/, '') + '.srt'
  downloadFile(filename, generateSrt(result.value.sentences), 'application/x-subrip;charset=utf-8')
}

function exportVtt() {
  if (!result.value) return
  const filename = (selectedFile.value?.name || 'transcribe').replace(/\.[^.]+$/, '') + '.vtt'
  downloadFile(filename, generateVtt(result.value.sentences), 'text/vtt;charset=utf-8')
}

function exportTxt() {
  if (!result.value) return
  const filename = (selectedFile.value?.name || 'transcribe').replace(/\.[^.]+$/, '') + '.txt'
  downloadFile(filename, generateTxt(result.value.sentences), 'text/plain;charset=utf-8')
}

function goToEditor() {
  if (!result.value) return
  sessionStorage.setItem('subtitle_workflow_result', JSON.stringify({
    sentences: result.value.sentences,
    text: result.value.text,
    filename: selectedFile.value?.name || 'transcribe',
  }))
  router.push('/tools/subtitle/edit')
}
</script>

<style scoped>
.subtitle-workflow-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0e1a 0%, #1a1f2e 100%);
  color: #fff;
}
.workflow-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 24px;
}
.page-header { text-align: center; margin-bottom: 32px; }
.header-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(72, 187, 120, 0.2);
  border: 1px solid #48bb78;
  border-radius: 20px;
  font-size: 14px;
  color: #48bb78;
  margin-bottom: 16px;
}
.page-header h1 { font-size: 32px; margin: 0 0 12px; }
.subtitle { color: #a0aec0; }

.step-card {
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  margin-bottom: 24px;
}
.step-card h3 { font-size: 20px; margin-bottom: 12px; }
.step-desc { color: #cbd5e0; font-size: 14px; line-height: 1.6; margin-bottom: 16px; }

/* 上传区 */
.upload-zone {
  padding: 32px;
  background: rgba(0, 0, 0, 0.2);
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  text-align: center;
  transition: all 0.2s;
}
.upload-zone.dragging {
  border-color: #48bb78;
  background: rgba(72, 187, 120, 0.05);
}
.upload-empty .upload-emoji { font-size: 48px; margin-bottom: 12px; }
.upload-empty p { margin: 4px 0; color: #cbd5e0; }
.upload-empty a { color: #48bb78; text-decoration: none; }
.upload-empty .upload-hint { font-size: 12px; color: #718096; }

.upload-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}
.file-icon { font-size: 40px; }
.file-meta { flex: 1; text-align: left; }
.file-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.file-size { font-size: 12px; color: #a0aec0; }

/* 登录拦截 */
.login-required {
  padding: 40px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  text-align: center;
}
.login-icon { font-size: 48px; margin-bottom: 12px; }
.login-required p { color: #cbd5e0; font-size: 13px; margin-bottom: 16px; }

/* 进度条 */
.progress-zone { margin-top: 16px; }
.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #48bb78, #38a169);
  transition: width 0.3s;
}
.progress-text {
  margin-top: 8px;
  font-size: 12px;
  color: #cbd5e0;
  text-align: center;
}

/* 按钮 */
.btn-primary, .btn-secondary, .btn-export, .btn-reset {
  padding: 10px 20px;
  background: #48bb78;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-primary:hover:not(:disabled), .btn-export:hover {
  background: #38a169;
  transform: translateY(-1px);
}
.btn-primary:disabled {
  background: #4a5568;
  cursor: not-allowed;
}
.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
.btn-reset {
  background: rgba(245, 101, 101, 0.15);
  color: #fc8181;
  padding: 6px 12px;
  font-size: 12px;
}
.btn-link { background: #ed8936; }
.btn-link:hover { background: #dd7724; }

.alert-error {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(245, 101, 101, 0.1);
  border: 1px solid rgba(245, 101, 101, 0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #fc8181;
  line-height: 1.6;
}

/* 结果区 */
.result-card { border-color: rgba(72, 187, 120, 0.3); }

.sentence-details {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}
.sentence-details summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #48bb78;
  margin-bottom: 8px;
}
.sentence-list {
  max-height: 400px;
  overflow-y: auto;
  padding-left: 24px;
  margin: 0;
}
.sentence-list li {
  padding: 6px 0;
  font-size: 13px;
  line-height: 1.5;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.sentence-list li:last-child { border-bottom: none; }
.time-code {
  display: inline-block;
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  color: #48bb78;
  margin-right: 8px;
  font-weight: 600;
}
.sentence-text { color: #e2e8f0; }

.export-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0;
}

/* 配额(底部一行小字) */
.quota-card {
  margin-top: 24px;
  padding: 12px 16px;
  text-align: center;
  font-size: 12px;
  color: #a0aec0;
}
.quota-label { margin-right: 6px; }
.quota-value { color: #48bb78; font-weight: 600; }

@media (max-width: 768px) {
  .export-row { flex-direction: column; }
  .btn-export { width: 100%; justify-content: center; }
}
</style>
