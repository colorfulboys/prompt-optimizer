<!-- 🇨🇳 R47.7:Tab 4 - 从视频提取音频(真实 ffmpeg.wasm) -->
<template>
  <div class="extract-tab">
    <div class="tab-intro">
      <h2>🎬 从视频提取音频</h2>
      <p>MP4 / MOV / MKV / WebM / AVI · 浏览器本地处理 · 0 上传</p>
    </div>

    <h3>1️⃣ 选视频</h3>
    <div class="drop-zone" :class="{ 'has-file': selectedFile }" @click="fileInput?.click()"
         @drop.prevent="onDrop" @dragover.prevent>
      <template v-if="!selectedFile">
        <div class="drop-icon">🎬</div>
        <p>点击或拖拽视频文件到此处</p>
      </template>
      <template v-else>
        <div class="file-info">
          🎬 {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="video/*" hidden @change="onFileChange" />
    </div>

    <h3>2️⃣ 选输出格式</h3>
    <div class="format-row">
      <label v-for="fmt in formats" :key="fmt" class="format-card" :class="{ active: format === fmt }">
        <input type="radio" v-model="format" :value="fmt" hidden />
        <div class="format-name">{{ fmt.toUpperCase() }}</div>
      </label>
    </div>

    <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="onStart">
      {{ isProcessing ? `提取中... ${progress}%` : '开始提取' }}
    </button>
    <p v-if="!selectedFile" class="hint">💡 请先选视频文件</p>

    <div v-if="isProcessing" class="progress-bar"><div class="progress-fill" :style="{ width: progress + '%' }"></div></div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>提取完成!</strong>
        <small>{{ (resultBlob.size / 1024 / 1024).toFixed(2) }} MB · {{ format.toUpperCase() }}</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { extractAudioFromVideo, downloadBlob, type AudioFormat } from '@/utils/audio/ffmpeg-processor'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const format = ref<AudioFormat>('mp3')
const formats: AudioFormat[] = ['mp3', 'wav', 'aac', 'flac']
const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) { selectedFile.value = f; resultBlob.value = null; errorMsg.value = '' }
}
function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (f) { selectedFile.value = f; resultBlob.value = null; errorMsg.value = '' }
}
async function onStart() {
  if (!selectedFile.value) return
  isProcessing.value = true
  progress.value = 0
  resultBlob.value = null
  errorMsg.value = ''
  const timer = setInterval(() => { progress.value = Math.min(progress.value + 10, 90) }, 500)
  try {
    const blob = await extractAudioFromVideo(selectedFile.value, format.value)
    resultBlob.value = blob
    progress.value = 100
  } catch (e: any) {
    errorMsg.value = e?.message || '处理失败'
  } finally {
    clearInterval(timer)
    isProcessing.value = false
  }
}
function downloadResult() {
  if (!resultBlob.value || !selectedFile.value) return
  const base = selectedFile.value.name.replace(/\.[^.]+$/, '')
  downloadBlob(resultBlob.value, `${base}.${format.value}`)
}
</script>

<style scoped>
.extract-tab h3 { font-size: 15px; color: rgba(255,255,255,0.85); margin: 24px 0 12px; }
.drop-zone {
  border: 2px dashed rgba(255,255,255,0.2);
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
}
.drop-zone:hover { border-color: #0099ff; background: rgba(0,153,255,0.05); }
.drop-zone.has-file { padding: 20px; }
.drop-icon { font-size: 36px; margin-bottom: 8px; }
.file-info { font-size: 14px; }
.file-info small { display: block; margin-top: 4px; color: rgba(255,255,255,0.5); }
.format-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
.format-card {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 16px 8px;
  text-align: center;
  cursor: pointer;
}
.format-card:hover { border-color: rgba(0,153,255,0.4); }
.format-card.active { border-color: #0099ff; background: rgba(0,153,255,0.1); }
.format-name { font-size: 14px; font-weight: 600; color: #fff; }
.btn-primary {
  padding: 14px 32px;
  background: #0099ff;
  color: #fff;
  border: none;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 20px;
}
.btn-primary:hover:not(:disabled) { background: #007acc; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.hint { color: rgba(255,255,255,0.45); font-size: 12px; margin: 8px 0 0; }
.progress-bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-top: 16px; overflow: hidden; }
.progress-fill { height: 100%; background: #0099ff; transition: width 0.3s; }
.result {
  margin-top: 20px;
  padding: 16px 20px;
  background: rgba(0,200,100,0.1);
  border: 1px solid rgba(0,200,100,0.3);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.result-icon { font-size: 28px; }
.result-info { flex: 1; font-size: 14px; }
.result-info small { display: block; color: rgba(255,255,255,0.5); margin-top: 2px; }
.btn-download {
  padding: 8px 18px;
  background: transparent;
  border: 1px solid rgba(0,200,100,0.4);
  border-radius: 9999px;
  color: #00c864;
  font-weight: 600;
  cursor: pointer;
}
.error {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(255,80,80,0.1);
  border: 1px solid rgba(255,80,80,0.3);
  border-radius: 8px;
  color: #ff8888;
}
</style>