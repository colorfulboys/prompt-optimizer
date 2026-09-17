<!--
  🇨🇳 2026-09-04 R51.5:Tab 5 — 老照片修复(需要登录 + 阿里云)
  - 上传旧/模糊/黑白照片 → AI 修复 + 上色
  - v1:前端 stub,等 R51.5b 后端接完即可用
-->
<template>
  <div class="image-restore-tab">
    <!-- 🇨🇳 R57:统一登录提示 -->
    <div v-if="!auth.isLoggedIn" class="login-required">
      <div class="login-icon">🔒</div>
      <h3>登录后才能使用老照片修复</h3>
      <p>阿里云视觉智能 · 模糊修复 · 黑白上色 · 去划痕</p>
      <button class="btn-primary" @click="triggerLogin">立即登录</button>
    </div>

    <template v-else>
    <div class="tab-intro">
      <h2>🖼️ 老照片修复</h2>
      <p>阿里云视觉智能 · 模糊修复 · 黑白上色 · 去划痕</p>
    </div>

    <h3>1️⃣ 选照片</h3>
    <div
      class="drop-zone"
      :class="{ 'has-file': selectedFile }"
      @click="fileInput?.click()"
      @drop.prevent="onDrop"
      @dragover.prevent
    >
      <template v-if="!selectedFile">
        <div class="drop-icon">📁</div>
        <p>点击或拖拽老照片到此处</p>
        <small>扫描件 / 翻拍照 · JPG / PNG</small>
      </template>
      <template v-else>
        <div class="file-info">
          🖼️ {{ selectedFile.name }}
          <small>· {{ (selectedFile.size / 1024).toFixed(1) }} KB</small>
        </div>
      </template>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
    </div>

    <h3>2️⃣ 修复选项</h3>
    <div class="options">
      <label class="check-row">
        <input type="checkbox" v-model="opts.faceEnhance" />
        <span>👤 人脸增强(清晰化)</span>
      </label>
      <label class="check-row">
        <input type="checkbox" v-model="opts.colorize" />
        <span>🎨 黑白上色</span>
      </label>
      <label class="check-row">
        <input type="checkbox" v-model="opts.scratch" />
        <span>🧹 去划痕</span>
      </label>
    </div>

    <button class="btn-primary" :disabled="!selectedFile || isProcessing" @click="onStart">
      {{ isProcessing ? `AI 修复中... ${progress}%` : '开始 AI 修复' }}
    </button>

    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="resultBlob" class="result">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <strong>修复完成!</strong>
        <small>{{ (resultBlob.size / 1024).toFixed(1) }} KB</small>
      </div>
      <button class="btn-download" @click="downloadResult">下载</button>
    </div>

    <p v-if="errorMsg" class="error">❌ {{ errorMsg }}</p>

    <!-- 🇨🇳 R52.19:功能开发中占位(原黄框 TODO 已删除,避免内部 endpoint/凭证笔记泄露) -->
    <div class="coming-soon">
      <div class="coming-soon-emoji">🚧</div>
      <div class="coming-soon-title">功能开发中,即将上线</div>
      <div class="coming-soon-desc">阿里云视觉智能 · 模糊修复 · 黑白上色 · 去划痕</div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { downloadBlobHelper } from '@/utils/image/image-processor'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// 🇨🇳 R57:统一登录入口
function triggerLogin() {
  document.querySelector('.av-login-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const progress = ref(0)
const resultBlob = ref<Blob | null>(null)
const errorMsg = ref('')

const opts = ref({
  faceEnhance: true,
  colorize: false,
  scratch: false,
})

function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (f && f.type.startsWith('image/')) {
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
  // 🇨🇳 R52.19:占位显示,后端 API 接入完成前不触发实际处理
  errorMsg.value = ''
  resultBlob.value = null
}

function downloadResult() {
  if (!resultBlob.value || !selectedFile.value) return
  const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
  downloadBlobHelper(resultBlob.value, `${baseName}-restored.jpg`)
}
</script>

<style scoped>
/* 🇨🇳 R57:统一登录提示样式 */
.login-required {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 60px 20px;
  text-align: center;
  color: #fff;
}
.login-icon { font-size: 64px; margin-bottom: 16px; }
.login-required h3 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
.login-required p { color: rgba(255,255,255,0.6); font-size: 14px; margin: 0 0 24px; }
.image-restore-tab { color: #fff; }
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

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
  padding: 16px 20px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
}
.check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: rgba(255,255,255,0.85);
}
.check-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
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

.error {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 13px;
}

.coming-soon {
  margin-top: 32px;
  padding: 32px 24px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  text-align: center;
}
.coming-soon-emoji {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.7;
}
.coming-soon-title {
  font-size: 17px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 6px;
}
.coming-soon-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
