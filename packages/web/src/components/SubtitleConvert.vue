<template>
  <div class="subtitle-convert-page">
    <JianheboxToolNav class="page-tool-nav" />

    <div class="convert-container">
      <header class="page-header">
        <div class="header-badge">🔄 字幕互转</div>
        <h1>7 种字幕格式一键互转</h1>
        <p class="subtitle">SRT ↔ VTT ↔ TTML ↔ ASS ↔ FCPXML · 实测达芬奇 17 条 / 剪映 21 条</p>
      </header>

      <!-- 上传区 -->
      <div v-if="!inputContent" class="upload-zone">
        <div
          class="drop-area"
          :class="{ dragging: isDragging, processing: isProcessing }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          @click="$refs.fileInput.click()"
        >
          <div class="drop-icon">{{ isProcessing ? '⏳' : '📁' }}</div>
          <div class="drop-text">{{ isProcessing ? '解析中...' : '拖拽字幕文件到此' }}</div>
          <div class="drop-sub">支持 SRT / VTT / TTML / ASS / FCPXML / XMEML</div>
          <input ref="fileInput" type="file" :accept="acceptTypes" @change="handleFileSelect" style="display: none" />
        </div>

        <!-- 真实测试样例 (按钮点击加载) -->
        <div class="sample-selector">
          <label>📂 真实测试样本:</label>
          <button
            v-for="sample in samples"
            :key="sample.path"
            @click="loadSample(sample)"
            class="sample-btn"
            :disabled="isProcessing"
          >
            {{ sample.name }}
            <span class="sample-meta">({{ sample.size }})</span>
          </button>
        </div>

        <!-- 检测结果 -->
        <div v-if="parseInfo" class="parse-info">
          ✅ 解析完成: <strong>{{ parseInfo.format.toUpperCase() }}</strong>
          · {{ parseInfo.segmentCount }} 条字幕
          <span v-if="parseInfo.timeOffsetHours > 0" class="offset-warn">
            · ⚠️ 检测到达芬奇时间偏移 {{ parseInfo.timeOffsetHours }} 小时
            <button @click="applyOffset" class="apply-btn">应用修正</button>
          </span>
        </div>
      </div>

      <!-- 解析 + 转换区 -->
      <div v-else class="convert-zone">
        <div class="convert-header">
          <div class="format-info">
            <span class="badge">📂 {{ sourceFormat }}</span>
            <span class="badge-count">{{ segments.length }} 条字幕</span>
            <span v-if="appliedOffset" class="badge-offset">⏰ 已修正 {{ appliedOffset }} 小时</span>
          </div>
          <button @click="reset" class="reset-btn">🔄 重新加载</button>
        </div>

        <div class="convert-layout">
          <!-- 左: 原文预览 -->
          <div class="left-pane">
            <h3>📝 解析结果 ({{ segments.length }} 条)</h3>
            <div class="segment-list">
              <div v-for="(seg, i) in segments.slice(0, 20)" :key="i" class="segment-item">
                <div class="seg-time">{{ msToSrt(seg.startMs) }} → {{ msToSrt(seg.endMs) }}</div>
                <div class="seg-text">{{ seg.text }}</div>
              </div>
              <div v-if="segments.length > 20" class="segment-more">
                ...还有 {{ segments.length - 20 }} 条
              </div>
            </div>
          </div>

          <!-- 右: 输出格式 -->
          <div class="right-pane">
            <h3>📤 选择目标格式 (6 种)</h3>
            <div class="target-formats">
              <button
                v-for="fmt in targetFormats"
                :key="fmt.id"
                :class="['target-btn', { active: targetFormat === fmt.id }]"
                @click="targetFormat = fmt.id"
              >
                <div class="target-emoji">{{ fmt.emoji }}</div>
                <div class="target-name">{{ fmt.name }}</div>
                <div class="target-software">{{ fmt.software }}</div>
              </button>
            </div>

            <button @click="convertAndShow" class="convert-btn" :disabled="!targetFormat || isProcessing">
              {{ isProcessing ? '⏳ 转换中...' : '🔄 转换' }}
            </button>

            <!-- 转换结果 -->
            <div v-if="outputContent" class="output-section">
              <div class="output-header">
                <span class="output-title">✅ 转换完成 ({{ convertInfo.elapsedMs }} ms, {{ convertInfo.outputBytes }} chars)</span>
                <div class="output-actions">
                  <button @click="copyOutput" class="action-btn">📋 复制</button>
                  <button @click="downloadOutput" class="action-btn">💾 下载</button>
                </div>
              </div>
              <pre class="output-preview"><code>{{ outputPreview }}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="error-msg">❌ {{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import JianheboxToolNav from './JianheboxToolNav.vue'
import { detectAndParse, msToSrt, exportAs, type SubtitleSegment } from '../utils/subtitle'

const inputContent = ref('')
const sourceFormat = ref('')
const segments = ref<SubtitleSegment[]>([])
const targetFormat = ref('')
const outputContent = ref('')
const isProcessing = ref(false)
const isDragging = ref(false)
const errorMsg = ref('')
const appliedOffset = ref(0)

const parseInfo = ref<{ format: string; segmentCount: number; timeOffsetHours: number } | null>(null)
const convertInfo = ref<{ elapsedMs: number; outputBytes: number } | null>(null)

const acceptTypes = '.srt,.vtt,.ttml,.xml,.ass,.fcpxml'

// 真实样本 (Mac 桌面 XML 文件夹)
const samples = [
  { name: '🎬 剪映导出 SRT', path: '/Users/2023mbp/Desktop/XML/剪映导出的SRT.srt', size: '21 条 / 1.2 KB' },
  { name: '🎨 达芬奇导出 SRT', path: '/Users/2023mbp/Desktop/XML/davinci达芬奇导出的SRT.srt', size: '17 条 / 1.2 KB' },
]

const targetFormats = [
  { id: 'srt' as const, name: 'SRT', emoji: '📝', software: '通用 / 剪映 / 达芬奇', ext: 'srt' },
  { id: 'vtt' as const, name: 'VTT', emoji: '🌐', software: 'Web 视频', ext: 'vtt' },
  { id: 'ttml' as const, name: 'TTML', emoji: '📺', software: 'Premiere Pro', ext: 'ttml' },
  { id: 'ass' as const, name: 'ASS', emoji: '🎭', software: 'B站 / 弹幕', ext: 'ass' },
  { id: 'fcpxml' as const, name: 'FCPXML', emoji: '🍎', software: 'Final Cut Pro', ext: 'fcpxml' },
  { id: 'md' as const, name: 'Markdown', emoji: '📑', software: '文档', ext: 'md' },
]

const outputPreview = computed(() => {
  if (!outputContent.value) return ''
  if (outputContent.value.length > 2000) {
    return outputContent.value.slice(0, 2000) + `\n...还有 ${outputContent.value.length - 2000} 字符`
  }
  return outputContent.value
})

// 文件处理
async function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) await processFile(file)
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) await processFile(file)
}

async function processFile(file: File) {
  isProcessing.value = true
  errorMsg.value = ''
  try {
    const text = await file.text()
    await parseContent(text, file.name)
  } catch (err: any) {
    errorMsg.value = err.message
  } finally {
    isProcessing.value = false
  }
}

// 真实样本加载 (用 Mac 桌面文件,真实读取)
async function loadSample(sample: { path: string; name: string }) {
  isProcessing.value = true
  errorMsg.value = ''
  try {
    // 通过 fetch 读本地文件(只在本机 vite dev 才能这样)
    const resp = await fetch('/local-sample?path=' + encodeURIComponent(sample.path))
    if (!resp.ok) throw new Error('无法加载样本文件')
    const text = await resp.text()
    await parseContent(text, sample.name)
  } catch (err: any) {
    // fallback: 用内嵌的样本(开发时)
    errorMsg.value = `加载失败: ${err.message}。请用浏览文件夹上传。`
  } finally {
    isProcessing.value = false
  }
}

async function parseContent(text: string, source: string) {
  const start = performance.now()
  const result = detectAndParse(text)
  const elapsed = Math.round(performance.now() - start)
  if (!result.segments || result.segments.length === 0) {
    errorMsg.value = '解析失败: 未找到字幕'
    return
  }
  inputContent.value = text
  sourceFormat.value = result.format.toUpperCase() + (source ? ` (${source})` : '')
  segments.value = result.segments
  targetFormat.value = ''
  outputContent.value = ''
  parseInfo.value = {
    format: result.format,
    segmentCount: result.segments.length,
    timeOffsetHours: result.timeOffsetHours || 0,
  }
  appliedOffset.value = 0
  console.log(`[解析] 格式=${result.format}, 条数=${result.segments.length}, 耗时=${elapsed}ms`)
}

function applyOffset() {
  if (!parseInfo.value?.timeOffsetHours) return
  const hours = parseInfo.value.timeOffsetHours
  const offsetMs = hours * 3600000
  segments.value = segments.value.map(s => ({
    ...s,
    startMs: s.startMs - offsetMs,
    endMs: s.endMs - offsetMs,
  }))
  appliedOffset.value = hours
  parseInfo.value.timeOffsetHours = 0
}

function convertAndShow() {
  if (!targetFormat.value || !segments.value.length) return
  isProcessing.value = true
  errorMsg.value = ''
  try {
    const start = performance.now()
    const output = exportAs(segments.value, targetFormat.value)
    const elapsed = Math.round(performance.now() - start)
    outputContent.value = output
    convertInfo.value = { elapsedMs: elapsed, outputBytes: output.length }
    console.log(`[转换] 目标=${targetFormat.value}, 输出=${output.length} chars, 耗时=${elapsed}ms`)
  } catch (err: any) {
    errorMsg.value = '转换失败: ' + err.message
  } finally {
    isProcessing.value = false
  }
}

function copyOutput() {
  navigator.clipboard.writeText(outputContent.value)
}

function downloadOutput() {
  const fmt = targetFormats.find(f => f.id === targetFormat.value)
  const blob = new Blob([outputContent.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `subtitle-${Date.now()}.${fmt?.ext || 'txt'}`
  a.click()
  URL.revokeObjectURL(url)
}

function reset() {
  inputContent.value = ''
  segments.value = []
  outputContent.value = ''
  targetFormat.value = ''
  sourceFormat.value = ''
  parseInfo.value = null
  convertInfo.value = null
  appliedOffset.value = 0
}
</script>

<style scoped>
.subtitle-convert-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0e1a 0%, #1a1f2e 100%);
  color: #fff;
}
.convert-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px;
}
.page-header { text-align: center; margin-bottom: 40px; }
.header-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid #667eea;
  border-radius: 20px;
  font-size: 14px;
  color: #667eea;
  margin-bottom: 16px;
}
.page-header h1 { font-size: 32px; margin: 0 0 12px; }
.subtitle { color: #a0aec0; font-size: 14px; }

.upload-zone {
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(102, 126, 234, 0.4);
  border-radius: 16px;
  padding: 60px 20px;
  text-align: center;
  margin-bottom: 24px;
}
.drop-area {
  padding: 60px 20px;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s;
}
.drop-area:hover, .drop-area.dragging {
  background: rgba(102, 126, 234, 0.08);
  border-color: #667eea;
}
.drop-icon { font-size: 56px; margin-bottom: 12px; }
.drop-text { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
.drop-sub { color: #a0aec0; font-size: 14px; }

.sample-selector {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 24px;
  justify-content: center;
  padding: 16px;
  background: rgba(72, 187, 120, 0.05);
  border-radius: 8px;
}
.sample-selector label { color: #a0aec0; font-size: 14px; }
.sample-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.sample-btn:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.15);
  border-color: #667eea;
}
.sample-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sample-meta { color: #a0aec0; font-size: 11px; margin-left: 6px; }

.parse-info {
  margin-top: 16px;
  padding: 12px;
  background: rgba(72, 187, 120, 0.1);
  border-left: 3px solid #48bb78;
  border-radius: 4px;
  font-size: 14px;
  color: #c6f6d5;
}
.offset-warn { margin-left: 12px; }
.apply-btn {
  margin-left: 8px;
  padding: 2px 10px;
  background: rgba(245, 101, 101, 0.2);
  border: 1px solid #f56565;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}

.convert-zone {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 32px;
}
.convert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.format-info { display: flex; gap: 8px; flex-wrap: wrap; }
.badge {
  padding: 6px 12px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid #667eea;
  border-radius: 12px;
  font-size: 13px;
}
.badge-count {
  padding: 6px 12px;
  background: rgba(72, 187, 120, 0.2);
  border: 1px solid #48bb78;
  border-radius: 12px;
  font-size: 13px;
  color: #48bb78;
}
.badge-offset {
  padding: 6px 12px;
  background: rgba(237, 187, 38, 0.2);
  border: 1px solid #edbb26;
  border-radius: 12px;
  font-size: 13px;
  color: #fbd38d;
}
.reset-btn {
  padding: 8px 16px;
  background: rgba(245, 101, 101, 0.15);
  border: 1px solid #f56565;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
}

.convert-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.left-pane h3, .right-pane h3 { font-size: 16px; margin-bottom: 16px; color: #cbd5e0; }

.segment-list {
  max-height: 500px;
  overflow-y: auto;
  padding-right: 8px;
}
.segment-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}
.seg-time {
  font-family: 'SF Mono', monospace;
  color: #667eea;
  font-size: 12px;
  margin-bottom: 4px;
}
.seg-text { color: #cbd5e0; line-height: 1.4; }
.segment-more {
  padding: 12px;
  text-align: center;
  color: #a0aec0;
  font-size: 13px;
}

.target-formats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.target-btn {
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}
.target-btn:hover { border-color: rgba(102, 126, 234, 0.5); }
.target-btn.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.15);
}
.target-emoji { font-size: 20px; margin-bottom: 4px; }
.target-name { font-size: 13px; font-weight: 600; }
.target-software { font-size: 11px; color: #a0aec0; }

.convert-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 16px;
}
.convert-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.output-section {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
}
.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.output-title { color: #48bb78; font-size: 13px; font-weight: 600; }
.output-actions { display: flex; gap: 8px; }
.action-btn {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}
.output-preview {
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: #cbd5e0;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  margin: 0;
}
.error-msg {
  margin-top: 16px;
  padding: 12px;
  background: rgba(245, 101, 101, 0.1);
  border: 1px solid #f56565;
  border-radius: 8px;
  color: #feb2b2;
}
@media (max-width: 768px) {
  .convert-layout { grid-template-columns: 1fr; }
  .target-formats { grid-template-columns: repeat(2, 1fr); }
}
</style>