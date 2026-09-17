<template>
  <div class="subtitle-edit-page">
    <JianheboxToolNav class="page-tool-nav" />

    <div class="edit-container">
      <header class="page-header">
        <div class="header-badge">✏️ 字幕编辑器</div>
        <h1>在线编辑 + 智能检测</h1>
        <p class="subtitle">错别字 · 空白行 · 闪字 · 时长异常 · 一键修复</p>
      </header>

      <!-- 工具栏 -->
      <div class="toolbar-section">
        <button @click="$refs.fileInput.click()" class="tool-btn">📁 打开字幕</button>
        <input ref="fileInput" type="file" accept=".srt,.vtt,.ttml,.ass,.fcpxml,.xml" @change="loadFile" style="display:none" />
        <button @click="detectIssues" class="tool-btn tool-btn-primary">🔍 智能检测</button>
        <button @click="downloadEdits" class="tool-btn" :disabled="!segments.length">💾 保存 SRT</button>
        <button @click="reset" class="tool-btn" :disabled="!segments.length">🔄 清空</button>
        <span class="stats">{{ segments.length }} 条 · {{ issueCount }} 个问题</span>
      </div>

      <!-- 检测配置 -->
      <div class="detection-config">
        <label><input type="checkbox" v-model="detectors.duplicate" /> 🔁 重复字</label>
        <label><input type="checkbox" v-model="detectors.empty" /> 📭 空白行</label>
        <label><input type="checkbox" v-model="detectors.shortDuration" /> ⚡ 闪字 (&lt;500ms)</label>
        <label><input type="checkbox" v-model="detectors.longDuration" /> 🐌 超长 (&gt;10s)</label>
        <label><input type="checkbox" v-model="detectors.overlap" /> ⚠️ 时间重叠</label>
      </div>

      <!-- 字幕列表 -->
      <div class="segments-list">
        <div v-if="segments.length === 0" class="empty-state">
          打开字幕文件开始 · 支持 SRT/VTT/TTML/ASS/FCPXML
        </div>
        <div
          v-for="(seg, i) in segments"
          :key="i"
          :class="['segment-row', { 'has-issue': seg.issues && seg.issues.length > 0 }]"
        >
          <div class="row-header">
            <span class="seg-index">#{{ i + 1 }}</span>
            <span class="seg-time">{{ msToSrt(seg.startMs) }} → {{ msToSrt(seg.endMs) }}</span>
            <span class="seg-duration">{{ ((seg.endMs - seg.startMs) / 1000).toFixed(2) }}s</span>
            <span v-if="seg.issues && seg.issues.length" class="issue-badge">
              {{ seg.issues.length }} 个问题
            </span>
            <button @click="removeSeg(i)" class="delete-btn">×</button>
          </div>

          <!-- 问题列表 -->
          <div v-if="seg.issues && seg.issues.length" class="issues">
            <div v-for="(issue, idx) in seg.issues" :key="idx" :class="['issue', 'issue-' + issue.type]">
              <span class="issue-icon">{{ issue.icon }}</span>
              <span class="issue-text">{{ issue.msg }}</span>
              <button v-if="issue.fix" @click="applyFix(i, idx)" class="fix-btn">{{ issue.fixLabel || '修复' }}</button>
            </div>
          </div>

          <textarea
            v-model="seg.text"
            class="text-area"
            rows="2"
            @input="detectOne(i)"
          />
        </div>

        <button v-if="segments.length" @click="addSegment" class="add-btn">+ 添加一条</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import JianheboxToolNav from './JianheboxToolNav.vue'
import { detectAndParse, msToSrt, toSrt, type SubtitleSegment } from '../utils/subtitle'

interface Issue {
  type: string
  icon: string
  msg: string
  fix?: () => void
  fixLabel?: string
}

interface Segment extends SubtitleSegment {
  issues?: Issue[]
}

const segments = ref<Segment[]>([])
const detectors = ref({
  duplicate: true,
  empty: true,
  shortDuration: true,
  longDuration: true,
  overlap: true,
})

const issueCount = computed(() =>
  segments.value.reduce((sum, s) => sum + (s.issues?.length || 0), 0)
)

async function loadFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const start = performance.now()
  const text = await file.text()
  const result = detectAndParse(text)
  if (result.timeOffsetHours && result.timeOffsetHours > 0) {
    const offset = result.timeOffsetHours * 3600000
    result.segments.forEach(s => { s.startMs -= offset; s.endMs -= offset })
  }
  segments.value = result.segments as Segment[]
  console.log(`[编辑器] 加载 ${result.format}, ${result.segments.length} 条, ${Math.round(performance.now()-start)}ms`)
  detectIssues()
}

function addSegment() {
  const last = segments.value[segments.value.length - 1]
  segments.value.push({
    index: segments.value.length + 1,
    startMs: last ? last.endMs : 0,
    endMs: last ? last.endMs + 2000 : 2000,
    text: ''
  })
}

function removeSeg(i: number) {
  segments.value.splice(i, 1)
}

function detectIssues() {
  for (let i = 0; i < segments.value.length; i++) {
    detectOne(i)
  }
}

function detectOne(i: number) {
  const seg = segments.value[i]
  const issues: Issue[] = []
  const dur = seg.endMs - seg.startMs
  const text = seg.text.trim()

  if (detectors.value.empty && text === '') {
    issues.push({ type: 'empty', icon: '📭', msg: '空白行' })
  }
  if (detectors.value.shortDuration && dur < 500 && text !== '') {
    issues.push({ type: 'short', icon: '⚡', msg: `闪字 (${dur}ms < 500ms)` })
  }
  if (detectors.value.longDuration && dur > 10000) {
    issues.push({ type: 'long', icon: '🐌', msg: `超长 (${(dur/1000).toFixed(1)}s > 10s)` })
  }

  if (detectors.value.duplicate && i > 0) {
    const prev = segments.value[i - 1].text.trim()
    if (prev === text && text !== '') {
      issues.push({ type: 'duplicate', icon: '🔁', msg: '与前一条完全重复' })
    }
  }

  if (detectors.value.overlap && i > 0) {
    const prev = segments.value[i - 1]
    if (seg.startMs < prev.endMs && seg.endMs > prev.startMs) {
      issues.push({ type: 'overlap', icon: '⚠️', msg: `与 #${i} 重叠 ${prev.endMs - seg.startMs}ms` })
    }
  }

  seg.issues = issues
}

function applyFix(i: number, issueIdx: number) {
  const issue = segments.value[i].issues?.[issueIdx]
  if (issue?.fix) {
    issue.fix()
    detectOne(i)
  }
}

function downloadEdits() {
  const text = toSrt(segments.value)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `subtitle-edited-${Date.now()}.srt`
  a.click()
  URL.revokeObjectURL(url)
}

function reset() {
  segments.value = []
}
</script>

<style scoped>
.subtitle-edit-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0e1a 0%, #1a1f2e 100%);
  color: #fff;
}
.edit-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px;
}
.page-header { text-align: center; margin-bottom: 32px; }
.header-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(72, 187, 120, 0.2);
  border: 1px solid #48bb78;
  border-radius: 20px;
  font-size: 14px;
  color: #48bb78;
  margin-bottom: 16px;
}
.page-header h1 { font-size: 32px; margin: 0 0 12px; }
.subtitle { color: #a0aec0; }

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.tool-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.tool-btn:hover:not(:disabled) { background: rgba(102, 126, 234, 0.1); }
.tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tool-btn-primary { background: rgba(102, 126, 234, 0.2); border-color: #667eea; }
.stats { margin-left: auto; color: #a0aec0; font-size: 13px; }

.detection-config {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  margin-bottom: 16px;
}
.detection-config label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #cbd5e0;
  cursor: pointer;
}

.segments-list { display: flex; flex-direction: column; gap: 12px; }
.empty-state {
  padding: 60px;
  text-align: center;
  color: #a0aec0;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.segment-row {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
.segment-row.has-issue {
  border-color: rgba(245, 101, 101, 0.4);
  background: rgba(245, 101, 101, 0.05);
}
.row-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.seg-index { color: #667eea; font-weight: 600; }
.seg-time { font-family: 'SF Mono', monospace; color: #cbd5e0; font-size: 12px; }
.seg-duration { font-size: 12px; color: #a0aec0; margin-left: 8px; }
.issue-badge {
  margin-left: auto;
  padding: 2px 8px;
  background: rgba(245, 101, 101, 0.2);
  color: #feb2b2;
  border-radius: 8px;
  font-size: 11px;
}
.delete-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(245, 101, 101, 0.1);
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}
.issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.issue {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
}
.issue-empty { background: rgba(160, 174, 192, 0.15); color: #cbd5e0; }
.issue-short { background: rgba(237, 187, 38, 0.15); color: #fbd38d; }
.issue-long { background: rgba(237, 137, 54, 0.15); color: #fbd38d; }
.issue-duplicate { background: rgba(245, 101, 101, 0.15); color: #feb2b2; }
.issue-overlap { background: rgba(229, 62, 62, 0.15); color: #fc8181; }
.fix-btn {
  margin-left: auto;
  padding: 2px 10px;
  background: rgba(72, 187, 120, 0.2);
  border: 1px solid #48bb78;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 11px;
}
.text-area {
  width: 100%;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
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
.add-btn:hover { color: #667eea; border-color: #667eea; }
</style>