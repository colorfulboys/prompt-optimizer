<!--
  🇨🇳 2026-09-04 R51.6:Tab 6 — 证件照换底
  - 4 种底色(白/蓝/红/灰)
  - 4 种尺寸(1寸/2寸/小1寸/大1寸)
  - 上传 PNG(透明) → 合成新底
  - v1:要求原图是透明 PNG;B4 AI 抠图跑通后可上传 JPG
-->
<template>
  <div class="image-idphoto-tab">
    <div class="tab-intro">
      <h2>👔 证件照换底</h2>
      <p>Canvas 本地处理 · 0 上传 · 1 寸/2 寸 · 红/蓝/白/灰</p>
    </div>

    <h3>1️⃣ 选照片(建议透明 PNG)</h3>
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
        <small>支持 PNG(透明最佳) / JPG / WebP</small>
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
      <h3>2️⃣ 选尺寸</h3>
      <div class="size-options">
        <button
          v-for="(s, key) in ID_PHOTO_SIZES"
          :key="key"
          class="size-card"
          :class="{ active: sizeKey === key }"
          @click="sizeKey = key as any"
        >
          <div class="size-label">{{ s.label }}</div>
          <div class="size-meta">{{ s.w }} × {{ s.h }} px</div>
        </button>
      </div>

      <h3>3️⃣ 选底色</h3>
      <div class="color-options">
        <button
          v-for="(c, key) in ID_BG_COLORS"
          :key="key"
          class="color-card"
          :class="{ active: bgColorKey === key }"
          :style="{ background: c }"
          @click="bgColorKey = key as any"
        >
          <span class="color-check" v-if="bgColorKey === key">✓</span>
        </button>
      </div>

      <button class="btn-primary" :disabled="isProcessing" @click="onStart">
        {{ isProcessing ? `生成中... ${progress}%` : '生成证件照' }}
      </button>
    </template>

    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>证件照已生成!</strong>
        <small>{{ ID_PHOTO_SIZES[sizeKey].label }} · {{ bgLabel }} · {{ (resultBlob.size / 1024).toFixed(1) }} KB</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { makeIdPhoto, downloadBlobHelper, ID_PHOTO_SIZES, ID_BG_COLORS, type IdPhotoSizeKey, type IdBgColorKey } from '@/utils/image/image-processor'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const originalDimensions = ref('')

const sizeKey = ref<IdPhotoSizeKey>('1-inch')
const bgColorKey = ref<IdBgColorKey>('white')

const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

const bgLabel = computed(() => {
  const map: Record<IdBgColorKey, string> = { white: '白底', blue: '蓝底', red: '红底', gray: '灰底' }
  return map[bgColorKey.value]
})

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
  // 读尺寸
  const img = new Image()
  img.onload = () => { originalDimensions.value = `${img.naturalWidth} × ${img.naturalHeight}` }
  img.src = URL.createObjectURL(f)
}

async function onStart() {
  if (!selectedFile.value) return
  isProcessing.value = true
  progress.value = 0
  resultBlob.value = null
  errorMsg.value = ''
  try {
    const blob = await makeIdPhoto(selectedFile.value, sizeKey.value, bgColorKey.value)
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
  downloadBlobHelper(resultBlob.value, `${baseName}-${sizeKey.value}-${bgColorKey.value}.jpg`)
}
</script>

<style scoped>
.image-idphoto-tab { color: #fff; }
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
.drop-zone small { color: rgba(255,255,255,0.45); font-size: 12px; }
.file-info { font-size: 15px; }
.file-info small { display: block; margin-top: 4px; color: rgba(255,255,255,0.5); font-size: 12px; }

.size-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}
.size-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  color: #fff;
}
.size-card:hover { background: rgba(255,255,255,0.07); }
.size-card.active {
  background: rgba(0,153,255,0.15);
  border-color: rgba(0,153,255,0.5);
  box-shadow: inset 0 0 0 1px rgba(0,153,255,0.4);
}
.size-label { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.size-meta { font-size: 12px; color: rgba(255,255,255,0.5); }

.color-options {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.color-card {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.15s ease;
}
.color-card:hover { transform: scale(1.05); }
.color-card.active { border-color: #0a8aff; box-shadow: 0 0 0 3px rgba(10,138,255,0.3); }
.color-check {
  font-size: 24px;
  font-weight: 700;
  text-shadow: 0 0 4px rgba(0,0,0,0.6);
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
