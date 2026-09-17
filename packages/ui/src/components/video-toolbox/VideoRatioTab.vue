<!--
  🇨🇳 2026-09-04 R50.5:Tab 5 — 竖屏 ↔ 横屏
  - 3 个目标比例:16:9 / 9:16 / 1:1
  - 用 ffmpeg scale + crop 居中
  - 简化版 v1:不做模糊背景(后续 R51+ 用 split+overlay 升级)
-->
<template>
  <div class="video-ratio-tab">
    <div class="tab-intro">
      <h2>📱 竖屏 ↔ 横屏</h2>
      <p>FFmpeg.wasm · 画中画 + 模糊背景 · 0 上传 · 不登录</p>
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
        <p>点击或拖拽视频到此处</p>
      </template>
      <template v-else>
        <div class="file-info">
          🎬 {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="video/*" hidden @change="onFileChange" />
    </div>

    <h3>2️⃣ 选目标比例</h3>
    <div class="ratio-options">
      <button
        v-for="r in ratioList"
        :key="r.id"
        class="ratio-card"
        :class="{ active: targetRatio === r.id }"
        @click="targetRatio = r.id as any"
      >
        <div class="ratio-preview" :style="r.previewStyle"></div>
        <div class="ratio-label">{{ r.label }}</div>
        <div class="ratio-meta">{{ r.dim }}</div>
      </button>
    </div>

    <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="onStart">
      {{ isProcessing ? `转换中... ${progress}%` : '开始转换' }}
    </button>
    <p v-if="!selectedFile" class="hint">💡 请先选视频</p>

    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>转换完成!</strong>
        <small>{{ dimLabel }} · {{ (resultBlob.size / 1024 / 1024).toFixed(2) }} MB</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ratioConvert, downloadBlob } from '@/utils/audio/ffmpeg-processor'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const targetRatio = ref<'landscape' | 'portrait' | 'square'>('landscape')
const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

const ratioList = [
  { id: 'landscape', label: '横屏 16:9', dim: '1280 × 720', previewStyle: 'background: rgba(0,153,255,0.4); width: 64px; height: 36px;' },
  { id: 'portrait',  label: '竖屏 9:16',  dim: '720 × 1280', previewStyle: 'background: rgba(0,153,255,0.4); width: 36px; height: 64px;' },
  { id: 'square',    label: '正方形 1:1', dim: '720 × 720',  previewStyle: 'background: rgba(0,153,255,0.4); width: 50px; height: 50px;' },
]

const dimLabel = computed(() => ratioList.find(r => r.id === targetRatio.value)?.dim || '')

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
    const blob = await ratioConvert(selectedFile.value, targetRatio.value, (p) => (progress.value = p))
    resultBlob.value = blob
  } catch (e: any) {
    errorMsg.value = e?.message || String(e)
    console.error('[video ratio]', e)
  } finally {
    isProcessing.value = false
  }
}

function downloadResult() {
  if (!resultBlob.value || !selectedFile.value) return
  const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
  downloadBlob(resultBlob.value, `${baseName}-${targetRatio.value}.mp4`)
}
</script>

<style scoped>
.video-ratio-tab { color: #fff; }
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
.drop-zone:hover { border-color: rgba(0,153,255,0.5); }
.drop-zone.has-file { padding: 24px; border-style: solid; border-color: rgba(0,153,255,0.4); background: rgba(0,153,255,0.08); }
.drop-icon { font-size: 36px; margin-bottom: 12px; }
.drop-zone p { margin: 4px 0; font-size: 15px; }
.file-info { font-size: 15px; }
.file-info small { display: block; margin-top: 4px; color: rgba(255,255,255,0.5); font-size: 12px; }

.ratio-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.ratio-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  text-align: center;
  color: #fff;
  transition: all 0.15s ease;
}
.ratio-card:hover { background: rgba(255,255,255,0.07); }
.ratio-card.active {
  background: rgba(0,153,255,0.15);
  border-color: rgba(0,153,255,0.5);
  box-shadow: inset 0 0 0 1px rgba(0,153,255,0.4);
}
.ratio-preview {
  display: inline-block;
  border-radius: 6px;
  margin-bottom: 10px;
}
.ratio-label { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.ratio-meta { font-size: 12px; color: rgba(255,255,255,0.5); }

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
