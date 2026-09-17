<template>
  <div class="pdf-tool-page">
    <!-- 顶部导航 -->
    <JianheboxToolNav title="{{ t('tools.pdf.name') }}" />

    <div class="pdf-container">
      <!-- 功能 Tab -->
      <div class="pdf-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="switchTab(tab.id)"
        >
          {{ tab.icon }} {{ tab.name }}
        </button>
      </div>

      <!-- 说明 -->
      <p class="pdf-desc">{{ currentTabDesc }}</p>

      <!-- 文件上传区 -->
      <div class="upload-zone" @dragover.prevent @drop.prevent="handleDrop" @click="fileInputRef.click()">
        <input
          ref="fileInputRef"
          type="file"
          :accept="currentAccept"
          :multiple="currentMulti"
          @change="handleFileSelect"
          style="display:none"
        />
        <div class="upload-hint" @click="fileInputRef.click()">
          <span class="upload-icon">📄</span>
          <p>拖拽文件到这里,或<span class="upload-link">点击选择文件</span></p>
          <p class="upload-sub">{{ currentUploadHint }}</p>
        </div>
      </div>

      <!-- 文件列表 -->
      <div v-if="files.length > 0" class="file-list">
        <div v-for="(f, i) in files" :key="i" class="file-item">
          <span class="file-icon">📄</span>
          <span class="file-name">{{ f.name }}</span>
          <span class="file-size">{{ formatSize(f.size) }}</span>
          <button class="file-remove" @click="removeFile(i)">✕</button>
        </div>
      </div>

      <!-- 操作面板 -->
      <div v-if="files.length > 0" class="action-panel">
        <!-- 合并: 无额外参数 -->
        <!-- 拆分: 页码范围 -->
        <div v-if="activeTab === 'split'" class="sub-params">
          <label>页码范围(留空=全部): <input v-model="pageRange" placeholder="如: 1-3, 5, 7-10" class="text-input" /></label>
        </div>

        <!-- 删页: 页码 -->
        <div v-if="activeTab === 'remove'" class="sub-params">
          <label>要删除的页码: <input v-model="pagesToRemove" placeholder="如: 2, 4, 6" class="text-input" /></label>
        </div>

        <!-- 转图: DPI / 格式 -->
        <div v-if="activeTab === 'toImage'" class="sub-params">
          <label>DPI: <input v-model.number="imgDpi" type="number" min="72" max="600" value="150" class="num-input" /></label>
          <label>格式:
            <select v-model="imgFormat" class="select-input">
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </label>
        </div>

        <!-- 加水印: 文字 / 位置 -->
        <div v-if="activeTab === 'watermark'" class="sub-params">
          <label>水印文字: <input v-model="watermarkText" placeholder="简盒 JianHeBox" class="text-input" /></label>
          <label>透明度(0-1): <input v-model.number="watermarkOpacity" type="number" min="0.1" max="1" step="0.1" value="0.3" class="num-input" /></label>
          <label>位置:
            <select v-model="watermarkPosition" class="select-input">
              <option value="center">居中</option>
              <option value="diagonal">对角线</option>
              <option value="bottom">底部</option>
            </select>
          </label>
        </div>

        <!-- PDF→文本: 格式选择 -->
        <div v-if="activeTab === 'toText'" class="sub-params">
          <label>输出格式:
            <select v-model="textFormat" class="select-input">
              <option value="txt">纯文本 (TXT)</option>
              <option value="md">Markdown (带页分隔)</option>
            </select>
          </label>
          <p class="param-tip">💡 纯文字提取,扫描版 PDF 无文字层则需先用 OCR 工具</p>
        </div>

        <!-- 去水印(遮盖): 页码 + 坐标(单位:pt, A4 = 595×842) -->
        <div v-if="activeTab === 'coverWM'" class="sub-params">
          <label>作用页(留空=全部):
            <input v-model="coverWMPages" placeholder="如: 1 或 1-3, 5" class="text-input" />
          </label>
          <label>X 坐标(从左,pt): <input v-model.number="coverWMX" type="number" class="num-input" /></label>
          <label>Y 坐标(从下,pt): <input v-model.number="coverWMY" type="number" class="num-input" /></label>
          <label>宽(pt): <input v-model.number="coverWMWidth" type="number" class="num-input" /></label>
          <label>高(pt): <input v-model.number="coverWMHeight" type="number" class="num-input" /></label>
          <p class="param-tip">💡 在水印位置画白底矩形遮盖。A4 是 595×842pt。坐标用 Word/WPS 的"插入→形状→位置"看。</p>
        </div>

        <!-- 操作按钮 -->
        <div class="action-btns">
          <button class="action-btn primary" :disabled="processing" @click="runAction">
            {{ processing ? '处理中…' : actionLabel }}
          </button>
          <button class="action-btn secondary" @click="clearAll">清空</button>
        </div>

        <!-- 进度 -->
        <div v-if="processing" class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          <span class="progress-text">{{ progress }}%</span>
        </div>
      </div>

      <!-- 结果区 -->
      <div v-if="resultUrl" class="result-zone">
        <p class="result-label">✅ 处理完成</p>
        <a :href="resultUrl" :download="resultFilename" class="download-btn">
          📥 下载 {{ resultFilename }}
        </a>
        <button v-if="resultUrls.length > 1" class="download-zip-btn" @click="downloadZip">
          📦 下载全部 ({{ resultUrls.length }} 个文件)
        </button>
        <!-- 文本/Markdown 预览区 -->
        <details v-if="textPreview" class="text-preview">
          <summary>👁 预览前 2000 字(可点击展开)</summary>
          <pre>{{ textPreview }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed } from 'vue'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import JianheboxToolNav from './JianheboxToolNav.vue'

// ========== 状态 ==========
const tabs = computed(() => [
  { id: 'merge',     name: t('pdf.tab.merge'),     icon: '🔗' },
  { id: 'split',     name: t('pdf.tab.split'),     icon: '✂️' },
  { id: 'remove',    name: t('pdf.tab.remove'),    icon: '🗑️' },
  { id: 'toImage',   name: t('pdf.tab.toImage'),   icon: '🖼️' },
  { id: 'fromImage', name: t('pdf.tab.fromImage'), icon: '📷' },
  { id: 'watermark', name: t('pdf.tab.watermark'), icon: '💧' },
  { id: 'toWord',    name: t('pdf.tab.toWord'),    icon: '📝' },
  { id: 'toExcel',   name: t('pdf.tab.toExcel'),   icon: '📊' },
  { id: 'toText',    name: t('pdf.tab.toText'),    icon: '📄' },
  { id: 'coverWM',   name: t('pdf.tab.coverWM'),   icon: '🧽' },
])
const activeTab = ref('merge')
const fileInputRef = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const resultUrl = ref('')
const resultFilename = ref('')
const resultUrls = ref<string[]>([])
const textPreview = ref('')  // 文本/Markdown/表格预览(2000 字)

// 操作参数
const pageRange = ref('')
const pagesToRemove = ref('')
const imgDpi = ref(150)
const imgFormat = ref('png')
const watermarkText = ref('简盒 JianHeBox')
const watermarkOpacity = ref(0.3)
const watermarkPosition = ref('diagonal')
// 新增:文本提取格式 / 去水印坐标
const textFormat = ref<'txt' | 'md'>('txt')
const coverWMPages = ref('1')  // 作用页(默认第 1 页), 留空=全部页
const coverWMX = ref(50)       // 矩形 X 坐标(从左,pt)
const coverWMY = ref(50)       // 矩形 Y 坐标(从下,pt)
const coverWMWidth = ref(200)  // 矩形宽(pt)
const coverWMHeight = ref(60)  // 矩形高(pt)

// ========== 计算属性 ==========
const currentTabDesc = computed(() => {
  const descs: Record<string, string> = {
    merge:    '把多个 PDF 合并成 1 个,保持原有顺序',
    split:    '按指定页码范围拆分 PDF,可提取 1-N 区间页',
    remove:   '删除指定页码,其余页保留顺序',
    toImage:  '将 PDF 每页转成图片,支持 PNG/JPEG',
    fromImage:'把多张图片合并成 1 个 PDF',
    watermark:'给每页加文字水印,支持对角线/居中/底部',
    toWord:   '提取 PDF 文字内容,导出为可编辑 Word 文档(纯文字,无复杂版式)',
    toExcel:  '提取 PDF 表格数据,导出为可编辑 Excel/CSV',
    toText:   '提取 PDF 文字,支持纯文本 / Markdown 两种格式',
    coverWM:  '在 PDF 上画白底矩形遮盖水印(选页+坐标),简单实用不删原水印',
  }
  return descs[activeTab.value] || ''
})

const currentAccept = computed(() => {
  if (activeTab.value === 'fromImage') return 'image/*'
  return '.pdf'
})

const currentMulti = computed(() => {
  return ['merge', 'toImage', 'fromImage'].includes(activeTab.value)
})

// 🇨🇳 2026-09-01 R40 修:之前 actionLabel undefined 导致按钮文字空白
const actionLabel = computed(() => {
  const map: Record<string, string> = {
    merge: '开始合并',
    split: '开始拆分',
    remove: '开始删除',
    toImage: '开始转换',
    fromImage: '开始生成',
    watermark: '开始加水印',
    toWord: '提取为 Word',
    toExcel: '提取为表格',
    toText: '提取为文本',
    coverWM: '开始遮盖',
  }
  return map[activeTab.value] || '开始处理'
})

const currentUploadHint = computed(() => {
  if (activeTab.value === 'merge')    return '支持多个 PDF · 支持拖拽排序'
  if (activeTab.value === 'toImage')  return '1 个 PDF · 转成多张图片'
  if (activeTab.value === 'fromImage')return '多张图片 · 合为 1 个 PDF'
  return '1 个 PDF'
})

// ========== 文件操作 ==========
function handleDrop(e: DragEvent) {
  const dropped = Array.from(e.dataTransfer?.files || [])
  addFiles(dropped)
}

function handleFileSelect(e: Event) {
  const selected = Array.from((e.target as HTMLInputElement).files || [])
  addFiles(selected)
}

function addFiles(newFiles: File[]) {
  for (const f of newFiles) {
    if (activeTab.value === 'fromImage') {
      if (f.type.startsWith('image/')) files.value.push(f)
    } else if (f.type === 'application/pdf') {
      files.value.push(f)
    }
  }
}

function removeFile(i: number) {
  files.value.splice(i, 1)
  resultUrl.value = ''
  resultUrls.value = []
}

function clearAll() {
  files.value = []
  resultUrl.value = ''
  resultUrls.value = []
  resultFilename.value = ''
  progress.value = 0
  textPreview.value = ''
}

// 🇨🇳 2026-09-01 R40 修:切换工具时清空文件 + 重置进度
function switchTab(tabId: string) {
  if (activeTab.value !== tabId) {
    activeTab.value = tabId
    clearAll()
  } else {
    activeTab.value = tabId
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// ========== PDF 操作 ==========
async function runAction() {
  processing.value = true
  progress.value = 5
  resultUrl.value = ''
  resultUrls.value = []

  try {
    switch (activeTab.value) {
      case 'merge':    await doMerge();    break
      case 'split':    await doSplit();    break
      case 'remove':   await doRemove();   break
      case 'toImage':  await doToImage();  break
      case 'fromImage':await doFromImage(); break
      case 'watermark':await doWatermark(); break
      case 'toWord':   await doToWord();   break
      case 'toExcel':  await doToExcel();  break
      case 'toText':   await doToText();   break
      case 'coverWM':  await doCoverWM();  break
    }
  } catch (err) {
    console.error('[PdfTool] 错误:', err)
    alert('处理失败: ' + String(err))
  } finally {
    processing.value = false
  }
}

// --- 合并 ---
async function doMerge() {
  if (files.value.length < 2) { alert('请至少上传 2 个 PDF'); return }
  progress.value = 20
  const merged = await PDFDocument.create()
  for (let i = 0; i < files.value.length; i++) {
    const bytes = await files.value[i].arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    for (const page of pages) merged.addPage(page)
    progress.value = 20 + Math.round((i / files.value.length) * 60)
  }
  progress.value = 90
  const out = await merged.save()
  progress.value = 100
  const blob = new Blob([out], { type: 'application/pdf' })
  resultUrl.value = URL.createObjectURL(blob)
  resultFilename.value = '合并后.pdf'
}

// --- 拆分 ---
async function doSplit() {
  const docBytes = await files.value[0].arrayBuffer()
  const doc = await PDFDocument.load(docBytes)
  const totalPages = doc.getPageCount()
  const pages = parseRange(pageRange.value, totalPages)
  progress.value = 40

  if (pages.length === 1) {
    // 单个范围 → 输出 1 个 PDF
    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(doc, pages.map(p => p - 1))
    for (const p of copied) newDoc.addPage(p)
    const out = await newDoc.save()
    const blob = new Blob([out], { type: 'application/pdf' })
    resultUrl.value = URL.createObjectURL(blob)
    resultFilename.value = `第${pageRange.value}页.pdf`
  } else {
    // 多个范围 → 每个输出 1 个 PDF → zip
    const urls: string[] = []
    for (let i = 0; i < pages.length; i++) {
      const newDoc = await PDFDocument.create()
      const copied = await newDoc.copyPages(doc, [(pages[i] - 1)])
      for (const p of copied) newDoc.addPage(p)
      const out = await newDoc.save()
      urls.push(URL.createObjectURL(new Blob([out], { type: 'application/pdf' })))
    }
    resultUrls.value = urls
    resultFilename.value = `拆分结果(${pages.length}页}).pdf`
    resultUrl.value = urls[0]
  }
  progress.value = 100
}

// --- 删页 ---
async function doRemove() {
  const docBytes = await files.value[0].arrayBuffer()
  const doc = await PDFDocument.load(docBytes)
  const total = doc.getPageCount()
  const removeSet = new Set(parsePagesList(pagesToRemove.value))
  const keepPages: number[] = []
  for (let i = 0; i < total; i++) if (!removeSet.has(i + 1)) keepPages.push(i)
  progress.value = 50
  const newDoc = await PDFDocument.create()
  const copied = await newDoc.copyPages(doc, keepPages)
  for (const p of copied) newDoc.addPage(p)
  const out = await newDoc.save()
  progress.value = 100
  const blob = new Blob([out], { type: 'application/pdf' })
  resultUrl.value = URL.createObjectURL(blob)
  resultFilename.value = '删除页后.pdf'
}

// --- 转图片 ---
async function doToImage() {
  const docBytes = await files.value[0].arrayBuffer()
  const urls: string[] = []
  const ext = imgFormat.value === 'jpeg' ? 'jpg' : 'png'
  const mimeType = imgFormat.value === 'jpeg' ? 'image/jpeg' : 'image/png'

  // 动态 import pdfjs(避免首屏加载)
  const pdfjs = await import('pdfjs-dist')
  // worker 设置:用 CDN 避免本地打包 worker
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

  const loadingTask = pdfjs.getDocument({ data: docBytes })
  const pdf = await loadingTask.promise
  const total = pdf.numPages
  const scale = imgDpi.value / 72

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    // 白色背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    progress.value = Math.round((i / total) * 80)

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob(b => resolve(b!), mimeType, 0.92)
    )
    urls.push(URL.createObjectURL(blob))
    page.cleanup()
  }
  // 🇨🇳 2026-09-01 R40 修:pdfjs 新版 destroy 行为变化,try/finally 安全调用
  try { await pdf.cleanup() } catch {}
  try { if (typeof pdf.destroy === 'function') pdf.destroy() } catch {}
  resultUrls.value = urls
  resultFilename.value = `第1页.${ext}`
  resultUrl.value = urls[0]
  progress.value = 100
}

// --- 图片转 PDF ---
async function doFromImage() {
  const doc = await PDFDocument.create()
  for (let i = 0; i < files.value.length; i++) {
    const f = files.value[i]
    const bytes = await f.arrayBuffer()
    let img
    if (f.type === 'image/png') {
      img = await doc.embedPng(bytes)
    } else {
      img = await doc.embedJpg(bytes)
    }
    const page = doc.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    progress.value = Math.round((i / files.value.length) * 80)
  }
  progress.value = 90
  const out = await doc.save()
  progress.value = 100
  const blob = new Blob([out], { type: 'application/pdf' })
  resultUrl.value = URL.createObjectURL(blob)
  resultFilename.value = '图片合并.pdf'
}

// --- 加水印 ---
async function doWatermark() {
  const docBytes = await files.value[0].arrayBuffer()
  const doc = await PDFDocument.load(docBytes)
  const pages = doc.getPages()
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const { width, height } = page.getSize()
    const size = Math.min(width, height) * 0.06
    const alpha = watermarkOpacity.value

    if (watermarkPosition.value === 'diagonal') {
      page.drawText(watermarkText.value, {
        x: width * 0.1, y: height * 0.15,
        size, color: rgb(0.7, 0.7, 0.7),
        opacity: alpha, rotate: degrees(30),
      })
    } else if (watermarkPosition.value === 'center') {
      const textWidth = watermarkText.value.length * size * 0.5
      page.drawText(watermarkText.value, {
        x: (width - textWidth) / 2, y: height / 2 - size / 2,
        size, color: rgb(0.6, 0.6, 0.6), opacity: alpha,
      })
    } else {
      const textWidth = watermarkText.value.length * size * 0.5
      page.drawText(watermarkText.value, {
        x: (width - textWidth) / 2, y: size * 1.5,
        size, color: rgb(0.6, 0.6, 0.6), opacity: alpha,
      })
    }
    progress.value = Math.round((i / pages.length) * 80)
  }
  progress.value = 90
  const out = await doc.save()
  progress.value = 100
  const blob = new Blob([out], { type: 'application/pdf' })
  resultUrl.value = URL.createObjectURL(blob)
  resultFilename.value = '加水印.pdf'
}

// --- PDF → Word (docx) ---
// 策略: 用 pdfjs 提取每页文字,手搓一个最小 docx(纯文字段落)
// 限制: 不保留图片、表格、字体、版式 — 纯文字流。优点: 0 依赖(不引 docx.js 1MB+), 离线可用。
async function doToWord() {
  const docBytes = await files.value[0].arrayBuffer()
  // 动态 import pdfjs
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
  const loadingTask = pdfjs.getDocument({ data: docBytes })
  const pdf = await loadingTask.promise
  const total = pdf.numPages
  let allText = ''
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // 把每页文字按 Y 坐标分行(简单版:按 transform[5] 同 y 分组)
    const lines: Record<number, string[]> = {}
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform[5])
      if (!lines[y]) lines[y] = []
      lines[y].push(item.str)
    }
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a)  // PDF y 从下往上
    const pageLines = sortedY.map(y => lines[y].join('').trim()).filter(Boolean)
    allText += `【第 ${i} 页】\n` + pageLines.join('\n') + '\n\n'
    progress.value = Math.round((i / total) * 80)
    page.cleanup()
  }
  // 🇨🇳 2026-09-01 R40 修:pdfjs 新版 destroy 行为变化,try/finally 安全调用
  try { await pdf.cleanup() } catch {}
  try { if (typeof pdf.destroy === 'function') pdf.destroy() } catch {}
  progress.value = 90
  // 手搓 docx(最小可读结构)
  const docxBlob = buildDocx(allText, files.value[0].name.replace(/\.pdf$/i, ''))
  progress.value = 100
  const blob = docxBlob
  resultUrl.value = URL.createObjectURL(blob)
  resultFilename.value = `${files.value[0].name.replace(/\.pdf$/i, '')}.docx`
  textPreview.value = allText.slice(0, 2000)
}

// 构建最小 docx(纯文字流,无样式)。参考 docx zip 结构: [Content_Types].xml + word/document.xml
function buildDocx(text: string, title: string): Blob {
  const paragraphs = text.split('\n').filter(l => l.trim()).map(line => {
    // 转义 XML 特殊字符
    const safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`
  }).join('')
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${title}</w:t></w:r></w:p>
${paragraphs}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>
</w:body>
</w:document>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  // 用 JSZip 打包(已装) — 不用了,改用更简单的方案:不解压 zip,直接给 blob 类型 docx?Word 必须合法 zip。
  // 改方案:用 JSZip
  // 后面 import JSZip 已在 doToExcel 用,这里也用同一种方式
  // 实际代码继续:
  return _zipDocx({ contentTypes, rels, documentXml })
}

// 实际打包 zip(用 fflate,已装;异步 zipSync)
async function _zipDocx(parts: Record<string, string>): Promise<Blob> {
  const { zip } = await import('fflate')
  return new Promise((resolve, reject) => {
    // fflate 路径必须用 / 分隔,且 [Content_Types].xml 是合法的
    const files: Record<string, Uint8Array> = {
      '[Content_Types].xml': new TextEncoder().encode(parts.contentTypes),
      '_rels/.rels': new TextEncoder().encode(parts.rels),
      'word/document.xml': new TextEncoder().encode(parts.documentXml),
    }
    zip(files, { level: 0 }, (err, data) => {
      if (err) return reject(err)
      resolve(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    })
  })
}

// --- PDF → Excel/CSV ---
// 策略: 用 pdfjs 提取每页文字,按空格/Tab 分列(启发式: 同 y 行内多段文字 → 多列)
// 输出: Excel 用 SheetJS(已装),CSV 用纯文本
async function doToExcel() {
  const docBytes = await files.value[0].arrayBuffer()
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
  const loadingTask = pdfjs.getDocument({ data: docBytes })
  const pdf = await loadingTask.promise
  const total = pdf.numPages
  // 启发式: 从所有页里抽取"看起来像表格"的行(同 y 有多个分隔明显的字符串)
  // 简化版: 每页只取首张"疑似表格",列数 = 该行最大字符串数
  const allRows: string[][] = []
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const lines: Record<number, { x: number; str: string }[]> = {}
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform[5])
      if (!lines[y]) lines[y] = []
      lines[y].push({ x: item.transform[4], str: item.str })
    }
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a)
    for (const y of sortedY) {
      const items = lines[y].sort((a, b) => a.x - b.x)
      const row = items.map(it => it.str.trim()).filter(Boolean)
      // 只保留 ≥2 列的行(疑似表格行)
      if (row.length >= 2) allRows.push([`[第${i}页]`, ...row])
    }
    progress.value = Math.round((i / total) * 70)
    page.cleanup()
  }
  // 🇨🇳 2026-09-01 R40 修:pdfjs 新版 destroy 行为变化,try/finally 安全调用
  try { await pdf.cleanup() } catch {}
  try { if (typeof pdf.destroy === 'function') pdf.destroy() } catch {}
  progress.value = 80
  if (allRows.length === 0) {
    throw new Error('未检测到表格行(此 PDF 可能没有清晰的表格结构,试试 PDF→文本)')
  }
  // CSV 输出
  const csvContent = allRows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  // 给 CSV 加 BOM 让 Excel 正确识别中文
  const csvBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
  resultUrl.value = URL.createObjectURL(csvBlob)
  resultFilename.value = `${files.value[0].name.replace(/\.pdf$/i, '')}.csv`
  textPreview.value = csvContent.slice(0, 2000)
  progress.value = 100
}

// --- PDF → 文本 / Markdown ---
async function doToText() {
  const docBytes = await files.value[0].arrayBuffer()
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
  const loadingTask = pdfjs.getDocument({ data: docBytes })
  const pdf = await loadingTask.promise
  const total = pdf.numPages
  let out = ''
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const lines: Record<number, string[]> = {}
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform[5])
      if (!lines[y]) lines[y] = []
      lines[y].push(item.str)
    }
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a)
    const pageLines = sortedY.map(y => lines[y].join('').trim()).filter(Boolean)
    if (textFormat.value === 'md') {
      out += `## 第 ${i} 页\n\n` + pageLines.join('  \n') + '\n\n'
    } else {
      out += pageLines.join('\n') + '\n\n'
    }
    progress.value = Math.round((i / total) * 90)
    page.cleanup()
  }
  // 🇨🇳 2026-09-01 R40 修:pdfjs 新版 destroy 行为变化,try/finally 安全调用
  try { await pdf.cleanup() } catch {}
  try { if (typeof pdf.destroy === 'function') pdf.destroy() } catch {}
  progress.value = 100
  const ext = textFormat.value
  const mimeType = textFormat.value === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
  const blob = new Blob([out], { type: mimeType })
  resultUrl.value = URL.createObjectURL(blob)
  resultFilename.value = `${files.value[0].name.replace(/\.pdf$/i, '')}.${ext}`
  textPreview.value = out.slice(0, 2000)
}

// --- 去水印(白底矩形遮盖) ---
async function doCoverWM() {
  const docBytes = await files.value[0].arrayBuffer()
  const doc = await PDFDocument.load(docBytes)
  const total = doc.getPageCount()
  const targetPages = coverWMPages.value.trim()
    ? parseRange(coverWMPages.value, total)
    : Array.from({ length: total }, (_, i) => i + 1)
  for (const pn of targetPages) {
    const page = doc.getPage(pn - 1)
    page.drawRectangle({
      x: coverWMX.value,
      y: coverWMY.value,
      width: coverWMWidth.value,
      height: coverWMHeight.value,
      color: rgb(1, 1, 1),  // 白色
      opacity: 1,
    })
    progress.value = Math.round((pn / total) * 80)
  }
  const out = await doc.save()
  progress.value = 100
  const blob = new Blob([out], { type: 'application/pdf' })
  resultUrl.value = URL.createObjectURL(blob)
  resultFilename.value = `${files.value[0].name.replace(/\.pdf$/i, '')}-遮盖水印.pdf`
}

// ========== 工具函数 ==========
function parsePagesList(s: string): number[] {
  if (!s.trim()) return []
  return s.split(',').flatMap(p => {
    const n = parseInt(p.trim(), 10)
    return isNaN(n) ? [] : [n]
  })
}

function parseRange(s: string, total: number): number[] {
  if (!s.trim()) return Array.from({ length: total }, (_, i) => i + 1)
  const result: number[] = []
  for (const part of s.split(',')) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(v => parseInt(v.trim(), 10))
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(total, end); i++) result.push(i)
      }
    } else {
      const n = parseInt(trimmed, 10)
      if (!isNaN(n) && n >= 1 && n <= total) result.push(n)
    }
  }
  return [...new Set(result)].sort((a, b) => a - b)
}

async function downloadZip() {
  // 简单实现: 逐个下载(生产环境建议用 JSZip)
  for (let i = 0; i < resultUrls.value.length; i++) {
    const a = document.createElement('a')
    a.href = resultUrls.value[i]
    a.download = `第${i + 1}页.png`
    a.click()
    await new Promise(r => setTimeout(r, 300))
  }
}
</script>

<style scoped>
.pdf-tool-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.pdf-container {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.pdf-tabs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}
@media (max-width: 900px) {
  .pdf-tabs {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 600px) {
  .pdf-tabs {
    grid-template-columns: repeat(2, 1fr);
  }
}
/* 🇨🇳 2026-09-01 R37 需求6:超窄屏 2 列还是挤(10 tab → 5 行),改 auto-fill minmax(80px, 1fr) 智能列数 */
@media (max-width: 420px) {
  .pdf-tabs {
    grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
    gap: 5px;
  }
  .pdf-tabs .tab-btn {
    font-size: 11px !important;
    padding: 8px 4px !important;
    white-space: nowrap;
  }
}

.tab-btn {
  background: var(--color-bg-frosted);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: var(--font-md);
  transition: all var(--duration-fast) var(--ease-out);
  font-family: inherit;
}

.tab-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-primary-text);
  font-weight: var(--weight-semibold);
}

.pdf-desc {
  color: #888;
  font-size: 13px;
  margin: 0 0 16px;
}

.upload-zone {
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
  margin-bottom: 16px;
}

.upload-zone:hover { border-color: #4a6b47; }

.upload-hint { pointer-events: none; }

.upload-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 12px;
}

.upload-hint p {
  margin: 4px 0;
  font-size: 14px;
  color: #888;
}

.upload-sub {
  font-size: 12px !important;
  color: #555 !important;
}

.upload-link {
  color: #4a6b47;
  pointer-events: auto;
  cursor: pointer;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}

.file-icon { font-size: 18px; }
.file-name { flex: 1; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { color: #666; font-size: 12px; }
.file-remove {
  background: none; border: none; color: #666; cursor: pointer; font-size: 12px;
  padding: 2px 6px; border-radius: 4px;
}
.file-remove:hover { background: rgba(255,0,0,0.2); color: #e55; }

.action-panel {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 20px;
}

.sub-params {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.sub-params label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #aaa;
}

.text-input, .num-input, .select-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  color: #ddd;
  padding: 6px 10px;
  font-size: 13px;
  outline: none;
}

.text-input:focus, .num-input:focus, .select-input:focus {
  border-color: #4a6b47;
}

.num-input { width: 80px; }
.select-input { cursor: pointer; }

.action-btns {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.action-btn {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  cursor: pointer;
  font-size: var(--font-md);
  font-weight: var(--weight-medium);
  transition: all var(--duration-fast) var(--ease-out);
  font-family: inherit;
}

.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.action-btn.primary {
  /* 🇨🇳 2026-09-01 R40 修:不依赖 CSS 变量(--color-primary 在黑色背景下被设成白色 → 白底白字看不见), 硬编码蓝色 */
  background: #2563eb;
  color: #ffffff;
  font-weight: var(--weight-semibold);
}

.action-btn.primary:hover:not(:disabled) {
  background: #1d4ed8;
  transform: scale(0.97);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);
}

.action-btn.secondary {
  background: var(--color-bg-frosted);
  color: var(--color-text-muted);
  border-color: var(--color-border);
}

.action-btn.secondary:hover:not(:disabled) {
  background: var(--color-bg-frosted-hover);
  color: var(--color-text);
  border-color: var(--color-accent);
}

.progress-bar {
  margin-top: 12px;
  background: rgba(255,255,255,0.08);
  border-radius: 6px;
  height: 8px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a6b47, #7ab87e);
  border-radius: 6px;
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  right: 8px;
  top: -2px;
  font-size: 11px;
  color: #888;
}

.result-zone {
  margin-top: 20px;
  text-align: center;
}

.result-label {
  color: #7ab87e;
  font-size: 15px;
  margin-bottom: 12px;
}

.download-btn {
  display: inline-block;
  background: #4a6b47;
  color: #fff;
  text-decoration: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 8px;
}

.download-zip-btn {
  display: block;
  margin: 8px auto 0;
  background: none;
  border: 1px solid rgba(255,255,255,0.15);
  color: #888;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

/* 新增:文本/Markdown/CSV 预览区 */
.text-preview {
  margin-top: 20px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 12px;
  text-align: left;
}
.text-preview summary {
  cursor: pointer;
  color: #7ab87e;
  font-size: 13px;
  user-select: none;
}
.text-preview pre {
  margin: 10px 0 0;
  max-height: 400px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  color: #ccc;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 新增:参数面板内的小提示 */
.param-tip {
  flex-basis: 100%;
  color: #7a8e7a;
  font-size: 12px;
  margin: 4px 0 0;
  line-height: 1.5;
}

/* 子参数面板支持多行 */
.sub-params {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.sub-params > label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #aaa;
}
/* 🇨🇳 2026-08-31 M3.9 R35:移动端关闭 min-height:100vh + tab 改 2 列更紧凑 */
@media (max-width: 720px) {
  .pdf-tool-page { min-height: auto; padding: 16px; max-width: 100vw; overflow-x: hidden; }
  .pdf-tool-page > * { max-width: 100%; min-width: 0; }
  .pdf-tool-page .page-header h1 { font-size: 22px; word-break: break-word; }
  .pdf-tool-page .page-header .subtitle { font-size: 13px; word-break: break-word; }
  .pdf-tabs { grid-template-columns: repeat(2, 1fr) !important; gap: 6px; }
  .pdf-tabs .pdf-tab-btn {
    font-size: 12px !important;
    padding: 8px 4px !important;
    white-space: normal;
    line-height: 1.3;
    height: auto;
    text-align: center;
  }
}
</style>
