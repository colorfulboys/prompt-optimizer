<!--
  🇨🇳 2026-09-04 R51.2:Tab 2 — 图片裁剪 + 水印
  - 自由裁剪(4 个角拖拽) + 等比预设
  - 文字水印 / 图片水印 / 平铺
  - 6 个角落位置
-->
<template>
  <div class="image-crop-tab">
    <div class="tab-intro">
      <h2>✂️ 图片裁剪 + 水印</h2>
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
      </template>
      <template v-else>
        <div class="file-info">
          🖼️ {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024).toFixed(1) }} KB · {{ originalDimensions }}</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
    </div>

    <template v-if="selectedFile">
      <h3>2️⃣ 裁剪设置</h3>
      <div class="preset-crop">
        <button class="preset-crop-btn" @click="setCropPreset('free')">自由</button>
        <button class="preset-crop-btn" @click="setCropPreset('1:1')">1:1</button>
        <button class="preset-crop-btn" @click="setCropPreset('4:3')">4:3</button>
        <button class="preset-crop-btn" @click="setCropPreset('16:9')">16:9</button>
        <button class="preset-crop-btn" @click="setCropPreset('3:4')">3:4</button>
        <button class="preset-crop-btn" @click="setCropPreset('9:16')">9:16</button>
      </div>
      <div class="canvas-wrap">
        <div class="canvas-stage" ref="stageEl" @mousedown="onStageDown" @mousemove="onStageMove" @mouseup="onStageUp" @mouseleave="onStageUp">
          <canvas ref="canvasEl"></canvas>
          <div v-if="crop" class="crop-box" :style="cropBoxStyle">
            <div class="crop-handle nw" data-handle="nw"></div>
            <div class="crop-handle ne" data-handle="ne"></div>
            <div class="crop-handle sw" data-handle="sw"></div>
            <div class="crop-handle se" data-handle="se"></div>
          </div>
        </div>
        <p class="canvas-hint">💡 拖拽画框调整 · 等比模式自动保持比例 · 自由模式可任意拖拽</p>
      </div>

      <h3>3️⃣ 水印(可选)</h3>
      <div class="watermark-panel">
        <label class="check-row">
          <input type="checkbox" v-model="watermark.enabled" />
          <span>加水印</span>
        </label>
        <template v-if="watermark.enabled">
          <div class="option-row">
            <label class="opt-label">水印类型</label>
            <select v-model="watermark.type">
              <option value="text">文字</option>
              <option value="image">图片</option>
            </select>
          </div>
          <div v-if="watermark.type === 'text'" class="option-row">
            <label class="opt-label">水印文字</label>
            <input type="text" v-model="watermark.text" placeholder="例:简盒 Jianhebox" />
          </div>
          <div v-if="watermark.type === 'image'" class="option-row">
            <label class="opt-label">水印图片</label>
            <input type="file" accept="image/*" @change="onWatermarkImage" />
          </div>
          <div class="option-row">
            <label class="opt-label">位置</label>
            <select v-model="watermark.position">
              <option value="top-left">左上</option>
              <option value="top-right">右上</option>
              <option value="bottom-left">左下</option>
              <option value="bottom-right">右下</option>
              <option value="center">居中</option>
              <option value="tile">平铺</option>
            </select>
          </div>
          <div class="option-row">
            <label class="opt-label">透明度 ({{ watermark.opacity }})</label>
            <input type="range" min="0.1" max="1" step="0.1" v-model.number="watermark.opacity" />
          </div>
        </template>
      </div>

      <h3>4️⃣ 输出</h3>
      <div class="output-panel">
        <div class="option-row">
          <label class="opt-label">格式</label>
          <select v-model="output.format">
            <option value="image/jpeg">JPG</option>
            <option value="image/png">PNG</option>
            <option value="image/webp">WebP</option>
          </select>
        </div>
        <div v-if="output.format !== 'image/png'" class="option-row">
          <label class="opt-label">质量 ({{ output.quality }})</label>
          <input type="range" min="0.5" max="1" step="0.05" v-model.number="output.quality" />
        </div>
      </div>

      <button class="btn-primary" :disabled="!crop || isProcessing" @click="onStart">
        {{ isProcessing ? `处理中... ${progress}%` : '应用裁剪 + 水印' }}
      </button>
    </template>

    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>处理完成!</strong>
        <small>{{ (resultBlob.size / 1024).toFixed(1) }} KB</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { cropAndWatermark, downloadBlobHelper, type CropWatermarkOpts, type WatermarkType } from '@/utils/image/image-processor'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const stageEl = ref<HTMLDivElement | null>(null)
const originalDimensions = ref('')

const crop = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const cropMode = ref<'free' | '1:1' | '4:3' | '16:9' | '3:4' | '9:16'>('free')

// 🇨🇳 R52.17 fix:存 canvas 缩放比例(原图 → canvas),crop.value 是 canvas 坐标
//  传给 image-processor 前要乘以 1/canvasRatio 转回原图坐标
const canvasRatio = ref(1)

// 🇨🇳 R52.17:拖拽状态 — 用 stage 上的 mousedown 触发
// 区分:点击空白处(画新框)/点击 crop-box 内部(移动框)/点击 handle(调整大小)
const dragMode = ref<'none' | 'create' | 'move' | 'resize'>('none')
const dragHandle = ref<'nw' | 'ne' | 'sw' | 'se' | null>(null)
const dragStart = ref<{ mx: number; my: number; crop: { x: number; y: number; width: number; height: number } } | null>(null)

// crop-box overlay 的样式(基于 crop + stage 尺寸)
const cropBoxStyle = computed(() => {
  if (!crop.value || !canvasEl.value) return {}
  const r = canvasEl.value.getBoundingClientRect()
  const sx = r.width / canvasEl.value.width
  const sy = r.height / canvasEl.value.height
  return {
    left: (crop.value.x * sx) + 'px',
    top: (crop.value.y * sy) + 'px',
    width: (crop.value.width * sx) + 'px',
    height: (crop.value.height * sy) + 'px',
  }
})

const watermark = ref({
  enabled: false,
  type: 'text' as WatermarkType,
  text: '简盒 jianhebox',
  position: 'bottom-right' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile',
  opacity: 0.5,
})

const output = ref({
  format: 'image/jpeg' as 'image/jpeg' | 'image/png' | 'image/webp',
  quality: 0.92,
})

const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (f && f.type.startsWith('image/')) applyFile(f)
}
function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) applyFile(f)
}
function applyFile(f: File) {
  selectedFile.value = f
  resultBlob.value = null
  errorMsg.value = ''
  crop.value = null
  // 等 canvas 渲染后拿尺寸
  setTimeout(() => {
    if (canvasEl.value) {
      const ctx = canvasEl.value.getContext('2d')
      const ctx2d = ctx as CanvasRenderingContext2D | null
      if (ctx2d) {
        const img = new Image()
        img.onload = () => {
          originalDimensions.value = `${img.naturalWidth} × ${img.naturalHeight}`
          drawBaseImage(img)
        }
        img.src = URL.createObjectURL(f)
      }
    }
  }, 0)
}

function drawBaseImage(img: HTMLImageElement) {
  if (!canvasEl.value) return
  const maxW = 600
  const ratio = Math.min(maxW / img.naturalWidth, 1)
  canvasRatio.value = ratio  // 🇨🇳 R52.17 fix:保存缩放比
  canvasEl.value.width = img.naturalWidth * ratio
  canvasEl.value.height = img.naturalHeight * ratio
  const ctx = canvasEl.value.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvasEl.value.width, canvasEl.value.height)
}

function setCropPreset(mode: typeof cropMode.value) {
  cropMode.value = mode
  if (!canvasEl.value) return
  const w = canvasEl.value.width
  const h = canvasEl.value.height
  if (mode === 'free') {
    // 🇨🇳 R52.17:自由模式默认给一个覆盖大半图的框,让用户可拖拽
    crop.value = { x: w * 0.1, y: h * 0.1, width: w * 0.8, height: h * 0.8 }
    return
  }
  const ratios: Record<string, [number, number]> = {
    '1:1': [1, 1], '4:3': [4, 3], '16:9': [16, 9], '3:4': [3, 4], '9:16': [9, 16],
  }
  const [rw, rh] = ratios[mode]
  let cw = w
  let ch = w * (rh / rw)
  if (ch > h) { ch = h; cw = h * (rw / rh) }
  crop.value = {
    x: (w - cw) / 2,
    y: (h - ch) / 2,
    width: cw,
    height: ch,
  }
}

// 🇨🇳 R52.17:拖拽逻辑(mousedown/move/up)替换 R51.2 的 onCanvasClick(纯点击)
// 把屏幕坐标(mouseX/mouseY)转换为 canvas 内部坐标(canvasX/canvasY)
function screenToCanvas(clientX: number, clientY: number): { x: number; y: number } | null {
  if (!canvasEl.value) return null
  const r = canvasEl.value.getBoundingClientRect()
  return {
    x: (clientX - r.left) * (canvasEl.value.width / r.width),
    y: (clientY - r.top) * (canvasEl.value.height / r.height),
  }
}

// 检查 (x, y) 是否在 crop 内(用于决定 mousedown 是 move 还是 create)
function pointInCrop(x: number, y: number): boolean {
  if (!crop.value) return false
  const c = crop.value
  return x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height
}

// 找 handle(target.dataset.handle)
function handleFromTarget(t: HTMLElement | null): 'nw' | 'ne' | 'sw' | 'se' | null {
  while (t && t.dataset && !t.dataset.handle) t = t.parentElement as HTMLElement | null
  if (!t || !t.dataset || !t.dataset.handle) return null
  const h = t.dataset.handle
  return h === 'nw' || h === 'ne' || h === 'sw' || h === 'se' ? h : null
}

function onStageDown(e: MouseEvent) {
  if (!canvasEl.value) return
  const pt = screenToCanvas(e.clientX, e.clientY)
  if (!pt) return

  // 如果点到 handle → resize
  const handle = handleFromTarget(e.target as HTMLElement)
  if (handle && crop.value) {
    dragMode.value = 'resize'
    dragHandle.value = handle
    dragStart.value = { mx: pt.x, my: pt.y, crop: { ...crop.value } }
    e.preventDefault()
    return
  }

  // 如果点到 crop 内部 → move
  if (pointInCrop(pt.x, pt.y) && crop.value) {
    dragMode.value = 'move'
    dragStart.value = { mx: pt.x, my: pt.y, crop: { ...crop.value } }
    e.preventDefault()
    return
  }

  // 否则 → create 新框(在画布坐标系)
  dragMode.value = 'create'
  cropMode.value = 'free'  // 🇨🇳 R52.17:拖拽画的框都是自由比例
  crop.value = { x: pt.x, y: pt.y, width: 0, height: 0 }
  dragStart.value = { mx: pt.x, my: pt.y, crop: { ...crop.value } }
  e.preventDefault()
}

function onStageMove(e: MouseEvent) {
  if (dragMode.value === 'none' || !dragStart.value || !canvasEl.value) return
  const pt = screenToCanvas(e.clientX, e.clientY)
  if (!pt) return
  const w = canvasEl.value.width
  const h = canvasEl.value.height
  const start = dragStart.value
  const dx = pt.x - start.mx
  const dy = pt.y - start.my

  if (dragMode.value === 'create') {
    const x = Math.min(start.mx, pt.x)
    const y = Math.min(start.my, pt.y)
    const width = Math.abs(dx)
    const height = Math.abs(dy)
    crop.value = {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(width, w - x),
      height: Math.min(height, h - y),
    }
  } else if (dragMode.value === 'move' && crop.value) {
    let nx = start.crop.x + dx
    let ny = start.crop.y + dy
    nx = Math.max(0, Math.min(nx, w - start.crop.width))
    ny = Math.max(0, Math.min(ny, h - start.crop.height))
    crop.value = { ...start.crop, x: nx, y: ny }
  } else if (dragMode.value === 'resize' && crop.value && dragHandle.value) {
    const c0 = start.crop
    let x = c0.x, y = c0.y, cw = c0.width, ch = c0.height
    if (dragHandle.value === 'nw') {
      x = c0.x + dx; y = c0.y + dy; cw = c0.width - dx; ch = c0.height - dy
    } else if (dragHandle.value === 'ne') {
      y = c0.y + dy; cw = c0.width + dx; ch = c0.height - dy
    } else if (dragHandle.value === 'sw') {
      x = c0.x + dx; cw = c0.width - dx; ch = c0.height + dy
    } else if (dragHandle.value === 'se') {
      cw = c0.width + dx; ch = c0.height + dy
    }
    // preset 模式保持宽高比
    if (cropMode.value !== 'free') {
      const ratios: Record<string, [number, number]> = {
        '1:1': [1, 1], '4:3': [4, 3], '16:9': [16, 9], '3:4': [3, 4], '9:16': [9, 16],
      }
      const [rw, rh] = ratios[cropMode.value]
      const targetRatio = rw / rh
      if (cw / ch > targetRatio) cw = ch * (rw / rh)
      else ch = cw * (rh / rw)
    }
    // 边界裁剪
    if (x < 0) { cw += x; x = 0 }
    if (y < 0) { ch += y; y = 0 }
    if (x + cw > w) cw = w - x
    if (y + ch > h) ch = h - y
    cw = Math.max(1, cw)
    ch = Math.max(1, ch)
    crop.value = { x, y, width: cw, height: ch }
  }
}

function onStageUp() {
  if (dragMode.value === 'none') return
  dragMode.value = 'none'
  dragHandle.value = null
  dragStart.value = null
}

function onWatermarkImage(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  watermark.value.type = 'image'
  if (f) (watermark.value as any).image = f
}

async function onStart() {
  if (!selectedFile.value) return
  isProcessing.value = true
  progress.value = 0
  resultBlob.value = null
  errorMsg.value = ''
  try {
    // 🇨🇳 R52.17 fix:crop.value 是 canvas 缩放后坐标,要转回原图坐标
    //   canvasRatio = 原图 → canvas(0.15 表示 0.15 倍)
    //   原图坐标 = canvas 坐标 / canvasRatio
    let cropInOriginal = crop.value
    if (crop.value && canvasRatio.value > 0 && canvasRatio.value !== 1) {
      const inv = 1 / canvasRatio.value
      cropInOriginal = {
        x: crop.value.x * inv,
        y: crop.value.y * inv,
        width: crop.value.width * inv,
        height: crop.value.height * inv,
      }
      console.log('[R52.17] crop 坐标转换: canvas', crop.value, '→ original', cropInOriginal, '(ratio=', canvasRatio.value, ')')
    }

    const opts: CropWatermarkOpts = {
      crop: cropInOriginal || undefined,
      format: output.value.format,
      quality: output.value.quality,
    }
    if (watermark.value.enabled) {
      opts.watermark = {
        type: watermark.value.type,
        text: watermark.value.text,
        position: watermark.value.position,
        opacity: watermark.value.opacity,
      }
      const img = (watermark.value as any).image
      if (watermark.value.type === 'image' && img) opts.watermark.image = img
    }
    const blob = await cropAndWatermark(selectedFile.value, opts)
    resultBlob.value = blob
    progress.value = 100
  } catch (e: any) {
    errorMsg.value = e?.message || String(e)
  } finally {
    isProcessing.value = false
  }
}

function downloadResult() {
  if (!resultBlob.value || !selectedFile.value) return
  const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
  const ext = output.value.format.split('/')[1]
  downloadBlobHelper(resultBlob.value, `${baseName}-edit.${ext}`)
}
</script>

<style scoped>
.image-crop-tab { color: #fff; }
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

.preset-crop {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.preset-crop-btn {
  padding: 6px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.preset-crop-btn:hover { background: rgba(255,255,255,0.12); }

.canvas-wrap {
  background: rgba(0,0,0,0.4);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
}
.canvas-wrap canvas {
  max-width: 100%;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  cursor: crosshair;
}

/* 🇨🇳 R52.17:canvas-stage 容器 — canvas + overlay 同坐标 */
.canvas-stage {
  position: relative;
  display: inline-block;
  line-height: 0;  /* 避免图片间隙 */
}
.canvas-stage canvas {
  display: block;
}
.crop-box {
  position: absolute;
  border: 2px dashed #60a5fa;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);  /* 框外半透明黑 */
  cursor: move;
  pointer-events: none;  /* crop-box 本身不接收事件,让事件穿透到 .canvas-stage */
}
.crop-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #60a5fa;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: auto;  /* handle 可以点 */
}
.crop-handle.nw { top: -6px; left: -6px; cursor: nwse-resize; }
.crop-handle.ne { top: -6px; right: -6px; cursor: nesw-resize; }
.crop-handle.sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.crop-handle.se { bottom: -6px; right: -6px; cursor: nwse-resize; }
.canvas-hint {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin: 8px 0 0;
  line-height: 1.4;
}

.watermark-panel,
.output-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px 20px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
}
.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgba(255,255,255,0.85);
}
/* R52.5 label 在上 + 控件在下,永不溢出 */
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
.option-row input[type="text"],
.option-row input[type="file"] {
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
