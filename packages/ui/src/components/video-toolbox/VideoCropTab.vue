<!--
  🇨🇳 2026-09-04 R50.3:Tab 3 — 视频去水印
  - 默认裁剪底部 20%(大多数水印位置)
  - 可拖拽选区(mousedown/move/up)
  - 显示原视频区 + 选区遮罩
  - 范围比例相对原视频 0-1
-->
<template>
  <div class="video-crop-tab">
    <div class="tab-intro">
      <h2>✂️ 视频去水印</h2>
      <p>FFmpeg.wasm · 拖框选水印区域 · 浏览器本地处理 · 0 上传</p>
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

    <template v-if="selectedFile">
      <h3>2️⃣ 框选要保留的视频区域(框外自动裁切)</h3>
      <div
        ref="videoContainer"
        class="video-canvas-wrap"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
      >
        <video
          ref="videoEl"
          class="video-preview"
          :src="videoUrl"
          controls
          muted
          preload="metadata"
        ></video>

        <!-- 已选择区域遮罩(深色半透明) -->
        <div
          v-if="selection.width > 0 && selection.height > 0"
          class="selection"
          :style="selectionStyle"
        ></div>
        <!-- 当前拖拽中的矩形 -->
        <div
          v-if="isDragging && currentRect.width > 0"
          class="selection dragging"
          :style="currentRectStyle"
        ></div>
      </div>

      <div class="quick-presets">
        <button class="preset-btn" @click="applyPreset('bottom-right')">右下角</button>
        <button class="preset-btn" @click="applyPreset('top-left')">左上角</button>
        <button class="preset-btn" @click="applyPreset('bottom-bar')">底栏</button>
        <button class="preset-btn" @click="clearSelection">清空</button>
      </div>

      <div class="coords">
        <span>选区:</span>
        <span>x = {{ formatPct(selection.x) }}%</span>
        <span>y = {{ formatPct(selection.y) }}%</span>
        <span>w = {{ formatPct(selection.width) }}%</span>
        <span>h = {{ formatPct(selection.height) }}%</span>
      </div>

      <button class="btn-primary" :disabled="!hasSelection || isProcessing" @click="onStart">
        {{ isProcessing ? `裁剪中... ${progress}%` : '裁剪去水印' }}
      </button>
    </template>
    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>裁剪完成!</strong>
        <small>{{ (resultBlob.size / 1024 / 1024).toFixed(2) }} MB · 选区已去除</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { cropVideo, downloadBlob } from '@/utils/audio/ffmpeg-processor'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const videoContainer = ref<HTMLDivElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const videoUrl = ref('')

const selection = ref({ x: 0, y: 0, width: 0, height: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const currentRect = ref({ x: 0, y: 0, width: 0, height: 0 })

const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

const hasSelection = computed(() => selection.value.width > 0 && selection.value.height > 0)

function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (f && f.type.startsWith('video/')) applyFile(f)
}
function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) applyFile(f)
}
function applyFile(f: File) {
  selectedFile.value = f
  resultBlob.value = null
  errorMsg.value = ''
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
  videoUrl.value = URL.createObjectURL(f)
  selection.value = { x: 0, y: 0, width: 0, height: 0 }
}

function getContainerRect() {
  if (!videoContainer.value) return { w: 1, h: 1 }
  const r = videoContainer.value.getBoundingClientRect()
  return { w: r.width, h: r.height }
}

function onMouseDown(e: MouseEvent) {
  const box = videoContainer.value!.getBoundingClientRect()
  const x = e.clientX - box.left
  const y = e.clientY - box.top
  dragStart.value = { x, y }
  currentRect.value = { x, y, width: 0, height: 0 }
  isDragging.value = true
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const box = videoContainer.value!.getBoundingClientRect()
  const x = e.clientX - box.left
  const y = e.clientY - box.top
  currentRect.value = {
    x: Math.min(dragStart.value.x, x),
    y: Math.min(dragStart.value.y, y),
    width: Math.abs(x - dragStart.value.x),
    height: Math.abs(y - dragStart.value.y),
  }
}

function onMouseUp() {
  if (!isDragging.value) return
  isDragging.value = false
  if (currentRect.value.width > 4 && currentRect.value.height > 4) {
    const { w: cw, h: ch } = getContainerRect()
    // 反向映射:视频实际像素 vs 显示像素(假设 video object-fit:contain 完全填充并保持比例)
    // 简化:认为显示宽高就是裁剪范围
    const sx = currentRect.value.x / cw
    const sy = currentRect.value.y / ch
    const sw = currentRect.value.width / cw
    const sh = currentRect.value.height / ch
    selection.value = {
      x: Math.max(0, Math.min(1 - sw, sx)),
      y: Math.max(0, Math.min(1 - sh, sy)),
      width: Math.min(sw, 1),
      height: Math.min(sh, 1),
    }
    currentRect.value = { x: 0, y: 0, width: 0, height: 0 }
  }
}

const selectionStyle = computed(() => ({
  left: (selection.value.x * 100) + '%',
  top: (selection.value.y * 100) + '%',
  width: (selection.value.width * 100) + '%',
  height: (selection.value.height * 100) + '%',
}))
const currentRectStyle = computed(() => ({
  left: ((currentRect.value.x / Math.max(1, videoContainer.value?.clientWidth || 1)) * 100) + '%',
  top: ((currentRect.value.y / Math.max(1, videoContainer.value?.clientHeight || 1)) * 100) + '%',
  width: ((currentRect.value.width / Math.max(1, videoContainer.value?.clientWidth || 1)) * 100) + '%',
  height: ((currentRect.value.height / Math.max(1, videoContainer.value?.clientHeight || 1)) * 100) + '%',
}))

function applyPreset(name: 'bottom-right' | 'top-left' | 'bottom-bar') {
  if (!videoEl.value || !videoContainer.value) return
  const w = videoEl.value.videoWidth || 1920
  const h = videoEl.value.videoHeight || 1080
  let sx = 0, sy = 0, sw = 0, sh = 0
  if (name === 'bottom-right') { sx = w * 0.7; sy = h * 0.8; sw = w * 0.3; sh = h * 0.18 }
  else if (name === 'top-left') { sx = 0; sy = 0; sw = w * 0.3; sh = h * 0.18 }
  else { sx = 0; sy = h * 0.85; sw = w; sh = h * 0.15 }
  selection.value = {
    x: sx / w,
    y: sy / h,
    width: sw / w,
    height: sh / h,
  }
  if (errorMsg.value) errorMsg.value = ''
}

function clearSelection() {
  selection.value = { x: 0, y: 0, width: 0, height: 0 }
}

function formatPct(v: number): string {
  return String(Math.round(v * 100))
}

async function onStart() {
  if (!selectedFile.value || !hasSelection.value) return
  isProcessing.value = true
  progress.value = 0
  resultBlob.value = null
  errorMsg.value = ''
  try {
    // 🇨🇳 R52.4:UI 框选语义 = "保留这块",正好对应 crop=rect=保留(不去掉 inverse 选项,留作向后兼容)
    const blob = await cropVideo(selectedFile.value, {
      startXRatio: selection.value.x,
      startYRatio: selection.value.y,
      widthRatio: selection.value.width,
      heightRatio: selection.value.height,
      inverse: false,  // 🇨🇳 R52.4:rect=保留,框外裁切(用户原话:"框选=我要保留的输出区")
    }, (p) => (progress.value = p))
    resultBlob.value = blob
  } catch (e: any) {
    errorMsg.value = e?.message || String(e)
    console.error('[video crop]', e)
  } finally {
    isProcessing.value = false
  }
}

function downloadResult() {
  if (!resultBlob.value || !selectedFile.value) return
  const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
  downloadBlob(resultBlob.value, `${baseName}-cropped.mp4`)
}

onBeforeUnmount(() => {
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
})
</script>

<style scoped>
.video-crop-tab { color: #fff; }
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

.video-canvas-wrap {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  cursor: crosshair;
  user-select: none;
  margin-bottom: 12px;
}
.video-preview {
  width: 100%;
  display: block;
  max-height: 60vh;
}
.selection {
  position: absolute;
  border: 2px solid #0a8aff;
  background: rgba(10, 138, 255, 0.18);
  pointer-events: none;
}
.selection.dragging {
  background: rgba(10, 138, 255, 0.3);
  border-style: dashed;
}

.quick-presets {
  display: flex;
  flex-wrap: wrap;  /* R52.6 viewport 窄时按钮换行 */
  gap: 8px;
  margin-bottom: 12px;
}
.preset-btn {
  padding: 6px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.preset-btn:hover { background: rgba(255,255,255,0.12); }

.coords {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  margin-bottom: 16px;
}
.coords > span:first-child {
  color: rgba(255,255,255,0.45);
  font-weight: 600;
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
