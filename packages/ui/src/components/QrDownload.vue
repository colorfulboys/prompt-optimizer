<!--
  🇨🇳 2026-09-02 M3.9 R43c:二维码短链下载落地页
  用户扫码后跳到这里,自动下载原文件
  - 调 /api/qr/:shortId 拿下载 URL
  - 显示文件信息 + 倒计时
  - 自动触发下载(浏览器会问)
-->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import JianheboxToolNav from './JianheboxToolNav.vue'

const route = useRoute()
const shortId = route.params.shortId as string

const loading = ref(true)
const error = ref('')
const fileInfo = ref<{ filename: string; mime: string; size: number; downloadUrl: string; expiresInHours: number } | null>(null)
const downloadTriggered = ref(false)

const expiresText = computed(() => {
  if (!fileInfo.value) return ''
  const h = fileInfo.value.expiresInHours
  if (h >= 48) return `${Math.floor(h / 24)} 天 ${h % 24} 小时`
  if (h >= 1) return `${h} 小时`
  return '不到 1 小时'
})

async function fetchAndDownload() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/qr/${shortId}`)
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '加载失败')
    fileInfo.value = data

    // 自动触发下载 — 用隐藏的 a 标签
    const a = document.createElement('a')
    a.href = data.downloadUrl
    a.download = data.filename  // 提示浏览器下载,而不是直接打开
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    downloadTriggered.value = true
  } catch (e: any) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

function manualDownload() {
  if (!fileInfo.value) return
  window.open(fileInfo.value.downloadUrl, '_blank')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

onMounted(() => {
  fetchAndDownload()
})
</script>

<template>
  <div class="qr-download-page">
    <JianheboxToolNav title="二维码下载" />

    <div class="qr-download-container">
      <!-- 加载中 -->
      <div v-if="loading" class="qr-download-card">
        <div class="qr-download-spinner"></div>
        <h2>⏳ 正在获取文件...</h2>
        <p class="qr-download-sub">短链 ID: <code>{{ shortId }}</code></p>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="qr-download-card qr-download-error-card">
        <h2>❌ 文件无法下载</h2>
        <p class="qr-download-error">{{ error }}</p>
        <div class="qr-download-actions">
          <a href="#/tools/qr" class="qr-action-btn primary">📦 打开二维码工具</a>
        </div>
      </div>

      <!-- 成功 -->
      <div v-else-if="fileInfo" class="qr-download-card qr-download-success-card">
        <div class="qr-download-icon">📥</div>
        <h2>文件已准备好下载</h2>
        <div class="qr-download-file-info">
          <div class="qr-download-filename">
            <span class="label">文件名:</span>
            <strong>{{ fileInfo.filename }}</strong>
          </div>
          <div class="qr-download-meta">
            <span>大小: <strong>{{ formatSize(fileInfo.size) }}</strong></span>
            <span>类型: <strong>{{ fileInfo.mime }}</strong></span>
          </div>
          <div class="qr-download-expires">
            ⏰ 文件将于 <strong>{{ expiresText }}</strong> 后过期删除
          </div>
        </div>

        <div v-if="downloadTriggered" class="qr-download-hint">
          ✅ 浏览器已开始下载,如未弹出请手动点下面按钮
        </div>

        <div class="qr-download-actions">
          <button class="qr-action-btn primary" @click="manualDownload">⬇ 手动下载</button>
          <a href="#/tools/qr" class="qr-action-btn">📦 也想做二维码?</a>
        </div>

        <div class="qr-download-foot">
          <small>由 <a href="#/">简盒 JianHeBox</a> 提供 · 文件仅保留 3 天 · 自动清理</small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qr-download-page {
  min-height: 100vh;
  background: #000;
  color: #fff;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
.qr-download-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 60px 24px;
}
.qr-download-card {
  background: #090909;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}
.qr-download-card h2 {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 16px;
  color: #fff;
}
.qr-download-sub {
  font-size: 13px;
  color: #a6a6a6;
  margin: 0;
}
.qr-download-sub code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: #0099ff;
}
.qr-download-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(0, 153, 255, 0.2);
  border-top-color: #0099ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 24px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.qr-download-icon {
  font-size: 56px;
  margin-bottom: 16px;
}
.qr-download-error {
  background: rgba(255, 100, 100, 0.08);
  border: 1px solid rgba(255, 100, 100, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  color: #ff8888;
  font-size: 14px;
  margin: 0 0 24px;
}
.qr-download-error-card { border-color: rgba(255, 100, 100, 0.3); }
.qr-download-success-card { border-color: rgba(0, 153, 255, 0.3); }

.qr-download-file-info {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 20px;
  margin: 24px 0;
  text-align: left;
}
.qr-download-filename {
  font-size: 16px;
  margin-bottom: 12px;
}
.qr-download-filename .label {
  color: #a6a6a6;
  margin-right: 8px;
}
.qr-download-filename strong {
  color: #fff;
  word-break: break-all;
}
.qr-download-meta {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #a6a6a6;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.qr-download-meta strong {
  color: #fff;
  font-family: ui-monospace, monospace;
  margin: 0 4px;
}
.qr-download-expires {
  font-size: 13px;
  color: #ffb74d;
  padding-top: 12px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}
.qr-download-expires strong {
  color: #ffd699;
  margin: 0 4px;
}
.qr-download-hint {
  font-size: 13px;
  color: #66cc88;
  background: rgba(0, 200, 100, 0.08);
  border: 1px solid rgba(0, 200, 100, 0.3);
  border-radius: 8px;
  padding: 10px 14px;
  margin: 0 0 20px;
}
.qr-download-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.qr-action-btn {
  padding: 10px 20px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}
.qr-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #0099ff;
  color: #0099ff;
}
.qr-action-btn.primary {
  background: #0099ff;
  color: #fff;
  border-color: #0099ff;
  font-weight: 500;
}
.qr-action-btn.primary:hover {
  background: #0088ee;
  box-shadow: 0 0 12px rgba(0, 153, 255, 0.4);
}
.qr-download-foot {
  margin-top: 24px;
  color: #a6a6a6;
  font-size: 12px;
}
.qr-download-foot a {
  color: #0099ff;
  text-decoration: none;
}
.qr-download-foot a:hover {
  text-decoration: underline;
}
</style>