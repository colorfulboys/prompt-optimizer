<!--
  🇨🇳 2026-09-04 R51.1:Tab 1 — 图片压缩(纯 Canvas,0 上传)
  - 质量可调 + 格式互转(jpg/png/webp)
  - 支持最大宽度限制
  - 显示压缩前后体积对比
-->
<template>
  <div class="image-compress-tab">
    <div class="tab-intro">
      <h2>🗜️ 图片压缩</h2>
      <p>Canvas 本地处理 · 0 上传 · 0 依赖 · 不登录也能用</p>
    </div>

    <h3>1️⃣ 选图片</h3>
    <div
      class="drop-zone"
      :class="{ 'has-file': selectedFile }"
      @click="fileInput?.click()"
      @drop.prevent="onDrop"
      @dragover.prevent
    >
      <template v-if="!selectedFile">
        <div class="drop-icon">📁</div>
        <p>点击或拖拽图片到此处</p>
        <small>支持 JPG / PNG / WebP / GIF / BMP</small>
      </template>
      <template v-else>
        <div class="file-info">
          🖼️ {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024).toFixed(1) }} KB · {{ originalDimensions }}</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
    </div>

    <h3>2️⃣ 压缩参数</h3>
    <div class="options">
      <div class="option-row">
        <label class="opt-label">输出格式</label>
        <select v-model="format">
          <option value="image/jpeg">JPG(最通用)</option>
          <option value="image/webp">WebP(最小)</option>
          <option value="image/png">PNG(无损)</option>
        </select>
      </div>
      <div class="option-row">
        <label class="opt-label">质量 ({{ quality }})</label>
        <input type="range" min="0.1" max="1" step="0.05" v-model.number="quality" />
      </div>
      <div class="option-row">
        <label class="opt-label">最大宽度(像素,0=不限制)</label>
        <input type="number" min="0" step="100" v-model.number="maxWidth" />
      </div>
    </div>

    <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="onStart">
      {{ isProcessing ? `压缩中... ${progress}%` : '开始压缩' }}
    </button>
    <p v-if="!selectedFile" class="hint">💡 请先选图片</p>

    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>压缩完成!</strong>
        <small>
          {{ (selectedFile!.size / 1024).toFixed(1) }} KB → {{ (resultBlob.size / 1024).toFixed(1) }} KB
          · 省 {{ compressionRatio }}%
        </small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const format = ref('image/jpeg')
const quality = ref(0.8)
const maxWidth = ref(0)
const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')
const originalDimensions = ref('')

// R51.1:读取原图尺寸
async function loadDimensions(file: File) {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    originalDimensions.value = `${img.naturalWidth} × ${img.naturalHeight}`
    URL.revokeObjectURL(url)
  }
  img.src = url
}

function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (f && f.type.startsWith('image/')) {
    handleFile(f)
  }
}
function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) handleFile(f)
}
function handleFile(f: File) {
  selectedFile.value = f
  resultBlob.value = null
  errorMsg.value = ''
  loadDimensions(f)
}

const compressionRatio = computed(() => {
  if (!selectedFile.value || !resultBlob.value) return 0
  const before = selectedFile.value.size
  const after = resultBlob.value.size
  return Math.round(((before - after) / before) * 100)
})

function onStart() {
  if (!selectedFile.value) return
  isProcessing.value = true
  progress.value = 0
  resultBlob.value = null
  errorMsg.value = ''

  const file = selectedFile.value
  const url = URL.createObjectURL(file)
  const img = new Image()

  img.onerror = () => {
    errorMsg.value = '图片加载失败,请尝试其他格式'
    isProcessing.value = false
    URL.revokeObjectURL(url)
  }

  img.onload = () => {
    try {
      const targetW = maxWidth.value > 0 ? Math.min(maxWidth.value, img.naturalWidth) : img.naturalWidth
      const ratio = targetW / img.naturalWidth
      const targetH = Math.round(img.naturalHeight * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 上下文创建失败')

      // PNG 不适用 toBlob 的 quality,走 PNG 专属路径
      const isPng = format.value === 'image/png'
      ctx.drawImage(img, 0, 0, targetW, targetH)

      progress.value = 50

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            errorMsg.value = '编码失败'
            isProcessing.value = false
            URL.revokeObjectURL(url)
            return
          }
          resultBlob.value = blob
          progress.value = 100
          isProcessing.value = false
          URL.revokeObjectURL(url)
        },
        format.value,
        isPng ? undefined : quality.value
      )
    } catch (e: any) {
      errorMsg.value = e?.message || String(e)
      isProcessing.value = false
      URL.revokeObjectURL(url)
    }
  }

  img.src = url
}

function downloadResult() {
  if (!resultBlob.value || !selectedFile.value) return
  const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
  const ext = format.value.split('/')[1]
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}-compressed.${ext}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<style scoped>
.image-compress-tab { color: #fff; }
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
  gap: 14px;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
}
/* R52.5 跟 VideoToGifTab 一致:label 在上 + 控件在下,永远不水平溢出 */
.option-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opt-label {
  font-size: 13px;
  color: rgba(255,255,255,0.85);
}
.option-row select,
.option-row input[type="number"] {
  width: 100%;
  min-width: 0;
  padding: 8px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
}
.option-row input[type="range"] {
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
