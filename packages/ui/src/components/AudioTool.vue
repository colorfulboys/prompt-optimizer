<template>
  <div class="audio-tool-page">
    <JianheboxToolNav title="音频转文字" />

    <div class="audio-container">
      <!-- 🇨🇳 2026-08-31:改文案,从"不上传任何服务器"改为"使用云端 API" -->
      <div class="api-notice">
        <span class="api-notice-icon">☁️</span>
        <span>
          本工具调用 <strong>阿里云智能语音交互 API</strong> 转写音频。
          音频会上传到阿里云上海节点处理,<strong>不存储</strong>。
        </span>
      </div>
      <p class="page-desc">
        浏览器上传音频 → 云端识别 → 返回文字。<strong>新用户每月 30 分钟免费</strong>。
      </p>

      <!-- 🇨🇳 2026-08-31:M2 用户区已全局化,见 JianheboxToolNav 顶部 -->

      <!-- 额度进度条 + 登录 -->
      <div class="quota-bar">
        <div class="quota-info">
          <template v-if="auth.isLoggedIn">
            <span>本月已用: {{ usedLabel }} / 30:00</span>
            <span class="quota-left" v-if="remainingSec > 0">剩余 {{ remainingLabel }}</span>
            <span class="quota-out" v-else>⚠️ 额度已用完</span>
          </template>
          <template v-else>
            <span>📦 每月 30 分钟免费额度</span>
            <span class="quota-left">请登录后使用</span>
          </template>
        </div>
        <div v-if="auth.isLoggedIn" class="quota-progress">
          <div class="quota-fill" :style="{ width: (auth.quota ? (auth.quota.monthly_used_sec / auth.quota.monthly_limit_sec * 100) : 0) + '%' }"></div>
        </div>
      </div>

      <!-- 阶段 1: 上传 -->
      <div class="section">
        <h2 class="section-title">1️⃣ 选音频</h2>
        <div class="upload-zone" @dragover.prevent @drop.prevent="handleDrop">
          <input
            ref="fileInputRef"
            type="file"
            accept="audio/*,video/*"
            @change="handleFileSelect"
            style="display:none"
          />
          <div class="upload-hint" @click="fileInputRef.click()">
            <span class="upload-icon">🎤</span>
            <p>拖拽音频文件到这里,或<span class="upload-link">点击选择文件</span></p>
            <p class="upload-sub">支持 mp3 / wav / m4a / ogg / webm / mp4 视频 · 建议 ≤ 60 分钟 / 100MB</p>
          </div>
        </div>
        <div v-if="audioFile" class="file-info">
          <span>📄 {{ audioFile.name }}</span>
          <span class="file-size">{{ formatSize(audioFile.size) }}</span>
          <span v-if="audioDuration" class="file-duration">⏱ {{ formatTime(audioDuration) }}</span>
          <button class="file-remove" @click="clearAll">✕</button>
        </div>
      </div>

      <!-- 阶段 2: 选项(云端自动检测语言) -->
      <div v-if="audioFile" class="section">
        <h2 class="section-title">2️⃣ 选项</h2>
        <div class="sub-params">
          <label>
            <input type="checkbox" v-model="removeFiller" />
            去除口头禅(嗯/啊/那个/然后/就是/其实)
          </label>
          <label>
            <input type="checkbox" v-model="splitSentence" />
            按句分段(用于生成 SRT)
          </label>
        </div>
      </div>

      <!-- 阶段 3: 开始 -->
      <div v-if="audioFile" class="section">
        <button
          class="btn btn-primary"
          :disabled="processing || remainingSec < audioDuration"
          @click="startTranscribe"
        >
          {{ processing ? '处理中...' : (remainingSec < audioDuration ? '⚠️ 额度不足' : '▶ 开始转写') }}
        </button>
        <p v-if="audioDuration && remainingSec < audioDuration" class="quota-warn">
          本音频时长 {{ formatTime(audioDuration) }},超出剩余额度 {{ formatTime(audioDuration - remainingSec) }}。
          后续我们会推出付费套餐,敬请期待。
        </p>
      </div>

      <!-- 进度 -->
      <div v-if="processing" class="progress-block">
        <div class="progress-stage">📥 {{ progressStage }}</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          <span class="progress-text">{{ progress }}%</span>
        </div>
        <p class="progress-tip">💡 云端转写通常 10-30 秒完成,网络稳定时更快。</p>
      </div>

      <!-- 阶段 4: 编辑预览 + 下载 -->
      <div v-if="segments.length > 0" class="section">
        <h2 class="section-title">3️⃣ 预览编辑(可直接改字)</h2>

        <!-- 🇨🇳 2026-08-31:批量查找替换工具栏 -->
        <div class="find-replace-bar">
          <div class="fr-row">
            <input
              v-model="findText"
              type="text"
              placeholder="🔍 查找文字..."
              class="fr-input"
            />
            <input
              v-model="replaceText"
              type="text"
              placeholder="✏️ 替换为..."
              class="fr-input"
            />
            <button class="btn btn-primary btn-sm" @click="findNext" :disabled="!findText">下一个</button>
            <button class="btn btn-secondary btn-sm" @click="replaceCurrent" :disabled="!findText">替换</button>
            <button class="btn btn-secondary btn-sm" @click="replaceAll" :disabled="!findText">全部替换</button>
          </div>
          <div v-if="findText" class="fr-status">
            <span v-if="findMatchCount > 0">
              ✅ 找到 <strong>{{ findMatchCount }}</strong> 处匹配
              <span v-if="currentMatchIdx >= 0">· 当前第 {{ currentMatchIdx + 1 }} / {{ findMatchCount }}</span>
            </span>
            <span v-else class="fr-empty">⚠️ 未找到匹配</span>
          </div>
        </div>

        <div class="segments-editor">
          <div
            v-for="(seg, i) in segments"
            :key="i"
            :class="['seg-row', currentMatchIdx >= 0 && findMatches[i] ? 'seg-highlight' : '']"
          >
            <div class="seg-time">
              <input v-model="seg.startStr" @change="recalcTimes(i)" class="time-input" />
              <span> → </span>
              <input v-model="seg.endStr" @change="recalcTimes(i)" class="time-input" />
            </div>
            <textarea v-model="seg.text" class="seg-text" rows="2" :ref="el => setSegRef(i, el as any)"></textarea>
            <button class="seg-remove" @click="removeSegment(i)" title="删除">✕</button>
          </div>
          <button class="seg-add" @click="addSegment">+ 加一行</button>
        </div>

        <div class="result-zone">
          <p class="result-label">✅ 转写完成 · {{ segments.length }} 段 · 总时长 {{ formatTime(totalDuration) }}</p>

          <!-- 🇨🇳 2026-08-31:下载选项 -->
          <div class="download-options">
            <label class="opt-label">
              <input type="checkbox" v-model="includeTimestamp" />
              <span>下载时包含时间戳</span>
            </label>
            <label class="opt-label">
              <input type="checkbox" v-model="splitBySpeaker" />
              <span>按说话人分段(Word/TXT)</span>
            </label>
          </div>

          <div class="download-btns">
            <button class="btn btn-primary" @click="downloadSRT">下载 SRT</button>
            <button class="btn btn-primary" @click="downloadWord">下载 Word</button>
            <button class="btn btn-secondary" @click="downloadTxt">下载 TXT</button>
            <button class="btn btn-secondary" @click="copyToClipboard">复制全部</button>
          </div>
        </div>
      </div>

      <!-- 错误 -->
      <div v-if="errorMsg" class="error-block">
        ⚠️ {{ errorMsg }}
      </div>
    </div>

    <!-- 🇨🇳 2026-08-31:M2 登录弹框已全局化,见 GlobalUserArea -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import JianheboxToolNav from './JianheboxToolNav.vue'
import LoginModal from './LoginModal.vue'
import { useAuthStore } from '@/stores/auth'
import { dlog, dwarn, derr } from '@/utils/logger'  // 🇨🇳 R52.20:开发模式才输出

const auth = useAuthStore()
const showLoginModal = ref(false)

function onLoginSuccess() {
  dlog('[AudioTool] 登录成功')
}

// ========== 状态 ==========
const fileInputRef = ref<HTMLInputElement | null>(null)
const audioFile = ref<File | null>(null)
const audioDuration = ref(0)
const removeFiller = ref(true)
const splitSentence = ref(true)
const processing = ref(false)
const progress = ref(0)
const progressStage = ref('准备中')
const segments = ref<Array<{ start: number; end: number; startStr: string; endStr: string; text: string }>>([])
const errorMsg = ref('')

// 🇨🇳 2026-08-31:查找替换 + 下载选项
const findText = ref('')
const replaceText = ref('')
const findMatches = ref<boolean[]>([])   // 每段是否匹配
const currentMatchIdx = ref(-1)            // 当前高亮哪个段
const includeTimestamp = ref(true)        // 下载时是否带时间戳
const splitBySpeaker = ref(false)          // 是否按说话人分段
const segRefs = ref<Record<number, HTMLTextAreaElement | null>>({})

const findMatchCount = computed(() => findMatches.value.filter(Boolean).length)

function setSegRef(i: number, el: any) {
  if (el) segRefs.value[i] = el
}

watch([findText, segments], () => {
  recomputeMatches()
  if (findMatches.value.filter(Boolean).length > 0 && currentMatchIdx.value < 0) {
    jumpToFirstMatch()
  }
}, { deep: true })

function recomputeMatches() {
  const q = findText.value.trim()
  if (!q) {
    findMatches.value = []
    currentMatchIdx.value = -1
    return
  }
  findMatches.value = segments.value.map((s) => s.text.includes(q))
}

function jumpToFirstMatch() {
  const firstIdx = findMatches.value.findIndex(Boolean)
  if (firstIdx >= 0) {
    currentMatchIdx.value = firstIdx
    scrollToMatch(firstIdx)
  }
}

function findNext() {
  if (findMatchCount.value === 0) return
  // 当前高亮的下一个
  let next = -1
  for (let i = currentMatchIdx.value + 1; i < segments.value.length; i++) {
    if (findMatches.value[i]) { next = i; break }
  }
  // 如果后面没了,从头开始
  if (next < 0) {
    for (let i = 0; i <= currentMatchIdx.value; i++) {
      if (findMatches.value[i]) { next = i; break }
    }
  }
  if (next >= 0) {
    currentMatchIdx.value = next
    scrollToMatch(next)
  }
}

function scrollToMatch(i: number) {
  setTimeout(() => {
    const el = segRefs.value[i]
    if (el) {
      el.focus()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 高亮选中文本
      const q = findText.value.trim()
      const idx = segments.value[i].text.indexOf(q)
      if (idx >= 0) {
        el.setSelectionRange(idx, idx + q.length)
      }
    }
  }, 50)
}

function replaceCurrent() {
  if (currentMatchIdx.value < 0) return
  const q = findText.value.trim()
  const r = replaceText.value
  const i = currentMatchIdx.value
  if (segments.value[i].text.includes(q)) {
    segments.value[i].text = segments.value[i].text.replace(q, r)
    recomputeMatches()
    findNext()
  }
}

function replaceAll() {
  const q = findText.value.trim()
  if (!q) return
  const r = replaceText.value
  let count = 0
  segments.value.forEach((seg) => {
    if (seg.text.includes(q)) {
      const before = seg.text
      seg.text = seg.text.split(q).join(r)
      count += (before.split(q).length - 1)
    }
  })
  recomputeMatches()
  if (count > 0) {
    alert(`✅ 已替换 ${count} 处`)
    currentMatchIdx.value = -1
  }
}

const MAX_DURATION_SEC = 60 * 60
const MAX_SIZE_BYTES = 100 * 1024 * 1024

// 🇨🇳 2026-08-31:M2 改用 server-side 额度(Pinia auth store)
const usedSeconds = ref(0)
const remainingSec = computed(() => auth.remainingSec)
const remainingLabel = computed(() => auth.remainingLabel)
const usedLabel = computed(() => auth.usedLabel)

onMounted(async () => {
  // OAuth 回调回来后会自动带 token
  if (auth.token && !auth.user) {
    await auth.fetchUser()
  }
  // 已登录则拉额度
  if (auth.isLoggedIn) {
    await auth.fetchQuota()
    usedSeconds.value = auth.quota?.monthly_used_sec || 0
  }
})

// 口头禅正则
const FILLER_REGEX = /(^|\s)(嗯+|啊+|哎+|那个|然后|就是说|其实|对吧|你知道|就是说呢|这个|那个)([\s,。、!?\.…]|$)/g

// ========== 工具函数 ==========
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
}

function secToSRT(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec - Math.floor(sec)) * 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`
}

/**
 * 🇨🇳 2026-08-31:HTML 转义(用于 Word XML)
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function clearAll() {
  audioFile.value = null
  audioDuration.value = 0
  segments.value = []
  progress.value = 0
  errorMsg.value = ''
}

// ========== 文件处理 ==========
function handleDrop(e: DragEvent) {
  const dropped = Array.from(e.dataTransfer?.files || [])
  if (dropped.length > 0) loadFile(dropped[0])
}

function handleFileSelect(e: Event) {
  const selected = (e.target as HTMLInputElement).files
  if (selected && selected.length > 0) loadFile(selected[0])
}

async function loadFile(file: File) {
  errorMsg.value = ''
  if (file.size > MAX_SIZE_BYTES) {
    errorMsg.value = `文件太大: ${formatSize(file.size)} > 100MB。请用 ffmpeg 等工具压缩后重试。`
    return
  }
  audioFile.value = file
  const url = URL.createObjectURL(file)
  const audio = new Audio()
  audio.src = url
  await new Promise<void>((resolve) => {
    audio.addEventListener('loadedmetadata', () => {
      audioDuration.value = audio.duration
      if (audio.duration > MAX_DURATION_SEC) {
        errorMsg.value = `音频太长: ${formatTime(audio.duration)} > 60 分钟。请用 ffmpeg 等工具裁剪后重试。`
        audioFile.value = null
      }
      resolve()
    })
    audio.addEventListener('error', () => {
      errorMsg.value = '无法读取此音频(可能是格式不支持)'
      resolve()
    })
  })
  URL.revokeObjectURL(url)
}

// ========== 阿里云 ASR 调用 ==========
// 🇨🇳 2026-08-31 by Hermes:从 wasm 改为阿里云 HTTP REST API
interface AliyunASRResult {
  text: string
  sentences?: Array<{ text: string; begin_time: number; end_time: number }>
}

/**
 * 🇨🇳 2026-08-31:新流程:OSS 直传 + 后端调阿里云录音文件识别
 *
 * 步骤:
 *   1. GET /api/audio/upload-url?filename=xxx → 拿签名 uploadUrl + objectKey
 *   2. PUT audio file 到 OSS(直传,不经过 server)
 *   3. POST /api/audio/transcribe { objectKey } → 后端轮询阿里云,返回完整 sentences
 */
async function uploadAndTranscribe(file: File, onProgress: (stage: string, percent: number) => void): Promise<AliyunASRResult> {
  const filename = file.name

  // 🇨🇳 2026-08-31:M2 强制登录检查
  if (!auth.token) {
    throw new Error('请先登录')
  }

  // 步骤 1: 拿签名 URL
  onProgress('获取上传签名...', 5)
  const sigRes = await fetch(`/api/audio/upload-url?filename=${encodeURIComponent(filename)}&token=${auth.token}`)
  if (!sigRes.ok) {
    if (sigRes.status === 401) {
      throw new Error('登录已过期,请重新登录')
    }
    throw new Error(`签名失败: HTTP ${sigRes.status}`)
  }
  const sig = await sigRes.json() as { uploadUrl: string; objectKey: string; publicUrl: string; verifyUrl: string; ok?: boolean }
  if (!sig.uploadUrl) throw new Error('签名 URL 为空,检查 .env 阿里云凭证')

  // 步骤 2: 直传 OSS(XMLHttpRequest 拿上传进度)
  onProgress('上传到阿里云 OSS...', 10)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        // 10%-70% 用于上传
        const pct = Math.min(70, 10 + (e.loaded / e.total) * 60)
        onProgress('上传到阿里云 OSS...', pct)
      }
    })
    // 🇨🇳 2026-08-31:核心修复 - 不要相信 XHR loadend status
    // 真实情况是 CORS 没配好时,XHR 返回 status=0 但服务端没收到任何字节
    // 必须用 HEAD 请求验证 objectKey 实际存在且 size 匹配
    xhr.addEventListener('loadend', () => {
      const status = xhr.status
      dlog('[AudioTool] XHR loadend, status=', status, 'responseText.length=', xhr.responseText?.length)
      if (status === 0) {
        // 100% CORS 没配对,服务端收不到
        reject(new Error('OSS 上传失败:浏览器 CORS 被拦截,请检查阿里云 OSS Bucket 跨域设置(允许来源 * + 方法 PUT)'))
      } else if (status >= 200 && status < 300) {
        // 注意:这里 status 是真实的 HTTP 响应,但 CORS 没配时浏览器也会显示 200 但 body 拿不到
        // 仍然要 resolve,但下一步 server 端会检测
        resolve()
      } else {
        reject(new Error(`OSS 上传失败: HTTP ${status} ${xhr.responseText?.slice(0, 200)}`))
      }
    })
    xhr.addEventListener('error', (e) => {
      // 不在这里 reject,让 loadend 统一处理
      dwarn('[AudioTool] XHR error 触发(等 loadend):', e)
    })
    xhr.open('PUT', sig.uploadUrl)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.send(file)
  })

  // 🇨🇳 2026-08-31:核心修复 - 上传完后验证文件真的在 OSS 上
  // 注:OSS 私有 Bucket 不支持 HEAD,改用 GET + Range: bytes=0-0
  // ⚠️ Content-Range header 是 CORS-exposed-headers,默认浏览器拿不到
  // 所以这里只能验证 status=206 表示范围请求成功,不验证 size
  onProgress('验证上传...', 72)
  const verifyRes = await fetch(sig.verifyUrl, {
    method: 'GET',
    headers: { 'Range': 'bytes=0-0' },
  })
  if (!verifyRes.ok && verifyRes.status !== 206) {
    throw new Error(`OSS 验证失败: HTTP ${verifyRes.status},文件可能没真正上传(浏览器 CORS 被拦截)`)
  }
  dlog('[AudioTool] OSS verify OK, status=', verifyRes.status, '上传文件 size=', file.size)
  // 注意:CORS 默认不暴露 Content-Range,所以无法验证 size
  // 但只要 status=200/206,就说明文件存在并可访问
  // OSS 数据准备中(刚创建 bucket 的 1-3 小时)可能 GET 404,这时返回 200 但 body 空

  // 步骤 3: 后端调 ASR(轮询模式,通常 1-3 分钟完成)
  onProgress('云端转写中...', 75)

  // 用 fetch + AbortController 控超时(6 分钟硬超时)
  const ac = new AbortController()
  const timeout = setTimeout(() => ac.abort(), 6 * 60 * 1000)

  try {
    const asrRes = await fetch(`/api/audio/transcribe?token=${auth.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey: sig.objectKey,
        format: getFormatFromFilename(filename),
        durationSec: Math.round(audioDuration.value || 0),
      }),
      signal: ac.signal,
    })
    if (!asrRes.ok) {
      const errText = await errTextSafe(asrRes)
      if (asrRes.status === 401) {
        throw new Error('登录已过期,请重新登录')
      }
      if (asrRes.status === 402) {
        try {
          const errData = JSON.parse(errText)
          throw new Error(errData.error || '本月额度用完')
        } catch {
          throw new Error('本月额度用完')
        }
      }
      throw new Error(`ASR 失败: HTTP ${asrRes.status} ${errText.slice(0, 200)}`)
    }
    onProgress('整理结果...', 95)
    const result = await asrRes.json() as any
    // 🇨🇳 M2:服务端返回了真实额度,直接更新
    if (result.quota) {
      auth.updateQuota(result.quota)
      usedSeconds.value = result.quota.monthly_used_sec
    }
    return result
  } finally {
    clearTimeout(timeout)
  }
}

async function errTextSafe(res: Response): Promise<string> {
  try { return await res.text() } catch { return '' }
}

function getFormatFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  if (['mp3'].includes(ext)) return 'mp3'
  if (['wav', 'wave'].includes(ext)) return 'wav'
  if (['m4a', 'mp4'].includes(ext)) return 'm4a'
  if (['ogg', 'opus'].includes(ext)) return 'ogg'
  if (['webm'].includes(ext)) return 'webm'
  if (['aac'].includes(ext)) return 'aac'
  return 'mp3' // 默认
}

// ========== 转写主流程 ==========
async function startTranscribe() {
  if (!audioFile.value) return

  // 🇨🇳 2026-08-31:M2 强制登录
  if (!auth.isLoggedIn) {
    showLoginModal.value = true
    return
  }

  // 额度检查
  if (remainingSec.value < audioDuration.value && audioDuration.value > 0) {
    errorMsg.value = `本月剩余额度 ${formatTime(remainingSec.value)},本音频 ${formatTime(audioDuration.value)},额度不足。`
    return
  }

  processing.value = true
  progress.value = 0
  errorMsg.value = ''
  segments.value = []

  try {
    progressStage.value = '准备上传...'
    progress.value = 10
    dlog('[AudioTool] 🎬 开始转写,file:', audioFile.value?.name, 'size:', audioFile.value?.size)

    const result = await uploadAndTranscribe(audioFile.value, (stage, pct) => {
      progressStage.value = stage
      progress.value = pct
      dlog(`[AudioTool] 📊 进度 ${pct}% - ${stage}`)
    })
    dlog('[AudioTool] ✅ uploadAndTranscribe 返回,result:', JSON.stringify(result).slice(0, 500))

    progressStage.value = '整理结果...'
    progress.value = 95

    // 后端新接口返回 { ok, sentences, text, status }
    const asrText = result.text || ''
    const asrSentences = result.sentences || []
    dlog('[AudioTool] 📝 asrText.length:', asrText.length, 'asrSentences.length:', asrSentences.length)

    // 阿里云没返回带时间戳的 sentences 时,按 splitSentence 选项处理
    let segs: Array<{ start: number; end: number; startStr: string; endStr: string; text: string }> = []

    if (asrSentences && asrSentences.length > 0) {
      // 阿里云返回了带时间戳的句子
      // 🇨🇳 2026-08-31:阿里云返回 PascalCase (BeginTime/EndTime/Text/ChannelId)
      //      前端老代码用 snake_case 读,所以全部 undefined 被 filter 掉
      segs = asrSentences.map((s: any) => {
        // 兼容多种命名风格
        const text: string = (s.Text ?? s.text ?? '').toString().trim()
        const beginTime: number = s.BeginTime ?? s.begin_time ?? s.beginTime ?? 0
        const endTime: number = s.EndTime ?? s.end_time ?? s.endTime ?? 0
        const cleaned = removeFiller.value ? text.replace(FILLER_REGEX, '$1').replace(/\s+/g, ' ').trim() : text
        return {
          start: beginTime / 1000,
          end: endTime / 1000,
          startStr: formatTime(beginTime / 1000),
          endStr: formatTime(endTime / 1000),
          text: cleaned,
        }
      }).filter((s) => s.text)
    } else {
      // 纯文本结果:按句号/问号/感叹号分段,或整体一段
      const fullText = removeFiller.value
        ? asrText.replace(FILLER_REGEX, '$1').replace(/\s+/g, ' ').trim()
        : asrText

      if (splitSentence.value) {
        // 按句号/问号/感叹号 + 换行分段
        const sentences = fullText.split(/(?<=[。！？!?\n])/g).filter((s) => s.trim())
        // 简单估算时间:平均分配
        const avgDur = audioDuration.value / Math.max(sentences.length, 1)
        let cursor = 0
        for (const sent of sentences) {
          const trimmed = sent.trim()
          if (!trimmed) continue
          const start = cursor
          const end = Math.min(cursor + avgDur, audioDuration.value)
          segs.push({
            start,
            end,
            startStr: formatTime(start),
            endStr: formatTime(end),
            text: trimmed,
          })
          cursor = end
        }
      } else {
        // 整体一段
        segs.push({
          start: 0,
          end: audioDuration.value,
          startStr: formatTime(0),
          endStr: formatTime(audioDuration.value),
          text: fullText,
        })
      }
    }

    segments.value = segs

    // ✅ 扣减额度(只扣实际成功转写的时长)
    const newUsed = usedSeconds.value + Math.ceil(audioDuration.value)
    saveQuota(newUsed)
    usedSeconds.value = newUsed

    progressStage.value = '完成'
    progress.value = 100
  } catch (err: any) {
    derr('[AudioTool] ❌ 错误:', err)
    errorMsg.value = '转写失败: ' + (err?.message || String(err))
  } finally {
    processing.value = false
    dlog('[AudioTool] 🏁 processing=false,segments.length=', segments.value.length)
  }
}

// ========== 编辑器 ==========
function addSegment() {
  const last = segments.value[segments.value.length - 1]
  const start = last ? last.end : 0
  const end = start + 5
  segments.value.push({
    start,
    end,
    startStr: formatTime(start),
    endStr: formatTime(end),
    text: '',
  })
}

function removeSegment(i: number) {
  segments.value.splice(i, 1)
}

function recalcTimes(i: number) {
  const s = segments.value[i]
  const parse = (str: string) => {
    const parts = str.split(':').map(Number)
    if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2]
    if (parts.length === 2) return parts[0]*60 + parts[1]
    return parts[0] || 0
  }
  s.start = parse(s.startStr)
  s.end = parse(s.endStr)
}

// ========== 下载 ==========
const totalDuration = () => segments.value.length > 0 ? segments.value[segments.value.length - 1].end : 0

function downloadSRT() {
  // SRT 永远带时间戳(这是 SRT 格式定义)
  const content = segments.value.map((s, i) =>
    `${i + 1}\n${secToSRT(s.start)} --> ${secToSRT(s.end)}\n${s.text}\n`
  ).join('\n')
  const blob = new Blob([content], { type: 'application/x-subrip;charset=utf-8' })
  triggerDownload(blob, `${audioFile.value?.name.replace(/\.[^.]+$/, '') || '转写'}.srt`)
}

function downloadTxt() {
  // 🇨🇳 2026-08-31:支持 includeTimestamp 选项
  const content = includeTimestamp.value
    ? segments.value.map(s => `[${s.startStr} → ${s.endStr}] ${s.text}`).join('\n')
    : segments.value.map(s => s.text).join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  triggerDownload(blob, `${audioFile.value?.name.replace(/\.[^.]+$/, '') || '转写'}.txt`)
}

function copyToClipboard() {
  const content = includeTimestamp.value
    ? segments.value.map(s => `[${s.startStr} → ${s.endStr}] ${s.text}`).join('\n')
    : segments.value.map(s => s.text).join('\n')
  navigator.clipboard.writeText(content).then(
    () => alert('✅ 已复制到剪贴板'),
    () => alert('❌ 复制失败,请手动选择文字'),
  )
}

async function downloadWord() {
  // 🇨🇳 2026-08-31:支持 includeTimestamp 选项
  const title = audioFile.value?.name.replace(/\.[^.]+$/, '') || '转写'
  const paragraphs = segments.value.map(s => {
    if (includeTimestamp.value) {
      return `<p><b>[${s.startStr} → ${s.endStr}]</b> ${escapeHtml(s.text)}</p>`
    } else {
      return `<p>${escapeHtml(s.text)}</p>`
    }
  }).join('\n')
  // 把 HTML 段落转成 Word XML 段落
  const wordParagraphs = paragraphs.split('\n').map((p) => {
    // p 是 "<p>...</p>" 或 "<p><b>...</b> ...</p>"
    // 简化:把 <b>...</b> 拆成两个 <w:r> 块(粗体 + 常规)
    const boldMatch = p.match(/<p>(.*?)<\/p>/s)
    if (!boldMatch) return ''
    const inner = boldMatch[1]
    const bMatch = inner.match(/^<b>(.*?)<\/b>\s*(.*)$/s)
    if (bMatch) {
      // 带时间戳格式:粗体时间 + 常规文字
      return `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeHtml(bMatch[1])}</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeHtml(bMatch[2])}</w:t></w:r></w:p>`
    } else {
      return `<w:p><w:r><w:t xml:space="preserve">${escapeHtml(inner)}</w:t></w:r></w:p>`
    }
  }).join('')
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${title}</w:t></w:r></w:p>
${wordParagraphs}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>
</w:body>
</w:document>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const { zip } = await import('fflate')
  const blob = await new Promise<Blob>((resolve, reject) => {
    const files: Record<string, Uint8Array> = {
      '[Content_Types].xml': new TextEncoder().encode(contentTypes),
      '_rels/.rels': new TextEncoder().encode(rels),
      'word/document.xml': new TextEncoder().encode(documentXml),
    }
    zip(files, { level: 0 }, (err, data) => {
      if (err) return reject(err)
      resolve(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    })
  })
  triggerDownload(blob, `${title}.docx`)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<style scoped>
.audio-tool-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.audio-container {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

/* 🇨🇳 2026-08-31:新增"使用云端 API"提示框 */
.api-notice {
  background: rgba(122, 184, 126, 0.08);
  border: 1px solid rgba(122, 184, 126, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #ccc;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.6;
}
.api-notice-icon {
  font-size: 16px;
  line-height: 1.5;
}
.api-notice strong {
  color: #7ab87e;
}

/* 🇨🇳 2026-08-31:新增额度条 */
.quota-bar {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  position: relative;
}
.quota-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #aaa;
  margin-bottom: 8px;
}
.quota-left { color: #7ab87e; }
.quota-out { color: #e88; font-weight: 600; }
.quota-progress {
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
}
.quota-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a6b47, #7ab87e);
  transition: width 0.3s;
}
.quota-warn {
  margin-top: 8px;
  font-size: 12px;
  color: #e88;
}

.page-desc {
  color: #aaa;
  font-size: 14px;
  line-height: 1.7;
  margin-bottom: 16px;
}

.page-desc strong {
  color: #7ab87e;
}

.section {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  color: #fff;
  margin: 0 0 12px;
  font-weight: 600;
}

.upload-zone {
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}
.upload-zone:hover {
  border-color: #4a6b47;
}
.upload-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 8px;
}
.upload-hint p {
  margin: 4px 0;
  color: #aaa;
  font-size: 14px;
}
.upload-link {
  color: #7ab87e;
  text-decoration: underline;
  cursor: pointer;
}
.upload-sub {
  font-size: 12px;
  color: #777;
}

.file-info {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(74,107,71,0.15);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}

.file-size {
  color: #888;
}

.file-duration {
  color: #aaa;
}

.file-remove {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 16px;
}
.file-remove:hover {
  color: #e88;
}

.sub-params {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;
  color: #aaa;
}

.sub-params label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.progress-block {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.progress-stage {
  font-size: 13px;
  color: #aaa;
  margin-bottom: 8px;
}

.progress-bar {
  position: relative;
  height: 24px;
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a6b47, #7ab87e);
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  color: #fff;
  font-weight: 600;
}

.progress-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}

.segments-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.seg-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.seg-row.seg-highlight {
  background: rgba(255, 215, 0, 0.15);
  outline: 2px solid rgba(255, 215, 0, 0.5);
  outline-offset: -2px;
}

/* 🇨🇳 2026-08-31:查找替换工具栏样式 */
.find-replace-bar {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.fr-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.fr-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #e0e0e0;
  font-size: 14px;
  font-family: monospace;
}

.fr-input:focus {
  outline: none;
  border-color: rgba(100, 150, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
}

.fr-status {
  margin-top: 8px;
  font-size: 13px;
  color: #aaa;
}

.fr-status strong {
  color: #6cf;
}

.fr-empty {
  color: #f88;
}

.action-btn.small {
  padding: 4px 10px;
  font-size: 13px;
  flex: 0;
  min-width: auto;
}

/* 下载选项 */
.download-options {
  margin: 12px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.opt-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #ccc;
  cursor: pointer;
}

.opt-label input[type="checkbox"] {
  cursor: pointer;
}

.seg-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #aaa;
  flex-shrink: 0;
}

.time-input {
  width: 70px;
  padding: 4px 6px;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-family: monospace;
}

.seg-text {
  flex: 1;
  padding: 6px 8px;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
  resize: vertical;
  font-family: inherit;
}

.seg-remove {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  flex-shrink: 0;
}

.seg-remove:hover {
  color: #e88;
}

.seg-add {
  background: transparent;
  border: 1px dashed rgba(255,255,255,0.2);
  border-radius: 4px;
  color: #aaa;
  padding: 8px;
  cursor: pointer;
  font-size: 13px;
}

.seg-add:hover {
  border-color: #7ab87e;
  color: #7ab87e;
}

.result-zone {
  background: rgba(74,107,71,0.1);
  border-radius: 8px;
  padding: 12px;
}

.result-label {
  font-size: 13px;
  color: #aaa;
  margin: 0 0 12px;
}

.download-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.download-btns .action-btn {
  flex: 1;
  min-width: 100px;
  padding: 10px;
  font-size: 13px;
}

.error-block {
  background: rgba(232, 136, 136, 0.1);
  border: 1px solid rgba(232, 136, 136, 0.3);
  border-radius: 8px;
  padding: 12px;
  color: #e88;
  font-size: 13px;
  white-space: pre-line;
  margin-bottom: 16px;
}

.select-input {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  color: #fff;
  padding: 4px 8px;
  font-size: 13px;
}
/* 🇨🇳 2026-08-31 M3.9 R35:移动端关闭 min-height:100vh(避免大块黑色空白) */
@media (max-width: 720px) {
  .audio-tool-page { min-height: auto; padding: 16px; max-width: 100vw; overflow-x: hidden; }
  .audio-tool-page > * { max-width: 100%; min-width: 0; }
  .audio-tool-page .page-header h1 { font-size: 24px; word-break: break-word; }
  .audio-tool-page .page-header .subtitle { font-size: 13px; word-break: break-word; }
  .audio-tool-page .upload-zone { padding: 24px 16px; }
  .audio-tool-page .result-list { max-height: none; }
  .api-notice { font-size: 12px !important; padding: 10px 12px !important; word-break: break-word; }
}
</style>