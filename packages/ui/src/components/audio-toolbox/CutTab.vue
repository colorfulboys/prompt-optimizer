<!-- 🇨🇳 R47.7:Tab 2 - 剪辑(真实 ffmpeg.wasm) -->
<template>
  <div class="cut-tab">
    <div class="tab-intro">
      <h2>✂️ 音频剪辑</h2>
      <p>FFmpeg.wasm · 浏览器本地处理 · 0 上传 · 不登录也能用</p>
    </div>

    <h3>1️⃣ 选音频</h3>
    <div class="drop-zone" :class="{ 'has-file': selectedFile }" @click="fileInput?.click()"
         @drop.prevent="onDrop" @dragover.prevent>
      <template v-if="!selectedFile">
        <div class="drop-icon">📁</div>
        <p>点击或拖拽音频文件到此处</p>
      </template>
      <template v-else>
        <div class="file-info">
          🎵 {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="audio/*" hidden @change="onFileChange" />
    </div>

    <h3>2️⃣ 剪取片段</h3>
    <div class="cut-row">
      <label>
        <span>开始时间 (秒)</span>
        <input type="number" min="0" step="0.1" v-model.number="startSec" />
      </label>
      <label>
        <span>结束时间 (秒)</span>
        <input type="number" min="0" step="0.1" v-model.number="endSec" />
      </label>
      <label>
        <span>输出格式</span>
        <select v-model="format">
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
          <option value="aac">AAC</option>
          <option value="flac">FLAC</option>
          <option value="ogg">OGG</option>
        </select>
      </label>
    </div>

    <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="onStart">
      {{ isProcessing ? `处理中... ${progress}%` : '开始剪辑' }}
    </button>
    <p v-if="!selectedFile" class="hint">💡 请先选音频文件</p>

    <div v-if="isProcessing" class="progress-bar"><div class="progress-fill" :style="{ width: progress + '%' }"></div></div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>剪辑完成!</strong>
        <small>{{ (resultBlob.size / 1024 / 1024).toFixed(2) }} MB · {{ format.toUpperCase() }}</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { cutAudio, downloadBlob, type AudioFormat } from '@/utils/audio/ffmpeg-processor'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const startSec = ref(0)
const endSec = ref(10)
const format = ref<AudioFormat>('mp3')
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
  if (endSec.value <= startSec.value) { errorMsg.value = '结束时间必须大于开始时间'; return }
  isProcessing.value = true
  progress.value = 0
  resultBlob.value = null
  errorMsg.value = ''
  const timer = setInterval(() => { progress.value = Math.min(progress.value + 10, 90) }, 400)
  try {
    const blob = await cutAudio(selectedFile.value, startSec.value, endSec.value, format.value)
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
  downloadBlob(resultBlob.value, `${base}_cut.${format.value}`)
}
</script>

<style scoped>
.cut-tab h3 { font-size: 15px; color: rgba(255,255,255,0.85); margin: 24px 0 12px; }
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
.cut-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.cut-row label { display: flex; flex-direction: column; gap: 6px; }
.cut-row span { font-size: 12px; color: rgba(255,255,255,0.6); }
.cut-row input, .cut-row select {
  padding: 8px 12px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
}
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