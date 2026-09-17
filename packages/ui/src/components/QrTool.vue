<!--
  🇨🇳 2026-09-01:一切皆可二维码 (R43a 第一版 · 最小可用)
  🇨🇳 2026-09-02 R43b: 长内容自动分片成 N 个二维码序列
    - > 1500 字节自动切块 + meta 头(JHB|001/013|TYPE|...)
    - 单码 / 多码 两种 UI 模式自动切换
    - 一键导出所有 PNG(浏览器触发多次下载)

  技术栈: qrcode (生成) + jsqr (解析) + Vue 3
  无后端、无 API token、纯前端。
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import JianheboxToolNav from './JianheboxToolNav.vue'
import QRCode from 'qrcode'
import jsQR from 'jsqr'

// ===== 输入 =====
const text = ref('')
const file = ref<File | null>(null)
const fileBase64 = ref('')
const fileMeta = ref({ name: '', size: 0, type: '' })

// ===== 上传模式(R43c) =====
// shortlink: 大文件 → 上传 OSS → 1 个二维码 → 客户扫码即下载
// sequence:  小文件 → 纯前端分片成 N 个二维码(原 R43a/b 路径)
const uploadMode = ref<'shortlink' | 'sequence'>('shortlink')
// 🇨🇳 R43c 二选一:公网直链(默认,扫码即下) / 短链跳转(扫码 → 落地页 → 下载,可控过期)
const linkType = ref<'direct' | 'shortlink'>('direct')
const shortLinkUrl = ref('')  // R43c 短链 / 公网直链
const shortLinkId = ref('')
const linkExpiresAt = ref(0)   // OSS 链接签名过期(直链 10 分钟 / 短链类似)
const fileExpiresAt = ref(0)   // 文件被删的时间(直链 24h / 短链 3 天)
const isUploading = ref(false)
const serverLimits = ref({ directLinkMinutes: 10, directFileHours: 24, shortlinkDays: 3 })

// 每秒触发倒计时刷新 — 用一个 ref 当"时钟指针"
const nowTick = ref(Date.now())
let countdownTimer: ReturnType<typeof setInterval> | null = null
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
}
function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

/** 倒计时 — 链接还剩多久过期(读 nowTick 触发响应) */
const linkCountdownText = computed(() => {
  void nowTick.value  // 触发响应
  if (!linkExpiresAt.value) return ''
  const remainMs = linkExpiresAt.value - Date.now()
  if (remainMs <= 0) return '已过期'
  const m = Math.floor(remainMs / 60000)
  const s = Math.floor((remainMs % 60000) / 1000)
  if (m >= 1) return `${m} 分 ${s} 秒`
  return `${s} 秒`
})
/** 文件过期倒计时 */
const fileCountdownText = computed(() => {
  void nowTick.value
  if (!fileExpiresAt.value) return ''
  const remainMs = fileExpiresAt.value - Date.now()
  if (remainMs <= 0) return '已删除'
  const h = Math.floor(remainMs / (60 * 60 * 1000))
  const m = Math.floor((remainMs % (60 * 60 * 1000)) / 60000)
  if (h >= 24) {
    const d = Math.floor(h / 24)
    return `${d} 天 ${h % 24} 小时`
  }
  if (h >= 1) return `${h} 小时 ${m} 分`
  return `${m} 分`
})

// ===== 二维码设置 =====
const errorCorrectionLevel = ref<'L' | 'M' | 'Q' | 'H'>('M')  // 容错
const size = ref(512)        // 像素
const darkColor = ref('#000000')
const lightColor = ref('#ffffff')

// ===== 输出(R43b:多片序列) =====
// 协议:每片 = `JHB|<idx>/<total>|<type>|<payload>`
//    type = txt | b64 | url
//    payload = 文本块 / base64 块
const PROTOCOL = 'JHB'
const CHUNK_PAYLOAD = 1200  // 留 meta + 容错余量
const qrChunks = ref<Array<{ dataUrl: string; index: number; total: number; raw: string }>>([])
const qrError = ref('')

// ===== 解析 =====
const scanMode = ref<'single' | 'batch'>('single')  // 🇨🇳 R43b:单张 vs 批量合并
// 单张解码(原 R43a)
const scanImage = ref<File | null>(null)
const scanPreview = ref('')
const scanResult = ref('')
const scanError = ref('')

const hasInput = computed(() => text.value.trim().length > 0 || fileBase64.value.length > 0)
const inputSize = computed(() => {
  if (fileBase64.value) return fileBase64.value.length
  return new TextEncoder().encode(text.value).length
})
// 估算分片数 = ceil(原始大小 / 单片容量)
const estimatedChunks = computed(() => Math.max(1, Math.ceil(inputSize.value / CHUNK_PAYLOAD)))
const isMultiChunk = computed(() => estimatedChunks.value > 1)

// 协议 payload 编码 — 把任意字符串切成 N 段,每段带 meta 头
function buildProtocolPayloads(rawText: string, type: 'txt' | 'b64' | 'url'): string[] {
  // 估算分片(每个 < CHUNK_PAYLOAD 字节,UTF-8 安全切)
  const total = Math.max(1, Math.ceil(rawText.length / CHUNK_PAYLOAD))
  const chunks: string[] = []
  for (let i = 0; i < total; i++) {
    const start = i * CHUNK_PAYLOAD
    const end = Math.min(start + CHUNK_PAYLOAD, rawText.length)
    const payload = rawText.slice(start, end)
    // 补齐 idx/total 宽度(2 位数 → 3 位数 → 4 位数自适应)
    const meta = `${PROTOCOL}|${String(i + 1).padStart(3, '0')}/${String(total).padStart(3, '0')}|${type}|`
    chunks.push(meta + payload)
  }
  return chunks
}

async function generateQR() {
  qrError.value = ''
  qrChunks.value = []
  try {
    // 决定 raw 内容 + 类型
    let raw = ''
    let type: 'txt' | 'b64' | 'url' = 'txt'
    if (fileBase64.value) {
      raw = fileBase64.value
      type = 'b64'
    } else {
      raw = text.value
      const trimmed = raw.trim().toLowerCase()
      type = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? 'url' : 'txt'
    }

    const payloads = buildProtocolPayloads(raw, type)
    const generated: Array<{ dataUrl: string; index: number; total: number; raw: string }> = []
    for (let i = 0; i < payloads.length; i++) {
      const dataUrl = await QRCode.toDataURL(payloads[i], {
        errorCorrectionLevel: errorCorrectionLevel.value,
        width: size.value,
        margin: 2,
        color: { dark: darkColor.value, light: lightColor.value },
      })
      generated.push({ dataUrl, index: i + 1, total: payloads.length, raw: payloads[i] })
    }
    qrChunks.value = generated
  } catch (e: any) {
    qrError.value = e.message || String(e)
    qrChunks.value = []
  }
}

/**
 * 🇨🇳 R43c:文件 → OSS → 1 个二维码(扫码即下载)
 *
 * 默认模式(直链):文件上传到 OSS 后,二维码装 OSS 公网直链(5 分钟有效)。
 *   客户扫码 → 浏览器打开 OSS 直链 → 自动下载原文件。
 *   优点:零摩擦、无需短链跳转。缺点:任何人拿到直链都能下(短时)。
 *
 * 可选模式(短链):二维码装短链 `https://jianhebox.cn/q/xxx`,扫码先到落地页。
 *   优点:可设过期(3 天)、可控、可统计。缺点:需要部署 jianhebox.cn 域名才能用。
 */
async function generateShortLinkQR() {
  if (!file.value) return
  qrError.value = ''
  shortLinkUrl.value = ''
  shortLinkId.value = ''
  isUploading.value = true
  try {
    // 1) 拿上传签名 URL
    const urlRes = await fetch(
      `/api/qr/upload-url?filename=${encodeURIComponent(file.value.name)}&size=${file.value.size}&mime=${encodeURIComponent(file.value.type || 'application/octet-stream')}`
    )
    const urlData = await urlRes.json()
    if (!urlData.ok) throw new Error(urlData.error || '获取上传地址失败')

    // 2) 直传 OSS
    const putRes = await fetch(urlData.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.value.type || 'application/octet-stream' },
      body: file.value,
    })
    if (!putRes.ok) throw new Error(`OSS 上传失败: HTTP ${putRes.status}`)

    // 3) 决定二维码装什么
    let qrPayload = ''
    let finalUrl = ''
    if (linkType.value === 'direct') {
      // 默认走 OSS 公网直链
      const verifyRes = await fetch(`/api/qr/direct-link?key=${encodeURIComponent(urlData.objectKey)}`)
      const verifyData = await verifyRes.json()
      if (!verifyData.ok) throw new Error(verifyData.error || '获取下载链接失败')
      qrPayload = verifyData.downloadUrl
      finalUrl = qrPayload
      shortLinkId.value = 'dir-' + verifyData.shortId.replace('dir-', '')
      linkExpiresAt.value = verifyData.linkExpiresAt
      fileExpiresAt.value = verifyData.fileExpiresAt
      // 更新服务端规则
      serverLimits.value = { ...serverLimits.value, directLinkMinutes: Math.floor((verifyData.linkExpiresAt - Date.now()) / 60000) }
      startCountdown()
    } else {
      // 短链模式 — 写 SQLite,返回 shortId
      const commitRes = await fetch('/api/qr/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectKey: urlData.objectKey,
          filename: file.value.name,
          mime: file.value.type || 'application/octet-stream',
          size: file.value.size,
        }),
      })
      const commitData = await commitRes.json()
      if (!commitData.ok) throw new Error(commitData.error || '短链提交失败')
      qrPayload = commitData.fullUrl
      finalUrl = commitData.fullUrl
      shortLinkId.value = commitData.shortId
      fileExpiresAt.value = commitData.expiresAt
      // 短链的"链接"本身是跳转入口,每次扫码都重新生成 10 分钟有效 URL
      linkExpiresAt.value = Date.now() + 600 * 1000
      startCountdown()
    }

    shortLinkUrl.value = finalUrl

    // 4) 生成二维码
    const dataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      width: 512,
      margin: 2,
      color: { dark: darkColor.value, light: lightColor.value },
    })
    qrChunks.value = [{ dataUrl, index: 1, total: 1, raw: qrPayload }]
  } catch (e: any) {
    qrError.value = e.message || String(e)
    qrChunks.value = []
  } finally {
    isUploading.value = false
  }
}

// 输入变化时实时生成(仅 sequence模式 — shortlink 模式靠按钮触发)
watch([text, fileBase64, errorCorrectionLevel, size, darkColor, lightColor, uploadMode], () => {
  if (uploadMode.value === 'sequence' && hasInput.value) generateQR()
}, { immediate: false })

// 文件上传
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  file.value = f
  fileMeta.value = { name: f.name, size: f.size, type: f.type }
  qrError.value = ''
  const reader = new FileReader()
  reader.onload = () => {
    fileBase64.value = reader.result as string
  }
  reader.readAsDataURL(f)
}

function clearFile() {
  file.value = null
  fileBase64.value = ''
  fileMeta.value = { name: '', size: 0, type: '' }
  qrError.value = ''
  shortLinkUrl.value = ''
  shortLinkId.value = ''
  linkExpiresAt.value = 0
  fileExpiresAt.value = 0
  stopCountdown()
}

// 下载单个二维码
function downloadChunk(chunk: { dataUrl: string; index: number; total: number }) {
  const a = document.createElement('a')
  a.href = chunk.dataUrl
  const totalStr = String(chunk.total).padStart(3, '0')
  const idxStr = String(chunk.index).padStart(3, '0')
  a.download = `qr-${totalStr}-${idxStr}.png`
  a.click()
}

// 下载全部二维码(浏览器批量下载)
function downloadAll() {
  qrChunks.value.forEach((chunk, i) => {
    // 错开下载避免浏览器拦截
    setTimeout(() => downloadChunk(chunk), i * 200)
  })
}

// 解析上传图片
async function onScanImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  scanImage.value = f
  scanPreview.value = URL.createObjectURL(f)
  scanResult.value = ''
  scanError.value = ''

  try {
    const decoded = await decodeImage(f)
    scanResult.value = decoded
  } catch (e: any) {
    scanError.value = e.message || String(e)
  }
}

// 🇨🇳 R43b 批量合并:多张二维码 → 自动按 idx 排序拼接
const scanBatchFiles = ref<File[]>([])
const scanBatchProgress = ref({ total: 0, scanned: 0, status: '' as string })
const scanMerged = ref<{ type: string; payload: string; missing: number[]; total: number; complete: boolean; byteSize: number } | null>(null)
const scanMergedError = ref('')

async function decodeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (!code) throw new Error('未识别到二维码')
    return code.data
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 批量识别:用户选 N 张二维码 PNG,自动按 JHB|<idx>/<total>|<type>|<payload> 协议拼接
async function onScanBatchChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (files.length === 0) return

  scanMergedError.value = ''
  scanMerged.value = null
  scanBatchFiles.value = files
  scanBatchProgress.value = { total: files.length, scanned: 0, status: '识别中...' }

  const chunks = new Map<number, { type: string; payload: string }>()
  let commonType = ''
  let expectedTotal = 0
  const failures: string[] = []

  for (let i = 0; i < files.length; i++) {
    scanBatchProgress.value = { total: files.length, scanned: i, status: `识别中 ${i + 1}/${files.length}` }
    try {
      const decoded = await decodeImage(files[i])
      // 解析协议头:JHB|<idx>/<total>|<type>|<payload>
      const match = decoded.match(/^JHB\|(\d+)\/(\d+)\|(txt|b64|url)\|(.*)$/s)
      if (!match) {
        failures.push(`第 ${i + 1} 张:不是 JHB 协议二维码`)
      } else {
        const idx = parseInt(match[1], 10)
        const total = parseInt(match[2], 10)
        const type = match[3]
        const payload = match[4]
        if (chunks.has(idx)) {
          failures.push(`第 ${i + 1} 张:重复编号 ${idx}`)
        } else {
          chunks.set(idx, { type, payload })
        }
        if (chunks.size === 1) {
          commonType = type
          expectedTotal = total
        } else if (type !== commonType) {
          failures.push(`第 ${i + 1} 张:类型不一致 (${type} vs ${commonType})`)
        }
      }
    } catch (err: any) {
      failures.push(`第 ${i + 1} 张:${err.message || '识别失败'}`)
    }
    scanBatchProgress.value = { total: files.length, scanned: i + 1, status: `识别中 ${i + 1}/${files.length}` }
  }

  const sorted = Array.from(chunks.entries()).sort((a, b) => a[0] - b[0])
  const fullPayload = sorted.map(([, v]) => v.payload).join('')

  const missing: number[] = []
  for (let i = 1; i <= expectedTotal; i++) {
    if (!chunks.has(i)) missing.push(i)
  }

  const complete = chunks.size === expectedTotal && missing.length === 0
  // 计算字节大小(模板里不能 new Blob,放这里)
  let byteSize = 0
  try {
    byteSize = new Blob([fullPayload]).size
  } catch { byteSize = fullPayload.length }
  scanMerged.value = { type: commonType, payload: fullPayload, missing, total: expectedTotal, complete, byteSize }
  scanBatchProgress.value = {
    total: files.length,
    scanned: files.length,
    status: complete
      ? `✅ 收齐 ${chunks.size}/${expectedTotal}`
      : `⚠️ 收到 ${chunks.size}/${expectedTotal},缺 ${missing.length} 张`,
  }
  if (failures.length > 0) {
    scanMergedError.value = failures.join('\n')
  }
}

// 下载合并结果:base64 → 二进制文件 / 文本 → .txt
function downloadMerged() {
  const m = scanMerged.value
  if (!m) return
  if (m.type === 'txt' || m.type === 'url') {
    const blob = new Blob([m.payload], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `qr-merged-${Date.now()}.txt`
    a.click()
  } else if (m.type === 'b64') {
    try {
      const commaIdx = m.payload.indexOf(',')
      const meta = commaIdx >= 0 ? m.payload.slice(0, commaIdx) : ''
      const b64 = commaIdx >= 0 ? m.payload.slice(commaIdx + 1) : m.payload
      const mimeMatch = meta.match(/^data:([^;]+);base64$/)
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const ext = mime.split('/')[1]?.split('+')[0] || 'bin'
      a.download = `qr-merged-${Date.now()}.${ext}`
      a.click()
    } catch (e: any) {
      scanMergedError.value = `下载失败: ${e.message}`
    }
  }
}

function clearScanBatch() {
  scanBatchFiles.value = []
  scanBatchProgress.value = { total: 0, scanned: 0, status: '' }
  scanMerged.value = null
  scanMergedError.value = ''
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// 🇨🇳 2026-09-02 M3.9:加载时拉服务端规则,初始化 UI 提示
onMounted(async () => {
  try {
    const r = await fetch('/api/qr/limits')
    if (r.ok) {
      const data = await r.json()
      if (data.ok && data.limits) serverLimits.value = data.limits
    }
  } catch {
    // 离线/后端未启动 → 默认值生效(10 分钟 / 24 小时 / 3 天)
  }
})
</script>

<template>
  <div class="qr-tool-page">
    <JianheboxToolNav />

    <div class="qr-container">
      <h1 class="qr-page-title">
        <span class="qr-page-emoji">🔳</span>
        <span class="qr-page-text">一切皆可二维码</span>
        <span class="qr-page-tag">R43c · 纯前端 · 无后端</span>
      </h1>
      <p class="qr-desc">
        粘贴文本/URL,或上传任意文件(图片/PDF/...),自动转成二维码。无后端、无水印、纯前端。
      </p>

      <!-- 生成区 -->
      <div class="qr-section">
        <div class="qr-section-header">
          <h3>① 输入内容</h3>
          <div class="qr-section-actions">
            <button class="qr-action-btn" :class="{ primary: uploadMode === 'shortlink' }" @click="uploadMode = 'shortlink'" title="文件 → OSS → 1 个二维码,客户扫码即下载(支持 100MB 大文件)">🚀 短链模式</button>
            <button class="qr-action-btn" :class="{ primary: uploadMode === 'sequence' }" @click="uploadMode = 'sequence'" title="纯前端,不分片成多个二维码,无后端">📑 纯前端序列</button>
          </div>
        </div>

        <textarea
          v-model="text"
          class="qr-textarea"
          :placeholder="uploadMode === 'shortlink' ? '短链模式不支持纯文本 — 请上传文件' : '粘贴文本 / URL / 任意字符...'"
          :rows="4"
          :disabled="uploadMode === 'shortlink'"
        />

        <div class="qr-file-row">
          <label class="qr-file-btn">
            📎 上传文件(图片/PDF/Word/任意 ≤100MB)
            <input type="file" @change="onFileChange" style="display:none" />
          </label>
          <span v-if="fileMeta.name" class="qr-file-meta">
            {{ fileMeta.name }} · {{ formatSize(fileMeta.size) }}
            <button class="qr-clear" @click="clearFile">✕</button>
          </span>
        </div>

        <!-- 🇨🇳 R43c 短链模式专属操作按钮 -->
        <div v-if="uploadMode === 'shortlink' && fileMeta.name" class="qr-shortlink-actions">
          <!-- 二选一:直链(默认) vs 短链跳转 -->
          <div class="qr-linktype-row">
            <label class="qr-linktype-option">
              <input type="radio" v-model="linkType" value="direct" />
              <span class="qr-linktype-label">
                <strong>🚀 直链(推荐)</strong>
                <small>扫码直接下载 · 链接 <strong>{{ serverLimits.directLinkMinutes }} 分钟</strong>内有效 · 文件<strong>{{ serverLimits.directFileHours }} 小时后自动删</strong></small>
              </span>
            </label>
            <label class="qr-linktype-option">
              <input type="radio" v-model="linkType" value="shortlink" />
              <span class="qr-linktype-label">
                <strong>🔗 短链跳转</strong>
                <small>需要部署 jianhebox.cn · 链接 <strong>10 分钟</strong>有效 · 文件<strong>{{ serverLimits.shortlinkDays }} 天后自动删</strong></small>
              </span>
            </label>
          </div>
          <button class="qr-action-btn primary" :disabled="isUploading" @click="generateShortLinkQR">
            {{ isUploading ? '⏳ 上传中...' : '🚀 生成二维码' }}
          </button>
          <!-- 成功信息 + 双倒计时 -->
          <div v-if="shortLinkUrl" class="qr-shortlink-info">
            <div class="qr-countdown-row">
              <span class="qr-countdown-item">
                🔗 链接: <strong>{{ linkCountdownText }}</strong> 后失效
              </span>
              <span class="qr-countdown-item">
                📁 文件: <strong>{{ fileCountdownText }}</strong> 后自动删除
              </span>
              <span class="qr-countdown-id">ID: <code>{{ shortLinkId }}</code></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 二维码预览 -->
      <div class="qr-section">
        <div class="qr-section-header">
          <h3>② 二维码<span v-if="isMultiChunk" class="qr-section-tag">序列 · 共 {{ qrChunks[0]?.total || estimatedChunks }} 个</span></h3>
          <div v-if="qrChunks.length > 0" class="qr-section-actions">
            <button v-if="isMultiChunk" class="qr-action-btn primary" @click="downloadAll">⬇ 下载全部 ({{ qrChunks.length }})</button>
            <button v-else class="qr-action-btn primary" @click="downloadChunk(qrChunks[0])">⬇ 下载 PNG</button>
            <button class="qr-action-btn" @click="generateQR">🔄 重新生成</button>
          </div>
        </div>
        <div class="qr-preview-wrap">
          <!-- 空状态 -->
          <div v-if="!hasInput" class="qr-empty">
            请输入文本或上传文件
          </div>
          <!-- 错误 -->
          <div v-else-if="qrError" class="qr-error">
            ⚠️ {{ qrError }}
          </div>
          <!-- 单码 -->
          <div v-else-if="!isMultiChunk && qrChunks.length === 1" class="qr-preview">
            <img :src="qrChunks[0].dataUrl" alt="QR" :width="size" :height="size" />
          </div>
          <!-- 多码网格 -->
          <div v-else-if="isMultiChunk" class="qr-grid">
            <div v-for="chunk in qrChunks" :key="chunk.index" class="qr-grid-item">
              <div class="qr-grid-badge">{{ chunk.index }} / {{ chunk.total }}</div>
              <img :src="chunk.dataUrl" :alt="`QR ${chunk.index}/${chunk.total}`" :width="size" :height="size" />
              <button class="qr-action-btn qr-grid-btn" @click="downloadChunk(chunk)">⬇ 下载 #{{ chunk.index }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 设置 -->
      <div class="qr-section">
        <h3>③ 调整样式</h3>
        <div class="qr-settings">
          <label>
            容错等级:
            <select v-model="errorCorrectionLevel">
              <option value="L">低 (7%)</option>
              <option value="M">中 (15%) · 推荐</option>
              <option value="Q">高 (25%)</option>
              <option value="H">最高 (30%) · 大文件</option>
            </select>
          </label>
          <label>
            尺寸:
            <input type="range" v-model.number="size" min="128" max="1024" step="64" />
            <span>{{ size }}px</span>
          </label>
          <label>
            前景色:
            <input type="color" v-model="darkColor" />
          </label>
          <label>
            背景色:
            <input type="color" v-model="lightColor" />
          </label>
        </div>
        <div class="qr-info">
          当前输入: <strong>{{ inputSize }}</strong> 字节 · 估算需要 <strong>{{ estimatedChunks }}</strong> 个二维码<span v-if="isMultiChunk"> · 自动序列拼接(扫码器按顺序识别合并)</span>
        </div>
      </div>

      <!-- 解码 -->
      <div class="qr-section">
        <div class="qr-section-header">
          <h3>④ 解码别人的二维码</h3>
          <div class="qr-section-actions">
            <button class="qr-action-btn" :class="{ primary: scanMode === 'single' }" @click="scanMode = 'single'">单张</button>
            <button class="qr-action-btn" :class="{ primary: scanMode === 'batch' }" @click="scanMode = 'batch'">批量合并(序列码)</button>
          </div>
        </div>

        <!-- 单张解码(原 R43a) -->
        <div v-if="scanMode === 'single'">
          <p class="qr-section-desc">上传一张二维码图片,我们帮你识别里面的内容(纯本地,不联网)</p>
          <label class="qr-file-btn">
            🔍 选择二维码图片
            <input type="file" accept="image/*" @change="onScanImageChange" style="display:none" />
          </label>
          <div v-if="scanPreview" class="qr-scan-result">
            <img :src="scanPreview" class="qr-scan-preview" />
            <div v-if="scanResult" class="qr-scan-text">
              <div class="qr-scan-label">✅ 识别结果:</div>
              <textarea :value="scanResult" readonly :rows="4" />
              <button class="qr-action-btn" @click="navigator.clipboard.writeText(scanResult)">📋 复制</button>
            </div>
            <div v-if="scanError" class="qr-error">⚠️ {{ scanError }}</div>
          </div>
        </div>

        <!-- 🇨🇳 R43b 批量合并:扫描多个序列二维码自动按编号拼接 -->
        <div v-else>
          <p class="qr-section-desc">
            批量选 N 张二维码 PNG(就是本工具②区下载下来的那批),自动按协议 <code>JHB\|idx/total\|type\|payload</code> 合并成原文件。
            <br/>
            <span style="color:var(--blue)">📌 即使缺几张也能合并出已收到的部分,告诉你缺哪张。</span>
          </p>
          <div class="qr-batch-row">
            <label class="qr-file-btn">
              📂 选择多张二维码 PNG(可多选)
              <input type="file" accept="image/*" multiple @change="onScanBatchChange" style="display:none" />
            </label>
            <button v-if="scanBatchFiles.length > 0" class="qr-action-btn" @click="clearScanBatch">✕ 清空</button>
          </div>

          <!-- 进度条 -->
          <div v-if="scanBatchProgress.status" class="qr-batch-progress">
            <div class="qr-batch-progress-bar">
              <div class="qr-batch-progress-fill" :style="{ width: `${(scanBatchProgress.scanned / Math.max(scanBatchProgress.total, 1) * 100).toFixed(0)}%` }"></div>
            </div>
            <div class="qr-batch-progress-text">
              {{ scanBatchProgress.status }}
              <span v-if="scanMerged" class="qr-batch-progress-meta">
                · 类型:{{ scanMerged.type }} · 预计共 {{ scanMerged.total }} 张 · 已收 {{ scanMerged.total - scanMerged.missing.length }}
              </span>
            </div>
          </div>

          <!-- 失败明细 -->
          <div v-if="scanMergedError" class="qr-error qr-batch-error">⚠️ {{ scanMergedError }}</div>

          <!-- 合并结果 + 下载 -->
          <div v-if="scanMerged" class="qr-batch-result">
            <div v-if="scanMerged.complete" class="qr-batch-success">
              <strong>✅ 合并成功!</strong>
              <span v-if="scanMerged.type === 'b64'">还原二进制文件,可直接下载。</span>
              <span v-else>还原文本/链接,可直接下载。</span>
            </div>
            <div v-else-if="scanMerged.missing.length > 0" class="qr-batch-warn">
              ⚠️ 缺少第 <strong>{{ scanMerged.missing.join(', ') }}</strong> 张(共缺 {{ scanMerged.missing.length }} 张),但可下载已收到的部分。
            </div>
            <div class="qr-batch-meta">
              <div>类型:<strong>{{ scanMerged.type }}</strong> · 大小:<strong>{{ formatSize(scanMerged.byteSize) }}</strong></div>
              <textarea :value="scanMerged.payload.slice(0, 500) + (scanMerged.payload.length > 500 ? '...(共 ' + scanMerged.payload.length + ' 字符)' : '')" readonly :rows="3" />
            </div>
            <button class="qr-action-btn primary" @click="downloadMerged">⬇ 下载合并后的文件</button>
          </div>
        </div>
      </div>

      <!-- 🇨🇳 R43c 使用指南 — 围绕"短链模式"为主线,序列模式作兜底 -->
      <div class="qr-section qr-guide-section">
        <h3>⑤ 使用指南 · 推荐"🚀 短链模式"</h3>

        <!-- 🇨🇳 规则一览表:4 条规则一目了然 -->
        <div class="qr-rules-box">
          <div class="qr-rules-title">📋 规则一览(用户必读)</div>
          <table class="qr-rules-table">
            <thead>
              <tr><th>模式</th><th>链接有效期</th><th>文件何时删除</th><th>二维码装什么</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>🚀 直链</strong>(默认)</td>
                <td><strong>{{ serverLimits.directLinkMinutes }} 分钟</strong></td>
                <td><strong>{{ serverLimits.directFileHours }} 小时</strong>后自动删</td>
                <td>OSS 公网直链</td>
              </tr>
              <tr>
                <td><strong>🔗 短链跳转</strong></td>
                <td><strong>10 分钟</strong>(每次跳转重新生成)</td>
                <td><strong>{{ serverLimits.shortlinkDays }} 天</strong>后自动删</td>
                <td><code>jianhebox.cn/q/xxx</code></td>
              </tr>
              <tr>
                <td><strong>📑 纯前端序列</strong>(兜底)</td>
                <td>永久</td>
                <td>不上传服务器,纯本地</td>
                <td>N 个二维码拼接</td>
              </tr>
              <tr>
                <td><strong>📏 单文件上限</strong></td>
                <td colspan="2"><strong>100 MB</strong> · 涵盖图片/PDF/Word/歌曲</td>
                <td>—</td>
              </tr>
              <tr>
                <td><strong>📦 总存储配额</strong></td>
                <td colspan="2"><strong>10 GB</strong> · 全部未过期文件总和</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="qr-guide-grid">
          <div class="qr-guide-step">
            <div class="qr-guide-num">1</div>
            <div class="qr-guide-content">
              <div class="qr-guide-title">📥 上传文件</div>
              <div class="qr-guide-desc">选 <strong>"🚀 短链模式"</strong>(默认推荐),上传任意文件 (图片/PDF/Word/歌曲,最大 100 MB)。文件会上传到阿里云 OSS。</div>
            </div>
          </div>
          <div class="qr-guide-step">
            <div class="qr-guide-num">2</div>
            <div class="qr-guide-content">
              <div class="qr-guide-title">🚀 生成二维码</div>
              <div class="qr-guide-desc">点 <strong>"🚀 生成二维码"</strong>。<strong>🚀 直链</strong> 默认:二维码装 OSS 公网直链,{{ serverLimits.directLinkMinutes }} 分钟有效,扫码即下载。<strong>🔗 短链</strong>:需部署 jianhebox.cn 才生效。</div>
              <div class="qr-guide-tip">💡 99% 场景选直链就够了 — 客户扫码 = 浏览器打开 = 自动下载原文件,体验跟平时扫码一样。</div>
            </div>
          </div>
          <div class="qr-guide-step">
            <div class="qr-guide-num">3</div>
            <div class="qr-guide-content">
              <div class="qr-guide-title">📤 发给客户</div>
              <div class="qr-guide-desc">下载 PNG 二维码(或直接截图),<strong>微信/邮件/任意渠道</strong>发给客户。链接有效期内可任意扫码。</div>
              <div class="qr-guide-tip">💡 直链 <strong>{{ serverLimits.directLinkMinutes }} 分钟</strong> 内有效 — 拿到二维码就尽快发,过期要重新生成。</div>
            </div>
          </div>
          <div class="qr-guide-step">
            <div class="qr-guide-num">4</div>
            <div class="qr-guide-content">
              <div class="qr-guide-title">✅ 客户扫码</div>
              <div class="qr-guide-desc">客户用微信/相机扫一下 → 浏览器打开 → <strong>自动下载原文件</strong>。跟平时扫付款码、添加好友的体验一模一样。</div>
              <div class="qr-guide-tip">💡 文件本身在 OSS 上 <strong>{{ serverLimits.directFileHours }} 小时后自动删除</strong>,cron 每天 04:00 跑清理。</div>
            </div>
          </div>
        </div>

        <!-- 兜底模式 -->
        <div class="qr-guide-footnote">
          <strong>📑 兜底模式 · 纯前端序列码</strong>(无后端、无上传、纯本地)<br/>
          如果你不想用 OSS,或者要处理超大文件,选 <strong>"📑 纯前端序列"</strong>:粘贴文本/上传文件 → <strong>自动分片成 N 个二维码</strong>。你需要把它们都发给客户,客户<strong>按编号顺序扫码</strong>,然后回本工具的 ④ 区选全部 PNG 合并下载。<br/>
          <br/>
          <strong>常见疑问</strong><br/>
          · Q:链接过期了还能扫码吗?<br/>
          A:不能。直链 <strong>{{ serverLimits.directLinkMinutes }} 分钟</strong> 内有效 — 拿到二维码就尽快发给客户。第一次扫码触发下载后,文件就在客户电脑里了。<br/>
          · Q:链接会泄露吗?<br/>
          A:理论上链接生成后任何拿到的人都可下。如果你发的是机密文件,选 <strong>"🔗 短链跳转"</strong> 模式(可设过期、可统计)。<br/>
          · Q:文件能保存多久?<br/>
          A:<strong>直链模式</strong> — 文件在 OSS 里 <strong>{{ serverLimits.directFileHours }} 小时后自动删</strong>(cron 每天 04:00 清理)。<strong>短链模式</strong> — <strong>{{ serverLimits.shortlinkDays }} 天后自动删</strong>。<br/>
          · Q:为什么不是永久保存?<br/>
          A:节省 OSS 存储成本 + 防止"被遗忘的文件"长期占空间。3 天/24 小时已足够日常分享场景。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 🇨🇳 2026-09-02 M3.9 R43a 修复:跟简盒 LandingPage 统一黑底蓝紫主题 */
.qr-tool-page {
  --void: #000000;
  --near-black: #090909;
  --white: #ffffff;
  --silver: #a6a6a6;
  --ghost: rgba(255, 255, 255, 0.6);
  --frosted: rgba(255, 255, 255, 0.1);
  --frosted-hover: rgba(255, 255, 255, 0.15);
  --blue: #0099ff;
  --blue-glow: rgba(0, 153, 255, 0.15);

  min-height: 100vh;
  background: var(--void);
  color: var(--white);
  font-family: var(--font-sans, 'Inter', system-ui, -apple-system, sans-serif);
  font-weight: 400;
  line-height: 1.5;
}
.qr-tool-page { box-sizing: border-box; }
.qr-tool-page > * { box-sizing: border-box; margin: 0; }
/* 🇨🇳 R47.9:nav 在 > * 里会被 margin: 0 覆盖,需要单独恢复 margin: 0 auto */
.qr-tool-page > .jianhebox-tool-nav { margin-left: auto; margin-right: auto; }

.qr-container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}
/* 🇨🇳 R47.9:页面大标题(用户原话:"二维码工具页面,整个标题栏都左对齐了") */
.qr-page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 600;
  color: var(--white);
}
.qr-page-emoji {
  font-size: 32px;
  line-height: 1;
}
.qr-page-text {
  flex: 0 0 auto;
}
.qr-page-tag {
  margin-left: 8px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 400;
  color: var(--silver);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  white-space: nowrap;
}
.qr-desc {
  color: var(--silver);
  font-size: 14px;
  margin-bottom: 24px;
}
/* Section card: 深色卡片,蓝边 hover */
.qr-section {
  background: var(--near-black);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  transition: border-color 0.15s ease;
}
.qr-section:hover {
  border-color: rgba(0, 153, 255, 0.25);
}
.qr-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--white);
}
.qr-section-desc {
  color: var(--silver);
  font-size: 13px;
  margin: -8px 0 12px;
}
/* 🇨🇳 R43b:section header 横排(标题 + 操作按钮) */
.qr-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.qr-section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--white);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.qr-section-tag {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  background: var(--blue-glow);
  color: var(--blue);
  border: 1px solid var(--blue);
  border-radius: 999px;
}
.qr-section-actions {
  display: flex;
  gap: 8px;
}
/* Textarea: 透明深色,蓝边 focus */
.qr-textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  resize: vertical;
  box-sizing: border-box;
  background: transparent;
  color: var(--white);
}
.qr-textarea::placeholder { color: rgba(255, 255, 255, 0.35); }
.qr-textarea:focus {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 0 3px var(--blue-glow);
}
.qr-file-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
/* 文件按钮: 玻璃态 */
.qr-file-btn {
  display: inline-block;
  padding: 8px 16px;
  background: var(--frosted);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--white);
  transition: all 0.15s ease;
}
.qr-file-btn:hover {
  background: var(--frosted-hover);
  border-color: var(--blue);
  box-shadow: 0 0 8px var(--blue-glow);
}
.qr-file-meta {
  font-size: 13px;
  color: var(--silver);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 🇨🇳 R43c 短链模式 */
.qr-shortlink-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed rgba(0, 153, 255, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.qr-shortlink-actions .qr-action-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.qr-shortlink-info {
  font-size: 13px;
  color: #66cc88;
}
.qr-shortlink-info code {
  background: var(--frosted);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--blue);
  border: 1px solid rgba(0, 153, 255, 0.3);
}
/* 🇨🇳 R43c 倒计时行 */
.qr-countdown-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
  padding: 10px 14px;
  background: rgba(0, 200, 100, 0.06);
  border: 1px solid rgba(0, 200, 100, 0.25);
  border-radius: 8px;
}
.qr-countdown-item {
  color: #a6e0b8;
  font-size: 13px;
  white-space: nowrap;
}
.qr-countdown-item strong {
  color: #ffd699;
  font-family: ui-monospace, monospace;
  font-weight: 600;
  margin: 0 4px;
}
.qr-countdown-id {
  color: var(--silver);
  font-size: 12px;
  margin-left: auto;
}
.qr-countdown-id code {
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--blue);
}
/* 🇨🇳 R43c 直链/短链二选一 */
.qr-linktype-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}
.qr-linktype-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  background: var(--frosted);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  flex: 1;
  min-width: 240px;
  transition: all 0.15s ease;
}
.qr-linktype-option:hover {
  border-color: rgba(0, 153, 255, 0.3);
  background: rgba(0, 153, 255, 0.05);
}
.qr-linktype-option:has(input:checked) {
  border-color: var(--blue);
  background: rgba(0, 153, 255, 0.08);
  box-shadow: 0 0 8px var(--blue-glow);
}
.qr-linktype-option input[type="radio"] {
  margin-top: 4px;
  accent-color: var(--blue);
  cursor: pointer;
}
.qr-linktype-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.qr-linktype-label strong {
  color: var(--white);
  font-size: 13px;
}
.qr-linktype-label small {
  color: var(--silver);
  font-size: 11px;
  line-height: 1.4;
}
.qr-clear {
  background: none;
  border: none;
  color: var(--silver);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}
.qr-clear:hover { color: var(--blue); }

.qr-preview-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
/* 二维码白色卡片 — 必须保留白底,扫码器才能识别 */
.qr-preview img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: #fff; /* 二维码主体白底,扫码器需要 */
}
/* 🇨🇳 R43b:多码网格布局 */
.qr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  width: 100%;
}
.qr-grid-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}
.qr-grid-item img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  background: #fff;
  padding: 4px;
}
.qr-grid-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  background: var(--blue);
  color: var(--white);
  border-radius: 6px;
  font-family: ui-monospace, monospace;
}
.qr-grid-btn {
  width: 100%;
  font-size: 12px !important;
  padding: 6px 8px !important;
}
.qr-actions {
  display: flex;
  gap: 8px;
}
/* 按钮: 玻璃态;primary 蓝底 */
.qr-action-btn {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: var(--frosted);
  color: var(--white);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.15s ease;
}
.qr-action-btn:hover {
  background: var(--frosted-hover);
  border-color: var(--blue);
  color: var(--blue);
  box-shadow: 0 0 8px var(--blue-glow);
}
.qr-action-btn.primary {
  background: var(--blue);
  color: var(--white);
  border-color: var(--blue);
  font-weight: 500;
}
.qr-action-btn.primary:hover {
  background: #0088ee;
  border-color: #0088ee;
  box-shadow: 0 0 12px var(--blue-glow);
}
.qr-empty {
  padding: 60px 20px;
  color: var(--silver);
  font-size: 14px;
  text-align: center;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  width: 100%;
  max-width: 360px;
}
.qr-error {
  padding: 12px 16px;
  background: rgba(255, 180, 0, 0.08);
  border: 1px solid rgba(255, 180, 0, 0.3);
  border-radius: 8px;
  color: #ffb74d;
  font-size: 13px;
}

.qr-settings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.qr-settings label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--silver);
}
.qr-settings select,
.qr-settings input[type="range"] {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background: transparent;
  color: var(--white);
  font-size: 13px;
}
.qr-settings select:focus,
.qr-settings input:focus {
  outline: none;
  border-color: var(--blue);
}
.qr-settings input[type="color"] {
  width: 100%;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
}
.qr-info {
  margin-top: 16px;
  padding: 10px 14px;
  background: var(--frosted);
  border-radius: 8px;
  font-size: 13px;
  color: var(--silver);
}

.qr-scan-result {
  margin-top: 16px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.qr-scan-preview {
  max-width: 240px;
  max-height: 240px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.qr-scan-text {
  flex: 1;
  min-width: 280px;
}
.qr-scan-label {
  font-size: 13px;
  color: var(--silver);
  margin-bottom: 6px;
}
.qr-scan-text textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-family: ui-monospace, monospace;
  resize: vertical;
  box-sizing: border-box;
  background: transparent;
  color: var(--white);
}

/* 🇨🇳 R43b 批量合并 UI */
.qr-batch-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.qr-batch-progress {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--frosted);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}
.qr-batch-progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}
.qr-batch-progress-fill {
  height: 100%;
  background: var(--blue);
  box-shadow: 0 0 8px var(--blue-glow);
  transition: width 0.2s ease;
}
.qr-batch-progress-text {
  margin-top: 8px;
  font-size: 13px;
  color: var(--white);
}
.qr-batch-progress-meta {
  color: var(--silver);
  margin-left: 4px;
}
.qr-batch-error {
  margin-top: 12px;
  white-space: pre-wrap;
  font-family: ui-monospace, monospace;
}
.qr-batch-result {
  margin-top: 16px;
  padding: 16px;
  background: var(--frosted);
  border: 1px solid rgba(0, 153, 255, 0.25);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.qr-batch-success {
  padding: 10px 14px;
  background: rgba(0, 200, 100, 0.08);
  border: 1px solid rgba(0, 200, 100, 0.3);
  border-radius: 8px;
  color: #66cc88;
  font-size: 14px;
}
.qr-batch-warn {
  padding: 10px 14px;
  background: rgba(255, 180, 0, 0.08);
  border: 1px solid rgba(255, 180, 0, 0.3);
  border-radius: 8px;
  color: #ffb74d;
  font-size: 13px;
}
.qr-batch-warn strong {
  color: #ffd699;
  font-family: ui-monospace, monospace;
}
.qr-batch-meta {
  font-size: 13px;
  color: var(--silver);
}
.qr-batch-meta strong {
  color: var(--white);
  font-family: ui-monospace, monospace;
  margin: 0 4px;
}
.qr-batch-meta textarea {
  margin-top: 8px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  resize: vertical;
  background: rgba(0, 0, 0, 0.3);
  color: var(--white);
  box-sizing: border-box;
}
.qr-section-desc code {
  background: var(--frosted);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--blue);
}

/* 🇨🇳 R43b 使用指南 4 步卡片 */
.qr-guide-section {
  background: linear-gradient(135deg, var(--near-black) 0%, rgba(0, 153, 255, 0.05) 100%);
  border-color: rgba(0, 153, 255, 0.2);
}
.qr-guide-section h3 {
  margin-bottom: 20px;
}
.qr-guide-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.qr-guide-step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px;
  background: var(--frosted);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.qr-guide-step:hover {
  border-color: rgba(0, 153, 255, 0.4);
  transform: translateY(-1px);
}
.qr-guide-num {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: var(--blue);
  color: var(--white);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-sans, system-ui);
  box-shadow: 0 0 12px var(--blue-glow);
}
.qr-guide-content {
  flex: 1;
  min-width: 0;
}
.qr-guide-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--white);
  margin-bottom: 6px;
}
.qr-guide-desc {
  font-size: 12px;
  color: var(--silver);
  line-height: 1.55;
}
.qr-guide-desc strong {
  color: var(--white);
}
.qr-guide-desc code {
  background: rgba(0, 153, 255, 0.1);
  border: 1px solid rgba(0, 153, 255, 0.3);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--blue);
}
.qr-guide-tip {
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(0, 153, 255, 0.05);
  border-left: 2px solid var(--blue);
  border-radius: 4px;
  font-size: 11px;
  color: var(--silver);
  line-height: 1.5;
}
.qr-guide-tip strong { color: var(--blue); }
.qr-guide-footnote {
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  font-size: 12px;
  color: var(--silver);
  line-height: 1.7;
}
.qr-guide-footnote strong {
  color: var(--white);
  font-size: 13px;
}
@media (max-width: 768px) {
  .qr-guide-grid { grid-template-columns: 1fr; }
}

/* 🇨🇳 R43c 规则一览表 */
.qr-rules-box {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--frosted);
  border: 1px solid rgba(0, 153, 255, 0.2);
  border-radius: 10px;
}
.qr-rules-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--blue);
  margin-bottom: 10px;
}
.qr-rules-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.qr-rules-table th,
.qr-rules-table td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.qr-rules-table th {
  background: rgba(0, 0, 0, 0.3);
  color: var(--silver);
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.qr-rules-table td {
  color: var(--white);
  vertical-align: middle;
}
.qr-rules-table tr:last-child td {
  border-bottom: none;
}
.qr-rules-table tr:hover td {
  background: rgba(0, 153, 255, 0.04);
}
.qr-rules-table code {
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--blue);
}
</style>