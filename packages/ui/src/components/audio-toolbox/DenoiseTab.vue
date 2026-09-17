<!--
  🇨🇳 R47.7:Tab 5 - 降噪(RNNoise + FFmpeg afftdn)
  两档:轻(nf=-20) / 重(nf=-40 + highpass + lowpass)
  浏览器本地,0 上传,不登录
-->
<template>
  <div class="denoise-tab">
    <div class="tab-intro">
      <h2>🔇 降噪</h2>
      <p>FFT 智能降噪 · 浏览器本地处理 · 0 上传 · 不登录也能用</p>
    </div>

    <h3>1️⃣ 选音频</h3>
    <div class="drop-zone" :class="{ 'has-file': selectedFile }" @click="fileInput?.click()"
         @drop.prevent="onDrop" @dragover.prevent>
      <template v-if="!selectedFile">
        <div class="drop-icon">📁</div>
        <p>点击或拖拽音频文件到此处</p>
        <small>MP3 / WAV / AAC / FLAC / OGG · 最大 100MB</small>
      </template>
      <template v-else>
        <div class="file-info">
          🎵 {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="audio/*" hidden @change="onFileChange" />
    </div>

    <h3>2️⃣ 选降噪强度</h3>
    <div class="level-selector">
      <label class="level-card" :class="{ active: level === 'light' }">
        <input type="radio" v-model="level" value="light" hidden />
        <div class="level-icon">🌤</div>
        <div class="level-title">轻</div>
        <div class="level-desc">轻微底噪 · 保留更多原始音色</div>
      </label>
      <label class="level-card" :class="{ active: level === 'heavy' }">
        <input type="radio" v-model="level" value="heavy" hidden />
        <div class="level-icon">⛈</div>
        <div class="level-title">重</div>
        <div class="level-desc">强力降噪 · 适合嘈杂环境录制</div>
      </label>
    </div>

    <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="onStart">
      {{ isProcessing ? `处理中... ${progress}%` : '开始降噪' }}
    </button>
    <p v-if="!selectedFile" class="hint">💡 请先选音频文件</p>

    <!-- 进度条 -->
    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <!-- 结果 -->
    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>降噪完成!</strong>
        <small>{{ (resultBlob.size / 1024 / 1024).toFixed(2) }} MB · 已处理</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { denoiseAudio, downloadBlob, type DenoiseLevel } from '@/utils/audio/ffmpeg-processor'

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const level = ref<DenoiseLevel>('light')
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
  // 🇨🇳 模拟进度(ffmpeg.wasm 没暴露进度)
  const timer = setInterval(() => { progress.value = Math.min(progress.value + 8, 90) }, 500)
  try {
    const blob = await denoiseAudio(selectedFile.value, level.value)
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
  downloadBlob(resultBlob.value, `${base}_denoised_${level.value}.wav`)
}
</script>

<style scoped>
.denoise-tab h3 { font-size: 15px; color: rgba(255,255,255,0.85); margin: 24px 0 12px; }
.drop-zone {
  border: 2px dashed rgba(255,255,255,0.2);
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}
.drop-zone:hover { border-color: #0099ff; background: rgba(0,153,255,0.05); }
.drop-zone.has-file { padding: 20px; }
.drop-icon { font-size: 36px; margin-bottom: 8px; }
.drop-zone small { color: rgba(255,255,255,0.5); }
.file-info { font-size: 14px; color: rgba(255,255,255,0.85); }
.file-info small { display: block; margin-top: 4px; color: rgba(255,255,255,0.5); }
.level-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.level-card {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}
.level-card:hover { border-color: rgba(0,153,255,0.4); }
.level-card.active {
  border-color: #0099ff;
  background: rgba(0,153,255,0.1);
}
.level-icon { font-size: 32px; margin-bottom: 8px; }
.level-title { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 4px; }
.level-desc { font-size: 12px; color: rgba(255,255,255,0.5); }
.btn-primary {
  padding: 14px 32px;
  background: #0099ff;
  color: #fff;
  border: none;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 20px;
}
.btn-primary:hover:not(:disabled) { background: #007acc; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,153,255,0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.hint { color: rgba(255,255,255,0.45); font-size: 12px; margin: 8px 0 0; }
.progress-bar {
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  margin-top: 16px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #0099ff;
  transition: width 0.3s;
}
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
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-download:hover { background: rgba(0,200,100,0.15); }
.error {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(255,80,80,0.1);
  border: 1px solid rgba(255,80,80,0.3);
  border-radius: 8px;
  color: #ff8888;
  font-size: 13px;
}
</style>