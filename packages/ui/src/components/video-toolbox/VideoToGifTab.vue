<!--
  🇨🇳 2026-09-04 R50.2:Tab 2 — 视频转 GIF
  - 起止时间(可选,0=全部)
  - 帧率(默认 10)
  - 宽度(默认 480)
  - 显示预估体积(粗略估算)
-->
<template>
  <div class="video-gif-tab">
    <div class="tab-intro">
      <h2>🎬 视频转 GIF</h2>
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
        <p>点击或拖拽视频到此处</p>
        <small>支持 MP4 / WebM / MOV · 推荐 < 30s 片段</small>
      </template>
      <template v-else>
        <div class="file-info">
          🎬 {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="video/*" hidden @change="onFileChange" />
    </div>

    <h3>2️⃣ GIF 参数</h3>
    <div class="options">
      <div class="option-row">
        <label class="opt-label">起止时间(秒,均 0 = 全部)</label>
        <div class="opt-inputs">
          <input type="number" min="0" step="0.1" v-model.number="startSec" placeholder="开始" />
          <input type="number" min="0" step="0.1" v-model.number="durationSec" placeholder="持续" />
        </div>
      </div>
      <div class="option-row">
        <label class="opt-label">帧率 ({{ fps }} fps) · 默认 10,推荐 8-15</label>
        <input type="range" min="5" max="30" step="1" v-model.number="fps" class="opt-range" />
      </div>
      <div class="option-row">
        <label class="opt-label">宽度 ({{ width }}px) · 越小越小</label>
        <input type="range" min="120" max="960" step="40" v-model.number="width" class="opt-range" />
      </div>
    </div>

    <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="onStart">
      {{ isProcessing ? `转换中... ${progress}%` : '开始转 GIF' }}
    </button>
    <p v-if="!selectedFile" class="hint">💡 请先选视频</p>

    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>GIF 已生成!</strong>
        <small>{{ (resultBlob.size / 1024).toFixed(1) }} KB · {{ fps }} fps · {{ width }}px 宽</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { videoToGif, downloadBlob } from '@/utils/audio/ffmpeg-processor'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const startSec = ref(0)
const durationSec = ref(0)
const fps = ref(10)
const width = ref(480)
const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

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
    const blob = await videoToGif(
      selectedFile.value,
      {
        startSec: startSec.value || undefined,
        durationSec: durationSec.value || undefined,
        fps: fps.value,
        width: width.value,
      },
      (p) => (progress.value = p)
    )
    resultBlob.value = blob
  } catch (e: any) {
    errorMsg.value = e?.message || String(e)
    console.error('[video to gif]', e)
  } finally {
    isProcessing.value = false
  }
}

function downloadResult() {
  if (!resultBlob.value || !selectedFile.value) return
  const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
  downloadBlob(resultBlob.value, `${baseName}.gif`)
}
</script>

<style scoped>
.video-gif-tab { color: #fff; }
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

.options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
}
.option-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opt-label {
  font-size: 13px;
  color: rgba(255,255,255,0.85);
}
.opt-inputs {
  display: flex;
  gap: 8px;
}
.opt-inputs input[type="number"] {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
}
.opt-range {
  width: 100%;
  accent-color: #0a8aff;
}

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
