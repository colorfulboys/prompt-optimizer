<!--
  🇨🇳 2026-09-04 R51.3:Tab 3 — 图片转 PDF
  - 多图 → 1 PDF,每图 1 页,A4 自适应
  - 拖拽排序
-->
<template>
  <div class="image-pdf-tab">
    <div class="tab-intro">
      <h2>📄 图片转 PDF</h2>
      <p>pdf-lib 本地处理 · 0 上传 · 多图合一 · A4 自适应</p>
    </div>

    <h3>1️⃣ 选图片(可拖拽排序)</h3>
    <div
      class="drop-zone"
      :class="{ 'has-files': fileList.length > 0 }"
      @click="fileInput?.click()"
      @drop.prevent="onDrop"
      @dragover.prevent
    >
      <template v-if="fileList.length === 0">
        <div class="drop-icon">📁</div>
        <p>点击或拖拽多张图片到此处</p>
        <small>支持 JPG / PNG / WebP / GIF / BMP</small>
      </template>
      <template v-else>
        <p class="add-more-hint">点此处继续添加 ↓</p>
      </template>
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFileChange" />
    </div>

    <template v-if="fileList.length > 0">
      <ol class="file-list">
        <li
          v-for="(f, i) in fileList"
          :key="i"
          class="file-item"
          :class="{ 'dragging': dragIndex === i }"
          draggable="true"
          @dragstart="dragIndex = i"
          @dragover.prevent
          @drop="onDropReorder($event, i)"
        >
          <span class="seq">{{ i + 1 }}</span>
          <span class="name">🖼️ {{ f.name }}</span>
          <small>· {{ (f.size / 1024).toFixed(1) }} KB</small>
          <button class="remove-btn" @click.stop="removeFile(i)" title="移除">✕</button>
        </li>
      </ol>

      <button class="btn-primary" :disabled="isProcessing" @click="onStart">
        {{ isProcessing ? `处理中... ${progress}%` : '开始转 PDF' }}
      </button>
    </template>

    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>PDF 已生成!</strong>
        <small>{{ fileList.length }} 张图 → 1 PDF · {{ (resultBlob.size / 1024).toFixed(1) }} KB</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { imagesToPdf, downloadBlobHelper } from '@/utils/image/image-processor'

const fileList = ref<File[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const dragIndex = ref<number | null>(null)

const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

function onDrop(e: DragEvent) {
  const files = Array.from(e.dataTransfer?.files || [])
  for (const f of files) {
    if (f.type.startsWith('image/')) fileList.value.push(f)
  }
  resultBlob.value = null
  errorMsg.value = ''
}
function onFileChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  for (const f of files) {
    if (f.type.startsWith('image/')) fileList.value.push(f)
  }
  resultBlob.value = null
  errorMsg.value = ''
}
function removeFile(idx: number) {
  fileList.value.splice(idx, 1)
}
function onDropReorder(e: DragEvent, targetIdx: number) {
  if (dragIndex.value === null) return
  if (dragIndex.value === targetIdx) return
  const item = fileList.value.splice(dragIndex.value, 1)[0]
  fileList.value.splice(targetIdx, 0, item)
  dragIndex.value = null
}

async function onStart() {
  if (fileList.value.length === 0) return
  isProcessing.value = true
  progress.value = 0
  resultBlob.value = null
  errorMsg.value = ''
  try {
    const blob = await imagesToPdf(fileList.value)
    resultBlob.value = blob
    progress.value = 100
  } catch (e: any) {
    errorMsg.value = e?.message || String(e)
  } finally {
    isProcessing.value = false
  }
}

function downloadResult() {
  if (!resultBlob.value) return
  downloadBlobHelper(resultBlob.value, `images-${Date.now()}.pdf`)
}
</script>

<style scoped>
.image-pdf-tab { color: #fff; }
.tab-intro { margin-bottom: 24px; }
.tab-intro h2 { font-size: 24px; margin: 0 0 4px; font-weight: 600; }
.tab-intro p { font-size: 14px; color: rgba(255,255,255,0.55); margin: 0; }

h3 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; color: rgba(255,255,255,0.85); }

.drop-zone {
  border: 2px dashed rgba(255,255,255,0.18);
  border-radius: 12px;
  padding: 36px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
  background: rgba(255,255,255,0.02);
}
.drop-zone:hover { border-color: rgba(0,153,255,0.5); }
.drop-zone.has-files { padding: 18px; border-style: solid; border-color: rgba(0,153,255,0.4); background: rgba(0,153,255,0.06); }
.drop-icon { font-size: 36px; margin-bottom: 12px; }
.drop-zone p { margin: 4px 0; font-size: 15px; }
.drop-zone small { color: rgba(255,255,255,0.45); font-size: 12px; }
.add-more-hint { color: rgba(255,255,255,0.5); font-size: 13px; }

.file-list {
  list-style: none;
  padding: 0;
  margin: 16px 0;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: grab;
}
.file-item:hover { background: rgba(255,255,255,0.07); }
.file-item.dragging { opacity: 0.5; }
.file-item .seq {
  flex: 0 0 28px;
  height: 28px;
  background: #0a8aff;
  border-radius: 14px;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.file-item .name {
  flex: 1;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-item small {
  color: rgba(255,255,255,0.5);
  font-size: 12px;
}
.remove-btn {
  background: transparent;
  border: 1px solid rgba(239,68,68,0.4);
  color: #fca5a5;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  cursor: pointer;
}
.remove-btn:hover { background: rgba(239,68,68,0.15); }

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
