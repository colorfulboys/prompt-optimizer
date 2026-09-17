<!--
  🇨🇳 2026-09-04 R50.1:Tab 1 — 视频压缩(ffmpeg.wasm,0 上传)
  - 默认 720p + CRF 23(用户拍板)
  - 4 个 preset:default / high / small / webm
  - 显示压缩前后体积、压缩率
-->
<template>
  <div class="video-compress-tab">
    <div class="tab-intro">
      <h2>🎞️ 视频压缩</h2>
      <p>FFmpeg.wasm · 浏览器本地处理 · 0 上传 · 不登录也能用</p>
    </div>

    <h3>1️⃣ 选视频</h3>
    <div
      class="drop-zone"
      :class="{ 'has-file': selectedFile }"
      @click="fileInput?.click()"
      @drop.prevent="onDrop"
      @dragover.prevent
    >
      <template v-if="!selectedFile">
        <div class="drop-icon">📁</div>
        <p>点击或拖拽视频文件到此处</p>
        <small>支持 MP4 / WebM / MOV / AVI / MKV</small>
      </template>
      <template v-else>
        <div class="file-info">
          🎬 {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="video/*" hidden @change="onFileChange" />
    </div>

    <h3>2️⃣ 选预设</h3>
    <div class="preset-list">
      <button
        v-for="(p, key) in VIDEO_PRESETS"
        :key="key"
        class="preset-card"
        :class="{ active: presetKey === key }"
        @click="presetKey = key as any"
      >
        <div class="preset-label">{{ p.label }}</div>
        <div class="preset-meta">
          {{ p.resolution > 0 ? p.resolution + 'p' : '原分辨率' }} · CRF {{ p.crf }} · {{ p.format.toUpperCase() }}
        </div>
      </button>
    </div>

    <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="onStart">
      {{ isProcessing ? `压缩中... ${progress}%` : '开始压缩' }}
    </button>
    <p v-if="!selectedFile" class="hint">💡 请先选视频文件</p>

    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>压缩完成!</strong>
        <small>
          {{ (selectedFile!.size / 1024 / 1024).toFixed(2) }} MB → {{ (resultBlob.size / 1024 / 1024).toFixed(2) }} MB
          · 省 {{ compressionRatio }}%
        </small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { compressVideo, VIDEO_PRESETS, downloadBlob } from '@/utils/audio/ffmpeg-processor'
import { trackToolUse } from '@/lib/tracking'

// 🇨🇳 R52:工具埋点 hook(用户每次成功压缩 → 上报 tool_use)
const TOOL_ID = 'video.compress'
const TOOL_CATEGORY = 'video'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const presetKey = ref<keyof typeof VIDEO_PRESETS>('default')
const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

const compressionRatio = computed(() => {
  if (!selectedFile.value || !resultBlob.value) return 0
  const before = selectedFile.value.size
  const after = resultBlob.value.size
  return Math.round(((before - after) / before) * 100)
})

function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (f && f.type.startsWith('video/')) {
    selectedFile.value = f
    resultBlob.value = null
    errorMsg.value = ''
  }
}

function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) {
    selectedFile.value = f
    resultBlob.value = null
    errorMsg.value = ''
  }
}

async function onStart() {
  if (!selectedFile.value) return
  isProcessing.value = true
  progress.value = 0
  resultBlob.value = null
  errorMsg.value = ''
  try {
    const t0 = Date.now()
    const preset = VIDEO_PRESETS[presetKey.value]
    const blob = await compressVideo(selectedFile.value, preset, (p) => (progress.value = p))
    resultBlob.value = blob
    // 🇨🇳 R52:成功上报
    trackToolUse(TOOL_ID, TOOL_CATEGORY, {
      preset: presetKey.value,
      resolution: preset.resolution,
      crf: preset.crf,
      format: preset.format,
      inputBytes: selectedFile.value.size,
      outputBytes: blob.size,
      ratio: compressionRatio.value,
    }, Date.now() - t0)
  } catch (e: any) {
    errorMsg.value = e?.message || String(e)
    console.error('[video compress]', e)
  } finally {
    isProcessing.value = false
  }
}

function downloadResult() {
  if (!resultBlob.value || !selectedFile.value) return
  const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
  downloadBlob(resultBlob.value, `${baseName}-compressed.${VIDEO_PRESETS[presetKey.value].format}`)
}
</script>

<style scoped>
.video-compress-tab { color: #fff; }
.tab-intro { margin-bottom: 24px; }
.tab-intro h2 { font-size: 24px; margin: 0 0 4px; font-weight: 600; }
.tab-intro p { font-size: 14px; color: rgba(255,255,255,0.55); margin: 0; }

h3 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; color: rgba(255,255,255,0.85); }

.drop-zone {
  border: 2px dashed rgba(255,255,255,0.18);
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
  background: rgba(255,255,255,0.02);
}
.drop-zone:hover { border-color: rgba(0,153,255,0.5); background: rgba(0,153,255,0.04); }
.drop-zone.has-file { padding: 24px; border-style: solid; border-color: rgba(0,153,255,0.4); background: rgba(0,153,255,0.08); }
.drop-icon { font-size: 36px; margin-bottom: 12px; }
.drop-zone p { margin: 4px 0; font-size: 15px; color: rgba(255,255,255,0.85); }
.drop-zone small { color: rgba(255,255,255,0.45); font-size: 12px; }
.file-info { font-size: 15px; }
.file-info small { display: block; margin-top: 4px; color: rgba(255,255,255,0.5); }

.preset-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}
.preset-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #fff;
}
.preset-card:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }
.preset-card.active {
  background: rgba(0,153,255,0.15);
  border-color: rgba(0,153,255,0.5);
  box-shadow: inset 0 0 0 1px rgba(0,153,255,0.4);
}
.preset-label { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.preset-meta { font-size: 12px; color: rgba(255,255,255,0.5); }

.btn-primary {
  width: 100%;
  padding: 14px 24px;
  background: linear-gradient(180deg, #0a8aff, #0066dd);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.hint { color: rgba(255,255,255,0.45); font-size: 13px; margin: 8px 0 0; text-align: center; }

.progress-bar { width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; margin-top: 16px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #0a8aff, #00d4ff); transition: width 0.1s; }

.result {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding: 16px 20px;
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.3);
  border-radius: 10px;
}
.result-icon { font-size: 28px; }
.result-info { flex: 1; }
.result-info strong { color: #fff; }
.result-info small { display: block; margin-top: 4px; color: rgba(255,255,255,0.6); font-size: 13px; }
.btn-download {
  padding: 10px 20px;
  background: #22c55e;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.btn-download:hover { background: #16a34a; }

.error {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 13px;
}
</style>
