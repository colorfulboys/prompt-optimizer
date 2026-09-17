<!--
  🇨🇳 R48:Tab 6 - 人声分离(双引擎自动分流)
  - 视频文件(mp4/mov/avi/mkv)→ 腾讯云 CI VoiceSeparate
    便宜,效果好,但强制 mp4 输入
  - 纯音频(mp3/wav/m4a/flac)→ 火山引擎 AI MediaKit separate-voice
    纯音频原生支持,Bearer 鉴权
  - 输出格式:
    - 两个引擎都返回 vocals + accompaniment MP3
-->
<template>
  <div class="vocal-tab">
    <!-- 🇨🇳 R57:统一登录提示 -->
    <div v-if="!auth.isLoggedIn" class="login-required">
      <div class="login-icon">🔒</div>
      <h3>登录后才能使用人声分离</h3>
      <p>智能 AI 引擎 · 把人声和背景声分开</p>
      <button class="btn-primary" @click="triggerLogin">立即登录</button>
    </div>

    <template v-else>
    <div class="tab-intro">
      <h2>🎤 人声分离</h2>
      <p>智能 AI 引擎 · 把人声和背景声分开</p>
    </div>

    <!-- 🇨🇳 R57:删额度/套餐显示(暂不做付费) -->

    <!-- 1. 选文件 -->
    <h3>1️⃣ 选文件(视频或音频)</h3>
    <div class="drop-area" :class="{ dragging: isDragging }"
         @dragover.prevent="isDragging = true"
         @dragleave="isDragging = false"
         @drop.prevent="onDrop">
      <input ref="fileInput" type="file" accept="video/*,audio/*,.mp4,.mov,.avi,.mkv,.m4v,.mp3,.wav,.m4a,.flac,.aac" hidden @change="onFilePick" />
      <p v-if="!selectedFile">📁 拖拽文件到这里 或 <a href="#" @click.prevent="fileInput?.click()">点此选择</a></p>
      <p v-else>
        ✅ {{ selectedFile.name }} · {{ formatSize(selectedFile.size) }}
        <span v-if="fileEngine" class="engine-badge" :class="fileEngine.class">{{ fileEngine.label }}</span>
      </p>
      <p class="hint">⏱ 最长 45 分钟 · 单文件 ≤ 200MB</p>
    </div>

    <!-- 2. 选模式 -->
    <h3>2️⃣ 选分离模式</h3>
    <div class="mode-grid">
      <button v-for="m in modes" :key="m.id"
              class="mode-chip"
              :class="{ active: selectedMode === m.id }"
              @click="selectedMode = m.id as any">
        <div class="mode-emoji">{{m.emoji}}</div>
        <div class="mode-name">{{m.name}}</div>
        <div class="mode-desc">{{m.desc}}</div>
      </button>
    </div>

    <!-- 3. 开始按钮 -->
    <button class="btn-primary" :disabled="!canStart || isProcessing" @click="onStart">
      {{ btnText }}
    </button>
    <p v-if="!selectedFile" class="hint">💡 请先选文件(视频或音频)</p>

    <!-- 🇨🇳 R47.9:处理进度 -->
    <div v-if="isProcessing || errorMessage" class="status-box" :class="{ error: !!errorMessage }">
      <div v-if="isProcessing" class="processing">
        <div class="spinner"></div>
        <span>{{ statusText }}</span>
      </div>
      <div v-if="errorMessage" class="error-text">❌ {{ errorMessage }}</div>
    </div>

    <!-- 🇨🇳 R47.9:结果展示 -->
    <div v-if="result" class="result-box">
      <h3>✅ 分离完成</h3>
      <p class="result-meta">
        任务 ID: <code>{{ result.jobId }}</code>
        · 耗时 ~{{ result.duration }} 秒
      </p>

      <div v-if="result.vocals" class="result-row">
        <div class="result-label">🎤 人声</div>
        <audio :src="result.vocals" controls preload="metadata"></audio>
        <a class="download-btn" :href="result.vocals" download="vocals.mp3">⬇ 下载</a>
      </div>

      <div v-if="result.accompaniment" class="result-row">
        <div class="result-label">🎵 背景声</div>
        <audio :src="result.accompaniment" controls preload="metadata"></audio>
        <a class="download-btn" :href="result.accompaniment" download="accompaniment.mp3">⬇ 下载</a>
      </div>

      <button class="reset-btn" @click="resetAll">🔄 再来一次</button>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserPlanStore } from '@/stores/useUserPlan'
// 🇨🇳 R57:删 PaywallDialog import

const auth = useAuthStore()
const userPlan = useUserPlanStore()

// 🇨🇳 R47.9:文件
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const isProcessing = ref(false)
const statusText = ref('')
const errorMessage = ref('')

// 🇨🇳 R47.9:分离模式
const modes = [
  { id: 'vocals', emoji: '🎤', name: '只保留人声', desc: '清唱版(acappella)' },
  { id: 'accompaniment', emoji: '🎵', name: '只保留伴奏', desc: '卡拉 OK 伴奏' },
  { id: 'all', emoji: '🎶', name: '全部输出', desc: '同时下载人声+伴奏' },
]
const selectedMode = ref<'vocals' | 'accompaniment' | 'all'>('all')

// 🇨🇳 R47.9:结果
interface VocalResult {
  jobId: string
  vocals: string | null
  accompaniment: string | null
  duration: number
}
const vocalResult = ref<VocalResult | null>(null)
const result = computed(() => vocalResult.value)

// 🇨🇳 R57:删付费弹窗
// const showPaywall = ref(false)

const planName = computed(() => {
  return { free: '免费', plus: 'Plus', pro: 'Pro', studio: 'Studio' }[userPlan.plan]
})

// 🇨🇳 R57:统一登录入口
function triggerLogin() {
  document.querySelector('.av-login-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const canStart = computed(() => !!selectedFile.value && !isProcessing.value)
const btnText = computed(() => {
  if (isProcessing.value) return statusText.value || '处理中...'
  if (!selectedFile.value) return '开始分离'
  return '开始分离'
})

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 🇨🇳 R48.1:人声分离走火山引擎 AI MediaKit
 * 用户业务决策(2026-09-03):所有文件(视频/音频)都走火山
 * - 理由:火山按输入时长计费(¥0.07/分),出 2 轨不翻倍;腾讯按输出(¥0.08/分)选 2 轨可能翻倍
 * - 火山支持纯音频原生(腾讯强制 mp4 视频,需 ffmpeg.wasm 包 mp4)
 * - 火山 Bearer Token 鉴权,简化代码
 * - COS 仅作中转对象存储(给火山拉文件用),不再走 CI
 */
function getFileEngine(_file: File): { engine: 'volc'; label: string; class: string } {
  return { engine: 'volc', label: '☁️ 火山引擎', class: 'engine-volc' }
}

const fileEngine = computed(() => selectedFile.value ? getFileEngine(selectedFile.value) : null)

function onFilePick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) selectFile(f)
}
function onDrop(e: DragEvent) {
  isDragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) selectFile(f)
}
function selectFile(f: File) {
  selectedFile.value = f
  // 选了新文件清空旧结果
  vocalResult.value = null
  errorMessage.value = ''
}

// 🇨🇳 R57:开始 — 已登录(v-if 拦截未登录)
async function onStart() {
  if (!selectedFile.value || isProcessing.value) return

  // 🇨🇳 R57:直接跑流程
  await runSeparation()
}

// 🇨🇳 R48.1:真实跑分离 — 双引擎自动分流 + 本地计时器
async function runSeparation() {
  const file = selectedFile.value!
  const engineInfo = getFileEngine(file)
  isProcessing.value = true
  errorMessage.value = ''
  vocalResult.value = null
  const t0 = Date.now()

  // 🇨🇳 R48.1:AI 阶段本地计时器(每 1 秒更新一次 statusText,火山实测 30-90 秒)
  let timer: ReturnType<typeof setInterval> | null = null
  const startAiTimer = (label: string, hintSec: string) => {
    if (timer) clearInterval(timer)
    const aiStart = Date.now()
    timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - aiStart) / 1000)
      statusText.value = `AI 分离中(${label})· 已等待 ${elapsed} 秒 · ${hintSec}`
    }, 1000)
  }
  const stopTimer = () => {
    if (timer) { clearInterval(timer); timer = null }
  }

  try {
    // Step 1: 签阿里云 OSS PUT URL(浏览器直传,不走 server 中转)
    statusText.value = '准备上传...'
    const fileSize = file.size
    const mimeType = file.type || 'application/octet-stream'
    const upRes = await fetch('/api/audio/vocal-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, mimeType, size: fileSize }),
    })
    const upData = await upRes.json()
    if (!upRes.ok || !upData.ok) throw new Error(upData.error || `签 URL 失败 (HTTP ${upRes.status})`)
    console.log('[VocalTab] 拿到 uploadUrl:', upData.uploadUrl.slice(0, 80) + '...')

    // Step 2: 浏览器直接 PUT 到阿里云 OSS(不经过 server)
    statusText.value = '上传中(直传阿里云 OSS)...'
    const putRes = await fetch(upData.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': upData.mimeType || mimeType },
      body: file,
    })
    if (!putRes.ok) throw new Error(`直传 OSS 失败: HTTP ${putRes.status}`)
    console.log('[VocalTab] 直传成功:', upData.objectKey, fileSize, 'bytes')

    let sepData: any

    // 🇨🇳 R49:用 objectKey 触发分离,server 重新签 4h URL 给火山
    startAiTimer('火山引擎', '一般 30-90 秒')
    const sepRes = await fetch('/api/audio/vocal-separate-volc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectKey: upData.objectKey, outputFormat: 'mp3' }),
    })
    sepData = await sepRes.json()
    if (!sepRes.ok || !sepData.ok) throw new Error(sepData.error || `火山分离失败 (HTTP ${sepRes.status})`)

    stopTimer()
    console.log(`[VocalTab] job done (${engineInfo.engine}):`, sepData)

    // 🇨🇳 R52:工具埋点 — 成功跑完分离才上报
    trackToolUse('audio.vocal-separate', 'audio', {
      engine: engineInfo.engine,
      mode: selectedMode.value,
      jobId: sepData.jobId || sepData.taskId,
      hasVocals: !!sepData.urls?.vocals,
      hasAccompaniment: !!sepData.urls?.accompaniment,
      fileSize,
    }, Date.now() - t0)

    // Step 3: 按用户选的模式,展示对应结果
    const mode = selectedMode.value
    vocalResult.value = {
      jobId: sepData.jobId || sepData.taskId,
      duration: Math.round((Date.now() - t0) / 1000),
      vocals: (mode === 'vocals' || mode === 'all') ? sepData.urls?.vocals ?? null : null,
      accompaniment: (mode === 'accompaniment' || mode === 'all') ? sepData.urls?.accompaniment ?? null : null,
    }
    statusText.value = `完成 ✓ · ${engineInfo.label}`
  } catch (e: any) {
    console.error('[VocalTab] error:', e)
    errorMessage.value = e?.message || '未知错误'
    statusText.value = ''
  } finally {
    stopTimer()
    isProcessing.value = false
  }
}

function resetAll() {
  vocalResult.value = null
  selectedFile.value = null
  errorMessage.value = ''
  statusText.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

// 🇨🇳 R57:删付费回调(暂不做付费)
// function onSubscribed(planId: string) { ... }
// function onTopuped(minutes: number) { ... }
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
.vocal-tab { color: #ffffff; }
.tab-intro h2 { font-size: 24px; margin: 0 0 6px; }
.tab-intro p { color: rgba(255,255,255,0.65); margin: 0 0 4px; }
.tab-intro .tab-warning {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(255,200,0,0.08);
  border: 1px solid rgba(255,200,0,0.25);
  border-radius: 8px;
  color: #ffe066;
  font-size: 13px;
}
.tab-intro h3 { font-size: 16px; margin: 24px 0 12px; }

.vocal-info {
  padding: 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  margin-bottom: 24px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
  color: rgba(255,255,255,0.75);
}
.plan-badge, .trial-badge {
  padding: 2px 10px;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 12px;
}
.plan-badge {
  background: linear-gradient(90deg, rgba(0,153,255,0.3), rgba(0,153,255,0.15));
  border: 1px solid rgba(0,153,255,0.4);
  color: #99ddff;
}
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
.drop-area.dragging { border-color: rgba(0,153,255,0.6); background: rgba(0,153,255,0.08); }
.drop-area a { color: #0099ff; text-decoration: underline; }
.drop-area .hint { color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 8px; }

/* 🇨🇳 R48:引擎标签(选了文件后显示在文件名后面,只走火山) */
.engine-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  vertical-align: middle;
}
.engine-volc {
  background: rgba(255,150,50,0.15);
  border: 1px solid rgba(255,150,50,0.4);
  color: #ffbb88;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.mode-chip {
  padding: 16px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}
.mode-chip:hover { background: rgba(255,255,255,0.08); }
.mode-chip.active {
  background: rgba(0,153,255,0.18);
  border-color: rgba(0,153,255,0.5);
}
.mode-emoji { font-size: 24px; margin-bottom: 4px; }
.mode-name { font-size: 14px; font-weight: 600; }
.mode-desc { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 2px; }

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  background: #0099ff;
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-primary:hover:not(:disabled) { background: #007acc; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,153,255,0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.hint { color: rgba(255,255,255,0.45); font-size: 12px; margin: 8px 0 0; }

/* 🇨🇳 R47.9:状态/结果 */
.status-box {
  margin-top: 20px;
  padding: 14px 18px;
  background: rgba(0,153,255,0.08);
  border: 1px solid rgba(0,153,255,0.3);
  border-radius: 10px;
  font-size: 14px;
}
.status-box.error {
  background: rgba(255,68,68,0.08);
  border-color: rgba(255,68,68,0.4);
}
.processing {
  display: flex;
  align-items: center;
  gap: 12px;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0,153,255,0.3);
  border-top-color: #0099ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.error-text { color: #ff8887c; }

.result-box {
  margin-top: 24px;
  padding: 20px;
  background: rgba(0,200,100,0.06);
  border: 1px solid rgba(0,200,100,0.3);
  border-radius: 12px;
}
.result-box h3 { margin: 0 0 6px; color: #66ff99; font-size: 18px; }
.result-meta { color: rgba(255,255,255,0.55); font-size: 12px; margin-bottom: 16px; }
.result-meta code {
  background: rgba(255,255,255,0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Menlo, monospace;
}
.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.result-row:first-of-type { border-top: 1px solid rgba(255,255,255,0.08); }
.result-label {
  width: 80px;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}
.result-row audio {
  flex: 1;
  min-width: 0;
  height: 36px;
}
.download-btn {
  padding: 6px 14px;
  background: rgba(0,153,255,0.15);
  border: 1px solid rgba(0,153,255,0.4);
  border-radius: 6px;
  color: #99ddff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.download-btn:hover { background: rgba(0,153,255,0.3); }

.reset-btn {
  margin-top: 16px;
  padding: 8px 20px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 9999px;
  color: rgba(255,255,255,0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.reset-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.3); }
</style>