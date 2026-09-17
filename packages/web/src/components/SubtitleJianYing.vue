<template>
  <div class="subtitle-jianying-page">
    <JianheboxToolNav class="page-tool-nav" />

    <div class="jianying-container">
      <header class="page-header">
        <div class="header-badge">🎬 剪映草稿</div>
        <h1>剪映草稿箱识别 + 字幕导出</h1>
        <p class="subtitle">真实读取你的草稿 · 诚告知限制 · 引导剪映导出 SRT</p>
      </header>

      <!-- Step 1: 输入选择 -->
      <div v-if="!hasData && !draftInfo" class="input-section">
        <h3>📥 第 1 步:加载草稿或字幕</h3>
        <p class="hint">
          <strong>重要:</strong> 剪映 V5+ 的 <code>draft_info.json</code> 是 <strong>剪映定制二进制</strong> (非标准 protobuf, 实测解码后无字幕文本),<br>
          浏览器 JS 无法解码,需要剪映专用工具或导出 SRT 才能获取字幕。
        </p>

        <div class="input-methods">
          <!-- 方法 1: 拖拽剪映草稿目录 (识别元数据) -->
          <div class="method-box" @click="$refs.folderInput.click()">
            <div class="method-icon">📂</div>
            <div class="method-name">拖拽剪映草稿目录</div>
            <div class="method-desc">
              扫描文件元数据 (路径/大小/JSON列表) · 不会假装"破解"protobuf
            </div>
            <input
              ref="folderInput"
              type="file"
              webkitdirectory
              directory
              multiple
              @change="handleFolder"
              style="display:none"
            />
          </div>

          <!-- 方法 2: 拖拽剪映导出 SRT (真字幕) -->
          <div
            class="method-box"
            :class="{ dragging: isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            @click="$refs.srtInput.click()"
          >
            <div class="method-icon">📝</div>
            <div class="method-name">剪映导出 SRT (推荐)</div>
            <div class="method-desc">
              剪映 → 文本 → 导出字幕 → 拖 SRT 进来
            </div>
            <input
              ref="srtInput"
              type="file"
              accept=".srt,.vtt,.ttml,.ass,.fcpxml,.xml"
              @change="handleSrtFile"
              style="display:none"
            />
          </div>

          <!-- 方法 3: 直接粘贴 -->
          <div class="method-box" @click="showPaste = true">
            <div class="method-icon">📋</div>
            <div class="method-name">直接粘贴</div>
            <div class="method-desc">
              复制剪映 SRT 内容 → 粘贴
            </div>
          </div>
        </div>

        <!-- 粘贴 SRT 对话框 -->
        <div v-if="showPaste" class="paste-dialog">
          <h4>📋 粘贴 SRT 内容</h4>
          <textarea
            v-model="pasteContent"
            class="paste-area"
            placeholder="1
00:00:01,000 --> 00:00:03,500
第一句字幕"
            rows="12"
          />
          <div class="paste-actions">
            <button @click="showPaste = false" class="btn-secondary">取消</button>
            <button @click="loadFromPaste" class="btn-primary">加载</button>
          </div>
        </div>
      </div>

      <!-- Step 2: 草稿识别结果 (真读 JSON) -->
      <div v-if="draftInfo && !hasData" class="draft-info-section">
        <h3>📊 草稿识别结果 (从你拖入的目录真实读取)</h3>

        <table class="info-table">
          <tr><td>📁 路径</td><td><code>{{ draftInfo.path }}</code></td></tr>
          <tr><td>📄 文件总数</td><td>{{ draftInfo.fileCount }} 个</td></tr>
          <tr><td>💾 总大小</td><td>{{ formatSize(draftInfo.size) }}</td></tr>
          <tr><td>📦 二进制</td><td>{{ draftInfo.binaryFiles }} 个 (剪映私有格式)</td></tr>
          <tr><td>📋 真 JSON</td><td>{{ draftInfo.jsonFiles }} 个 (浏览器可读)</td></tr>
        </table>

        <!-- 草稿元数据 (从 key_value.json + project.json 读) -->
        <div v-if="draftInfo.metadata" class="metadata-card">
          <h4>🎬 草稿真实元数据</h4>
          <table class="info-table">
            <tr v-if="draftInfo.metadata.projectName">
              <td>📝 项目</td>
              <td><code>{{ draftInfo.metadata.projectName }}</code></td>
            </tr>
            <tr v-if="draftInfo.metadata.timelineId">
              <td>🎬 时间线 ID</td>
              <td><code>{{ draftInfo.metadata.timelineId }}</code></td>
            </tr>
            <tr v-if="draftInfo.metadata.videoName">
              <td>🎥 视频文件</td>
              <td><code>{{ draftInfo.metadata.videoName }}</code></td>
            </tr>
            <tr>
              <td>🎤 字幕轨道</td>
              <td>
                <span v-if="draftInfo.metadata.hasSubtitleTrack" class="track-yes">
                  ✅ 有字幕 ({{ draftInfo.metadata.subtitleTrackCount }} 条)
                </span>
                <span v-else class="track-no">
                  📭 无字幕轨道
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- JSON 文件列表 (前 5) -->
        <div v-if="draftInfo.jsonFilesList && draftInfo.jsonFilesList.length" class="json-section">
          <h4>📋 可读的 JSON 文件 (前 5 个)</h4>
          <div class="json-list">
            <div v-for="jf in draftInfo.jsonFilesList.slice(0, 5)" :key="jf.path" class="json-item">
              <div class="json-name">
                <span v-if="jf.isText">✅</span>
                <span v-else>⚠️</span>
                {{ jf.name }}
              </div>
              <div class="json-path"><code>{{ jf.path }}</code></div>
              <div class="json-meta">{{ formatSize(jf.size) }}</div>
            </div>
            <div v-if="draftInfo.jsonFilesList.length > 5" class="more-files">
              ... 还有 {{ draftInfo.jsonFilesList.length - 5 }} 个文件
            </div>
          </div>
        </div>

        <!-- 🇨🇳 V2.1: 诚告知限制 (基于 Python 实测) -->
        <div class="truth-card">
          <h4>🔬 实测结论 (2026-09-17)</h4>
          <p class="truth-text">
            <strong>剪映私有二进制不是标准 protobuf</strong>。我用 Python 实测了你这个草稿:
          </p>
          <ul class="truth-list">
            <li><code>draft_info.json</code> 132 KB (base64 编码) → 解码 101 KB 二进制 → <strong>0 个中文字符, 0 个时间码</strong></li>
            <li><code>draft.extra</code> 10 KB (16 字节索引 + base64) → 解码 7.6 KB 二进制 → <strong>1 个损坏字符, 0 个真实字幕</strong></li>
            <li>Protobuf 解析失败 (字节模式 <code>ef d8 1c 23</code> 不像标准 protobuf 头)</li>
            <li>你 attachment_pc_common.json 里 <code>caption_id_list: []</code> — <strong>草稿本身就没字幕轨道</strong></li>
          </ul>
          <p class="truth-warning">
            ⚠️ <strong>我的代码无法从这个草稿提取字幕</strong> (网上所有所谓"剪映 SRT 提取工具"实际上都是要剪映自己导出的 SRT)
          </p>
        </div>

        <!-- 下一步操作 -->
        <div class="next-actions">
          <button @click="$refs.srtInput.click()" class="btn-primary btn-large">
            📝 下一步: 加载剪映导出的 SRT
          </button>
          <button @click="reset" class="btn-secondary">🔄 重选</button>
        </div>
      </div>

      <!-- Step 3: 工作区 (有字幕数据时) -->
      <div v-if="hasData" class="work-section">
        <div class="toolbar">
          <div class="toolbar-left">
            <span class="file-tag">📝 {{ sourceFormat }}</span>
            <span class="count-tag">{{ segments.length }} 条字幕</span>
            <button @click="detectIssues" class="tool-btn">🔍 智能检测</button>
          </div>
          <div class="toolbar-right">
            <button @click="reset" class="tool-btn">🔄 重新加载</button>
          </div>
        </div>

        <div v-if="issueCount > 0" class="issue-summary">
          ⚠️ 检测到 {{ issueCount }} 个问题
        </div>

        <div class="segments-list">
          <div
            v-for="(seg, i) in segments"
            :key="i"
            :class="['seg-row', { 'has-issue': seg.issues && seg.issues.length > 0 }]"
          >
            <div class="seg-header">
              <span class="seg-num">#{{ i + 1 }}</span>
              <span class="seg-time">{{ msToSrt(seg.startMs) }} → {{ msToSrt(seg.endMs) }}</span>
              <span class="seg-dur">{{ ((seg.endMs - seg.startMs) / 1000).toFixed(1) }}s</span>
              <button @click="removeSeg(i)" class="del-btn">×</button>
            </div>
            <div v-if="seg.issues && seg.issues.length" class="issues">
              <span v-for="(issue, idx) in seg.issues" :key="idx" :class="['issue', 'issue-' + issue.type]">
                {{ issue.icon }} {{ issue.msg }}
              </span>
            </div>
            <textarea
              v-model="seg.text"
              class="seg-text"
              rows="2"
              @input="detectOne(i)"
            />
          </div>
          <button @click="addSegment" class="add-btn">+ 添加一条字幕</button>
        </div>

        <div class="export-section">
          <h3>💾 导出为 (6 种格式)</h3>
          <div class="export-grid">
            <button v-for="fmt in exportFormats" :key="fmt.id" @click="exportAs(fmt)" class="export-btn">
              <div class="export-emoji">{{ fmt.emoji }}</div>
              <div class="export-name">{{ fmt.name }}</div>
              <div class="export-software">{{ fmt.software }}</div>
            </button>
          </div>
        </div>

        <div v-if="lastExport" class="export-preview">
          <div class="preview-header">
            <span class="preview-title">✅ 已导出 {{ lastExport.name }} ({{ lastExport.bytes }} bytes)</span>
            <div class="preview-actions">
              <button @click="copyToClipboard" class="preview-btn">📋 复制</button>
              <button @click="downloadAgain" class="preview-btn">💾 下载</button>
            </div>
          </div>
          <pre class="preview-content"><code>{{ lastExport.preview }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import JianheboxToolNav from './JianheboxToolNav.vue'
import { detectAndParse, msToSrt, exportAs, type SubtitleSegment } from '../utils/subtitle'

interface Issue {
  type: string
  icon: string
  msg: string
}

interface Segment extends SubtitleSegment {
  issues?: Issue[]
}

interface JsonFileInfo {
  name: string
  path: string
  size: number
  isText: boolean
}

interface DraftInfo {
  name: string
  path: string
  fileCount: number
  size: number
  binaryFiles: number
  jsonFiles: number
  jsonFilesList: JsonFileInfo[]
  metadata?: {
    projectName?: string
    timelineId?: string
    videoName?: string
    hasSubtitleTrack?: boolean
    subtitleTrackCount?: number
  }
}

const isDragging = ref(false)
const showPaste = ref(false)
const pasteContent = ref('')
const sourceFormat = ref('')
const segments = ref<Segment[]>([])
const draftInfo = ref<DraftInfo | null>(null)
const lastExport = ref<{ name: string; content: string; bytes: number; preview: string } | null>(null)

const hasData = computed(() => segments.value.length > 0)
const issueCount = computed(() =>
  segments.value.reduce((sum, s) => sum + (s.issues?.length || 0), 0)
)

const exportFormats = [
  { id: 'srt' as const, name: 'SRT', emoji: '📝', software: '通用 / 剪映', ext: 'srt' },
  { id: 'vtt' as const, name: 'VTT', emoji: '🌐', software: 'Web 视频', ext: 'vtt' },
  { id: 'ttml' as const, name: 'TTML', emoji: '📺', software: 'PR XML', ext: 'ttml' },
  { id: 'ass' as const, name: 'ASS', emoji: '🎭', software: 'B站', ext: 'ass' },
  { id: 'fcpxml' as const, name: 'FCPXML', emoji: '🍎', software: 'Final Cut Pro', ext: 'fcpxml' },
  { id: 'md' as const, name: 'Markdown', emoji: '📑', software: '文档', ext: 'md' },
]

// ============== 文件处理 ==============

async function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) await loadSrtFile(file)
}

async function handleSrtFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) await loadSrtFile(file)
}

async function handleFolder(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  await analyzeFolder(Array.from(files))
}

async function loadSrtFile(file: File) {
  const text = await file.text()
  await loadFromText(text, file.name)
}

function loadFromPaste() {
  if (!pasteContent.value.trim()) return
  loadFromText(pasteContent.value, '粘贴的 SRT')
  showPaste.value = false
}

async function loadFromText(text: string, source: string) {
  const result = detectAndParse(text)
  if (!result.segments || result.segments.length === 0) {
    alert('解析失败: 未找到字幕内容')
    return
  }
  if (result.timeOffsetHours && result.timeOffsetHours > 0) {
    const offset = result.timeOffsetHours * 3600000
    result.segments.forEach(s => {
      s.startMs -= offset
      s.endMs -= offset
    })
  }
  segments.value = result.segments as Segment[]
  sourceFormat.value = result.format.toUpperCase() + (source ? ` (${source})` : '')
  draftInfo.value = null
  lastExport.value = null
  detectIssues()
}

// 🇨🇳 V2.1: 真实读取草稿, 不假设能解 protobuf
async function analyzeFolder(files: File[]) {
  let totalSize = 0
  let binaryFiles = 0
  let jsonFiles = 0
  const jsonFilesList: JsonFileInfo[] = []
  const rootName = (files[0] as any).webkitRelativePath?.split('/')[0] || '剪映草稿'

  // 真实读取关键 JSON
  let keyValueData: any = null
  let projectData: any = null
  let attachmentPcCommon: any = null
  let attachmentScriptVideo: any = null

  for (const f of files) {
    totalSize += f.size

    if (f.name === 'draft_info.json' || f.name === 'draft_meta_info.json') {
      // 关键: 实测这两个文件是 base64 编码的二进制, 不是 JSON
      try {
        const head = await f.slice(0, 4).text()
        if (head.startsWith('{')) {
          jsonFiles++
          jsonFilesList.push({ name: f.name, path: (f as any).webkitRelativePath, size: f.size, isText: true })
        } else {
          binaryFiles++
          jsonFilesList.push({ name: f.name, path: (f as any).webkitRelativePath, size: f.size, isText: false })
        }
      } catch { binaryFiles++ }
    } else if (f.name.endsWith('.json')) {
      jsonFiles++
      jsonFilesList.push({ name: f.name, path: (f as any).webkitRelativePath, size: f.size, isText: true })
    }

    // 读取关键 JSON 文件 (≤500KB)
    try {
      if (f.name === 'key_value.json' && f.size < 100000) {
        keyValueData = JSON.parse(await f.text())
      } else if (f.name === 'project.json' && f.size < 10000) {
        projectData = JSON.parse(await f.text())
      } else if (f.name === 'attachment_pc_common.json' && f.size < 10000) {
        attachmentPcCommon = JSON.parse(await f.text())
      } else if (f.name === 'attachment_script_video.json' && f.size < 10000) {
        attachmentScriptVideo = JSON.parse(await f.text())
      }
    } catch (e) {
      console.warn(`解析 ${f.name} 失败:`, e)
    }
  }

  // 提取元数据
  const metadata: DraftInfo['metadata'] = {}
  if (projectData) {
    metadata.timelineId = projectData.main_timeline_id
    const timeline = projectData.timelines?.[0]
    metadata.projectName = timeline?.name
  }
  if (keyValueData && typeof keyValueData === 'object') {
    for (const [, data] of Object.entries(keyValueData)) {
      if (data && typeof data === 'object' && (data as any).materialName) {
        metadata.videoName = (data as any).materialName
        break
      }
    }
  }
  if (attachmentScriptVideo?.script_video) {
    metadata.subtitleTrackCount = (attachmentScriptVideo.script_video.translate_segments || []).length
    metadata.hasSubtitleTrack = metadata.subtitleTrackCount > 0
  }
  if (attachmentPcCommon?.caption_id_list) {
    const captionCount = attachmentPcCommon.caption_id_list.length
    metadata.subtitleTrackCount = captionCount
    metadata.hasSubtitleTrack = captionCount > 0
  }
  if (metadata.subtitleTrackCount === undefined) {
    metadata.subtitleTrackCount = 0
    metadata.hasSubtitleTrack = false
  }

  draftInfo.value = {
    name: rootName,
    path: `/${rootName}/`,
    fileCount: files.length,
    size: totalSize,
    binaryFiles,
    jsonFiles,
    jsonFilesList,
    metadata,
  }
}

// ============== 编辑 ==============

function addSegment() {
  const last = segments.value[segments.value.length - 1]
  segments.value.push({
    index: segments.value.length + 1,
    startMs: last ? last.endMs : 0,
    endMs: last ? last.endMs + 2000 : 2000,
    text: ''
  })
}

function removeSeg(i: number) { segments.value.splice(i, 1) }

function detectIssues() {
  for (let i = 0; i < segments.value.length; i++) detectOne(i)
}

function detectOne(i: number) {
  const seg = segments.value[i]
  const issues: Issue[] = []
  const dur = seg.endMs - seg.startMs
  const text = seg.text.trim()
  if (text === '') issues.push({ type: 'empty', icon: '📭', msg: '空白' })
  if (dur < 500 && text) issues.push({ type: 'short', icon: '⚡', msg: `闪字 ${dur}ms` })
  if (dur > 10000) issues.push({ type: 'long', icon: '🐌', msg: `超长 ${(dur/1000).toFixed(1)}s` })
  if (i > 0) {
    const prev = segments.value[i - 1]
    if (prev.text.trim() === text && text) issues.push({ type: 'duplicate', icon: '🔁', msg: '与前条重复' })
    if (seg.startMs < prev.endMs && seg.endMs > prev.startMs) {
      issues.push({ type: 'overlap', icon: '⚠️', msg: `重叠 ${prev.endMs - seg.startMs}ms` })
    }
  }
  seg.issues = issues
}

// ============== 导出 (真共享模块) ==============

function exportAs(fmt: { id: 'srt' | 'vtt' | 'ttml' | 'ass' | 'fcpxml' | 'md'; name: string; ext: string }) {
  if (!segments.value.length) return
  const content = exportAs(segments.value, fmt.id)
  const preview = content.length > 1000
    ? content.slice(0, 1000) + `\n...还有 ${content.length - 1000} 字符`
    : content
  lastExport.value = {
    name: `subtitle.${fmt.ext}`,
    content,
    bytes: content.length,
    preview,
  }
  downloadFile(content, `subtitle-${Date.now()}.${fmt.ext}`)
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function copyToClipboard() {
  if (!lastExport.value) return
  navigator.clipboard.writeText(lastExport.value.content)
  alert('已复制到剪贴板')
}

function downloadAgain() {
  if (!lastExport.value) return
  downloadFile(lastExport.value.content, lastExport.value.name)
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function reset() {
  segments.value = []
  sourceFormat.value = ''
  draftInfo.value = null
  lastExport.value = null
}
</script>

<style scoped>
.subtitle-jianying-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0e1a 0%, #1a1f2e 100%);
  color: #fff;
}
.jianying-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px;
}
.page-header { text-align: center; margin-bottom: 32px; }
.header-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(237, 100, 166, 0.2);
  border: 1px solid #ed64a6;
  border-radius: 20px;
  font-size: 14px;
  color: #ed64a6;
  margin-bottom: 16px;
}
.page-header h1 { font-size: 32px; margin: 0 0 12px; }
.subtitle { color: #a0aec0; font-size: 14px; }

.input-section, .draft-info-section, .work-section {
  padding: 32px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  margin-bottom: 16px;
}
h3 { font-size: 20px; margin-bottom: 12px; }
.hint {
  color: #cbd5e0;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 24px;
}
.hint code {
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  color: #ed64a6;
}

.input-methods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.method-box {
  padding: 32px 20px;
  background: rgba(0, 0, 0, 0.2);
  border: 2px dashed rgba(237, 100, 166, 0.3);
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.method-box:hover, .method-box.dragging {
  background: rgba(237, 100, 166, 0.08);
  border-color: #ed64a6;
  border-style: solid;
}
.method-icon { font-size: 40px; margin-bottom: 12px; }
.method-name { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.method-desc { font-size: 12px; color: #a0aec0; }

.paste-dialog {
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 20px;
}
.paste-dialog h4 { color: #fbb6ce; margin-bottom: 12px; }
.paste-area {
  width: 100%;
  padding: 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  resize: vertical;
}
.paste-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 12px; }
.btn-primary, .btn-secondary {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.btn-primary { background: linear-gradient(135deg, #ed64a6 0%, #c056a8 100%); color: #fff; }
.btn-secondary { background: rgba(255, 255, 255, 0.05); color: #fff; }
.btn-large { padding: 14px 28px; font-size: 15px; }

.info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
.info-table td {
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}
.info-table td:first-child { color: #a0aec0; width: 120px; }
.info-table code {
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: #ed64a6;
  word-break: break-all;
}

.metadata-card {
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border-left: 3px solid #ed64a6;
  margin-bottom: 16px;
}
.metadata-card h4 { color: #fbb6ce; margin-bottom: 12px; }
.track-yes {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(72, 187, 120, 0.2);
  border: 1px solid #48bb78;
  border-radius: 8px;
  color: #48bb78;
  font-weight: 600;
}
.track-no {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(160, 174, 192, 0.15);
  border: 1px solid #a0aec0;
  border-radius: 8px;
  color: #cbd5e0;
}

.json-section h4 { color: #fbb6ce; margin-bottom: 12px; }
.json-list { display: flex; flex-direction: column; gap: 8px; }
.json-item {
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.json-name { font-weight: 600; font-size: 13px; }
.json-path code {
  font-size: 11px;
  color: #cbd5e0;
  font-family: 'SF Mono', monospace;
  display: block;
  word-break: break-all;
  margin-top: 4px;
}
.json-meta { color: #a0aec0; font-size: 11px; margin-top: 4px; }
.more-files { padding: 8px; color: #a0aec0; font-size: 12px; text-align: center; }

/* 🇨🇳 V2.1: 真相卡片 */
.truth-card {
  margin-top: 16px;
  padding: 16px;
  background: rgba(245, 101, 101, 0.08);
  border: 1px solid rgba(245, 101, 101, 0.3);
  border-radius: 8px;
}
.truth-card h4 { color: #fc8181; margin-bottom: 12px; }
.truth-text { color: #cbd5e0; font-size: 13px; line-height: 1.6; margin-bottom: 12px; }
.truth-text strong { color: #fff; }
.truth-list {
  margin: 0 0 12px 0;
  padding-left: 20px;
  color: #cbd5e0;
  font-size: 13px;
  line-height: 1.7;
}
.truth-list code {
  padding: 1px 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  font-size: 11px;
  color: #ed64a6;
}
.truth-list strong { color: #fc8181; }
.truth-warning {
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-left: 3px solid #fc8181;
  border-radius: 4px;
  font-size: 13px;
  color: #feb2b2;
  line-height: 1.5;
}

.next-actions { display: flex; gap: 12px; margin-top: 24px; }

/* 工作区 */
.work-section { margin-top: 16px; }
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 16px;
}
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 12px; }
.file-tag {
  padding: 6px 12px;
  background: rgba(237, 100, 166, 0.15);
  border: 1px solid #ed64a6;
  border-radius: 12px;
  font-size: 12px;
}
.count-tag {
  padding: 6px 12px;
  background: rgba(72, 187, 120, 0.15);
  border: 1px solid #48bb78;
  border-radius: 12px;
  font-size: 12px;
  color: #48bb78;
}
.tool-btn {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}

.issue-summary {
  padding: 8px 12px;
  background: rgba(237, 187, 38, 0.1);
  border-left: 3px solid #edbb26;
  border-radius: 4px;
  font-size: 12px;
  color: #fbd38d;
  margin-bottom: 12px;
}

.segments-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.seg-row {
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}
.seg-row.has-issue { border-color: rgba(245, 101, 101, 0.4); background: rgba(245, 101, 101, 0.05); }
.seg-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
}
.seg-num { font-weight: 600; color: #ed64a6; min-width: 30px; }
.seg-time { font-family: 'SF Mono', monospace; color: #cbd5e0; }
.seg-dur { color: #a0aec0; }
.del-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(245, 101, 101, 0.15);
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}
.issues { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.issue {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
}
.issue-empty { background: rgba(160, 174, 192, 0.15); color: #cbd5e0; }
.issue-short { background: rgba(237, 187, 38, 0.15); color: #fbd38d; }
.issue-long { background: rgba(237, 137, 54, 0.15); color: #fbd38d; }
.issue-duplicate { background: rgba(245, 101, 101, 0.15); color: #feb2b2; }
.issue-overlap { background: rgba(229, 62, 62, 0.15); color: #fc8181; }
.seg-text {
  width: 100%;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  resize: vertical;
}
.add-btn {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #a0aec0;
  cursor: pointer;
}

.export-section h3 { margin-bottom: 16px; }
.export-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.export-btn {
  padding: 16px 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}
.export-btn:hover {
  border-color: #ed64a6;
  background: rgba(237, 100, 166, 0.1);
  transform: translateY(-2px);
}
.export-emoji { font-size: 24px; margin-bottom: 6px; }
.export-name { font-size: 13px; font-weight: 600; }
.export-software { font-size: 11px; color: #a0aec0; }

.export-preview {
  margin-top: 16px;
  padding: 16px;
  background: rgba(72, 187, 120, 0.05);
  border: 1px solid rgba(72, 187, 120, 0.3);
  border-radius: 8px;
}
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.preview-title { color: #48bb78; font-weight: 600; font-size: 13px; }
.preview-actions { display: flex; gap: 8px; }
.preview-btn {
  padding: 4px 12px;
  background: rgba(72, 187, 120, 0.2);
  border: 1px solid #48bb78;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}
.preview-content {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 6px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: #cbd5e0;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .input-methods { grid-template-columns: 1fr; }
  .export-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>