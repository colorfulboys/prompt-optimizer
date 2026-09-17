<template>
  <div class="fcpxml-page">
    <!-- 🇨🇳 2026-08-31 M3.9 R30:JianheboxToolNav 跟其它页一致,直接放在 fcpxml-page 顶部 -->
    <div class="fcpxml-tool-nav-wrap">
      <JianheboxToolNav class="fcpxml-tool-nav" />
    </div>

    <div class="fcpxml-container">
    <!-- 顶部头部 -->
    <header class="page-header">
      <div class="header-badge">🎬 {{ t("tools.fcpxml.name") }}</div>
      <h1>FCPXML ⇄ SRT / Word / Markdown</h1>
      <p class="subtitle">{{ t("tools.fcpxml.desc") }}</p>
    </header>

    <!-- 标签页 -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab', { active: currentTab === tab.id }]"
        @click="switchTab(tab.id)"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
        <span v-if="(tab.id === 'fcpxml-to') && parsedSegments.length > 0" class="tab-badge">{{ parsedSegments.length }}</span>
        <span v-if="(tab.id === 'srt-to') && parsedSrt && parsedSrt.length > 0" class="tab-badge">{{ parsedSrt.length }}</span>
      </button>
    </div>

    <!-- 通用：文件上传区 -->
    <div v-if="needsUpload" class="upload-zone">
      <div
        class="drop-area"
        :class="{ dragging: isDragging, processing: isProcessing }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="$refs.fileInput.click()"
      >
        <div class="drop-icon">{{ isProcessing ? '⏳' : '📁' }}</div>
        <div class="drop-text">{{ dropText }}</div>
        <div class="drop-sub">{{ dropSubText }}</div>
        <input
          ref="fileInput"
          type="file"
          :accept="acceptTypes"
          @change="handleFileSelect"
          style="display: none"
        />
      </div>
      <div class="upload-tip">
        支持格式: <code>{{ acceptedFormatText }}</code>
        <span v-if="statusMsg" class="status" :class="statusType">· {{ statusMsg }}</span>
      </div>
      <!-- mac fcpxmld 用户提示 -->
      <div v-if="currentTab === 'fcpxml-to'" class="fcpxmld-hint">
        💡 <strong>Mac 用户:</strong> 如果 .fcpxmld 上传失败,在 Finder 右键点击该文件 → 选择"压缩" → 生成 .zip 后再上传
      </div>
    </div>

    <!-- FCPXML → 多格式输出 -->
    <div v-if="currentTab === 'fcpxml-to'" class="result-zone">
      <div v-if="parsedSegments.length === 0" class="empty-state">
        上传 FCPXML 文件开始转换
      </div>
      <div v-else>
        <!-- 角色过滤(动态收集,显示每种角色的中文名) -->
        <div class="control-row">
          <label>角色过滤:</label>
          <select v-model="roleFilter" class="select">
            <option value="all">全部({{ uniqueRoles.length }} 种角色 / {{ parsedSegments.length }} 条)</option>
            <option v-for="r in uniqueRoles" :key="r" :value="r">{{ r }}</option>
          </select>
          <span class="count">{{ filteredSegments.length }} 条</span>
        </div>

        <!-- 预览时间线(可编辑 · 2026-08-28 加 · 与 SRT→FCPXML tab 共用同一套编辑 UI) -->
        <div class="timeline">
          <template v-for="(seg, i) in filteredSegments" :key="i">
          <div
            v-show="matchesFcpxmlSearch(i)"
            class="timeline-item editable"
            :class="{ 'has-error': getFcpxmlSegError(i) }"
          >
            <span class="seg-index">#{{ i + 1 }}</span>
            <input
              class="time-input"
              :value="fmtTime(seg.start)"
              @change="updateFcpxmlSegStart(i, ($event.target as HTMLInputElement).value)"
              title="开始时间（格式 00:00:00,000）"
              placeholder="00:00:00,000"
            />
            <span class="time-arrow">→</span>
            <input
              class="time-input"
              :value="fmtTime(seg.end)"
              @change="updateFcpxmlSegEnd(i, ($event.target as HTMLInputElement).value)"
              title="结束时间（格式 00:00:00,000）"
              placeholder="00:00:00,000"
            />
            <input
              class="text-input"
              :value="seg.text"
              @change="updateFcpxmlSegText(i, ($event.target as HTMLInputElement).value)"
              title="字幕文字（直接修改）"
              placeholder="字幕文字..."
            />
            <div class="seg-actions">
              <button class="ico-btn" @click="shiftFcpxmlSeg(i, -0.1)" title="整条前移 0.1 秒">⏪</button>
              <button class="ico-btn" @click="shiftFcpxmlSeg(i, +0.1)" title="整条后移 0.1 秒">⏩</button>
              <button class="ico-btn" @click="extendFcpxmlSeg(i, +0.5)" title="结束时间 +0.5 秒">➕</button>
              <button class="ico-btn" @click="extendFcpxmlSeg(i, -0.5)" title="结束时间 -0.5 秒">➖</button>
              <button class="ico-btn" @click="moveFcpxmlSeg(i, -1)" :disabled="i === 0" title="上移">⬆️</button>
              <button class="ico-btn" @click="moveFcpxmlSeg(i, +1)" :disabled="i === filteredSegments.length - 1" title="下移">⬇️</button>
              <button class="ico-btn" @click="mergeFcpxmlNext(i)" :disabled="i === filteredSegments.length - 1" title="与下一条合并">🔗</button>
              <button class="ico-btn danger" @click="deleteFcpxmlSeg(i)" title="删除此条">🗑️</button>
            </div>
          </div>
          </template>
          <div class="add-row">
            <button class="btn" @click="addFcpxmlSeg">➕ 在末尾添加一行</button>
          </div>
        </div>

        <!-- 工具栏:搜索 + 批量调时 + 计数 -->
        <div class="control-row">
          <label>🔍 搜索:</label>
          <input v-model="searchText" class="time-input search" placeholder="输入关键词筛选..." />
          <button class="btn" @click="bulkFcpxmlShift(-0.1)" title="全部字幕前移 0.1 秒">⏪ 全部 -0.1s</button>
          <button class="btn" @click="bulkFcpxmlShift(+0.1)" title="全部字幕后移 0.1 秒">⏩ 全部 +0.1s</button>
          <span class="count" v-if="fcpxmlModifiedCount > 0" style="color: #ea580c; font-weight: 600;">✏️ 已修改 {{ fcpxmlModifiedCount }} 处</span>
        </div>

        <!-- 输出选项:3 种格式(从 FCPXML 转,不需要再下载 FCPXML) -->
        <div class="output-section">
          <div class="output-label">下载格式:</div>
          <div class="output-actions output-grid">
            <button @click="exportSrt" class="btn btn-primary">📥 下载 SRT</button>
            <button @click="exportMarkdown" class="btn">📥 下载 Markdown</button>
            <button @click="exportWord" class="btn">📥 下载 Word</button>
            <button @click="resetAll" class="btn btn-ghost">↻ 重置</button>
          </div>
          <label class="opt-checkbox">
            <input type="checkbox" v-model="includeTimestamp" />
            <span>下载 Word/Markdown 时包含时间码（取消勾选则只导出纯文本）</span>
          </label>
          <div class="format-help">
            ℹ️ 从 FCPXML 转出的字幕,文本内容已包含时间码。如需 FCPXML 编辑请回到原始项目。
          </div>
        </div>
      </div>
    </div>

    <!-- SRT → FCPXML / FCPXMLD / Word / Markdown -->
    <div v-if="currentTab === 'srt-to'" class="result-zone">
      <div v-if="!parsedSrt" class="empty-state">
        上传 SRT 文件开始转换
      </div>
      <div v-else>
        <!-- 目标帧率(SRT 不带帧率,需要客户选,默认 25fps 中国 PAL 标准) -->
        <div class="control-row">
          <label>目标帧率:</label>
          <select v-model="targetFps" class="select">
            <option value="25">25 fps(中国 PAL 标准,1080p25/50)</option>
            <option value="30">30 fps(NTSC 标准,1080p30/60)</option>
            <option value="50">50 fps(高帧率,中国 1080p50 项目)</option>
            <option value="60">60 fps(高帧率,游戏/体育)</option>
            <option value="24">24 fps(电影标准)</option>
          </select>
          <label>📦 FCPXML 版本:</label>
          <select v-model="fcpxmlVersion" class="time-input" style="width: 200px;">
            <option value="1.14">v1.14 (FCPX 12)</option>
            <option value="1.13">v1.13 (FCPX 11)</option>
            <option value="1.10">v1.10 (FCPX 10.4 ~ 11 兼容)</option>
          </select>
          <span class="count">SRT 共 {{ parsedSrt.length }} 条</span>
        </div>

        <!-- 批量替换工具(简盒 8-29 加：达芬奇 SRT 输出带 <b> 等 HTML 标签，FCPX 导入字号会变小，先批量清掉) -->
        <div class="control-row batch-replace-row">
          <label>✏️ 批量替换:</label>
          <input
            v-model="batchFind"
            class="time-input search"
            placeholder="查找(如 &lt;b&gt;)"
          />
          <span style="opacity:.6;">→</span>
          <input
            v-model="batchReplace"
            class="time-input search"
            placeholder="替换为(留空 = 删除)"
          />
          <label class="regex-toggle">
            <input v-model="batchUseRegex" type="checkbox" />
            正则
          </label>
          <button class="btn btn-primary" @click="applyBatchReplace" :disabled="!batchFind">
            🎯 全部替换
          </button>
          <button class="btn" @click="showPresetMenu = !showPresetMenu" type="button">
            ⚡ 预设清理 ▼
          </button>
          <span v-if="batchReplaceCount > 0" style="color:#22c55e; font-weight:600;">
            ✓ 已替换 {{ batchReplaceCount }} 处
          </span>
        </div>
        <!-- 预设清理下拉菜单 -->
        <div v-if="showPresetMenu" class="preset-menu">
          <div class="preset-menu-title">常见字幕清理规则（点一下直接应用）</div>
          <button class="preset-item" @click="applyPreset('strip-html')">
            🧹 去除所有 HTML 标签（&lt;b&gt;&lt;i&gt;&lt;u&gt;&lt;font&gt; 等）
          </button>
          <button class="preset-item" @click="applyPreset('strip-davinci')">
            🎬 清理达芬奇 SRT 残留（&lt;b&gt;&lt;/b&gt; + 时间戳 [00:00] + 说话人 [Speaker:]）
          </button>
          <button class="preset-item" @click="applyPreset('strip-emotion')">
            😶 清理情感标记（[笑][叹气][旁白]）
          </button>
          <button class="preset-item" @click="applyPreset('strip-newline')">
            📏 合并多行字幕为单行（去掉换行）
          </button>
          <button class="preset-item" @click="applyPreset('trim-space')">
            ✂️ 清理首尾空白 + 多余空行
          </button>
        </div>

        <!-- SRT 预览(可编辑 · 2026-08-28 加) -->
        <div class="control-row">
          <label>SRT 预览(共 {{ parsedSrt.length }} 条,直接点击修改):</label>
        </div>
        <div class="timeline">
          <template v-for="(seg, i) in parsedSrt" :key="i">
          <div
            v-show="matchesSearch(i)"
            class="timeline-item editable"
            :class="{ 'has-error': getSegError(i) }"
          >
            <span class="seg-index">#{{ i + 1 }}</span>
            <input
              class="time-input"
              :value="fmtTime(seg.start)"
              @change="updateSegStart(i, ($event.target as HTMLInputElement).value)"
              title="开始时间（格式 00:00:00,000）"
              placeholder="00:00:00,000"
            />
            <span class="time-arrow">→</span>
            <input
              class="time-input"
              :value="fmtTime(seg.end)"
              @change="updateSegEnd(i, ($event.target as HTMLInputElement).value)"
              title="结束时间（格式 00:00:00,000）"
              placeholder="00:00:00,000"
            />
            <input
              class="text-input"
              :value="seg.text"
              @change="updateSegText(i, ($event.target as HTMLInputElement).value)"
              title="字幕文字（直接修改）"
              placeholder="字幕文字..."
            />
            <div class="seg-actions">
              <button class="ico-btn" @click="shiftSeg(i, -0.1)" title="整条前移 0.1 秒">⏪</button>
              <button class="ico-btn" @click="shiftSeg(i, +0.1)" title="整条后移 0.1 秒">⏩</button>
              <button class="ico-btn" @click="extendSeg(i, +0.5)" title="结束时间 +0.5 秒">➕</button>
              <button class="ico-btn" @click="extendSeg(i, -0.5)" title="结束时间 -0.5 秒">➖</button>
              <button class="ico-btn" @click="moveSeg(i, -1)" :disabled="i === 0" title="上移">⬆️</button>
              <button class="ico-btn" @click="moveSeg(i, +1)" :disabled="i === parsedSrt.length - 1" title="下移">⬇️</button>
              <button class="ico-btn" @click="mergeNext(i)" :disabled="i === parsedSrt.length - 1" title="与下一条合并">🔗</button>
              <button class="ico-btn danger" @click="deleteSeg(i)" title="删除此条">🗑️</button>
            </div>
          </div>
          </template>
          <div class="add-row">
            <button class="btn" @click="addSeg" v-if="parsedSrt">➕ 在末尾添加一行</button>
          </div>
        </div>

        <!-- 工具栏:搜索 + 批量调时 + 计数 -->
        <div class="control-row">
          <label>🔍 搜索:</label>
          <input v-model="searchText" class="time-input search" placeholder="输入关键词筛选..." />
          <button class="btn" @click="bulkShift(-0.1)" title="全部字幕前移 0.1 秒">⏪ 全部 -0.1s</button>
          <button class="btn" @click="bulkShift(+0.1)" title="全部字幕后移 0.1 秒">⏩ 全部 +0.1s</button>
          <span class="count" v-if="modifiedCount > 0" style="color: #ea580c; font-weight: 600;">✏️ 已修改 {{ modifiedCount }} 处</span>
        </div>

        <!-- 输出格式选择 -->
        <div class="output-section">
          <div class="output-label">下载格式:</div>
          <div class="output-actions output-grid">
            <button @click="exportFcpxml" class="btn btn-primary">📥 下载 FCPXML</button>
            <button
              @click="exportFcpxmldFromSrt"
              class="btn"
              :disabled="fcpxmlVersion !== '1.14'"
              :title="fcpxmlVersion !== '1.14' ? 'FCPXMLD 仅支持 FCPX 12,请选 v1.14' : ''"
            >📥 下载 FCPXMLD {{ fcpxmlVersion !== '1.14' ? '(需 FCPX 12)' : '' }}</button>
            <button @click="exportSrtAsDoc" class="btn">📥 下载 Word</button>
            <button @click="exportSrtAsMd" class="btn">📥 下载 Markdown</button>
            <button @click="resetAll" class="btn btn-ghost">↻ 重置</button>
          </div>
          <label class="opt-checkbox">
            <input type="checkbox" v-model="includeTimestamp" />
            <span>下载 Word/Markdown 时包含时间码（取消勾选则只导出纯文本）</span>
          </label>
          <div class="format-help">
            <strong>.fcpxml</strong> = 单文件 XML,FCPX 11/12 都能导入<br>
            <strong>.fcpxmld</strong> = 下载是 zip,双击解压后把文件夹改名为 xxx.fcpxmld,拖入 FCPX 12 即可<br>
            ℹ️ 输出样式:白字 + 黑色描边 + 居中(Arial 60pt),导入 FCPX 后可在右侧检查器调整
          </div>
        </div>
      </div>
    </div>

    <!-- SEO 内容区(美化排版,删掉"使用场景"3 行) -->
    <section class="seo-content">
      <div class="seo-card">
        <h2>🎬 这是什么工具?</h2>
        <p>
          <strong>FCPXML 字幕互转</strong>是专门为 Final Cut Pro X / Pro 用户设计的字幕格式转换工具。
          解决 Adobe Premiere / DaVinci Resolve / 其他剪辑软件做好的字幕无法导入 FCPX 的痛点,
          以及 FCPX 完成的字幕无法与他人共享(剪映、PR、达芬奇都不认 FCPXML)。
        </p>
      </div>

      <div class="seo-card">
        <h3>📌 核心功能</h3>
        <div class="feature-grid">
          <div class="feature">
            <div class="feature-icon">🔄</div>
            <div class="feature-text">
              <strong>FCPXML → SRT</strong>
              <p>从 FCPX 导出的 XML 提取字幕轨,生成标准 SRT 字幕(兼容所有剪辑软件)</p>
            </div>
          </div>
          <div class="feature">
            <div class="feature-icon">📄</div>
            <div class="feature-text">
              <strong>FCPXML → Word / Markdown</strong>
              <p>把 FCPX 字幕导出为可读文档,方便校对、审阅、存档</p>
            </div>
          </div>
          <div class="feature">
            <div class="feature-icon">📥</div>
            <div class="feature-text">
              <strong>SRT → FCPXML</strong>
              <p>把外部 SRT 字幕(剪映/达芬奇导出)转成 FCPXML,直接拖进 FCPX</p>
            </div>
          </div>
          <div class="feature">
            <div class="feature-icon">🎯</div>
            <div class="feature-text">
              <strong>角色过滤</strong>
              <p>自动识别"口播"vs"字幕"两条轨,可单独提取</p>
            </div>
          </div>
        </div>
      </div>

      <div class="seo-card privacy-card">
        <h3>🔒 隐私</h3>
        <p>所有处理在浏览器本地完成,<strong>你的项目文件不上传任何服务器</strong>。FCP 项目通常保密性强,本工具完全消除数据泄露风险。</p>
      </div>
    </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
// 简盒 FCPXML 字幕互转工具
import JianheboxToolNav from "./JianheboxToolNav.vue";
// ...其余 import 保持原样

import { ref, computed } from 'vue'
import JSZip from 'jszip'

// ============ 状态 ============
const currentTab = ref<'fcpxml-to' | 'srt-to'>('fcpxml-to')
const isDragging = ref(false)
const isProcessing = ref(false)
const statusMsg = ref('')
const statusType = ref<'ok' | 'err' | 'info'>('info')

const parsedSegments = ref<Array<{ start: number; end: number; text: string; role?: string; displayRole?: string; spineOrder: number }>>([])
const parsedSrt = ref<Array<{ start: number; end: number; text: string; originalText?: string; originalStart?: number; originalEnd?: number }> | null>(null)
const searchText = ref<string>('')

// 批量替换（简盒 8-29 加：处理达芬奇 SRT 的 <b> 等 HTML 标签，FCPX 导入后字会变小）
const batchFind = ref<string>('')
const batchReplace = ref<string>('')
const batchUseRegex = ref<boolean>(false)
const batchReplaceCount = ref<number>(0)
const showPresetMenu = ref<boolean>(false)

const roleFilter = ref<string>('all')  // 'all' 或某个 displayRole

// SRT → FCPXML 的目标帧率(默认 50fps,匹配中国 1080p50 项目)
// 也可以选 25/30/24/60,根据目标 FCPX 项目帧率
const targetFps = ref<number>(50)

// FCPXML DTD 版本(简盒 8-29 加：v1.14 仅 FCPX 12 认；v1.10 老/新都认；v1.5 仅老版)
const fcpxmlVersion = ref<string>('1.14')

// 🇨🇳 2026-09-01 简盒 R37 需求1:下载 Word/TXT 时可勾选"带/不带时间码"
const includeTimestamp = ref<boolean>(true)

// ============ 标签页配置 ============
const tabs = [
  { id: 'fcpxml-to' as const, icon: '▶', label: 'FCPXML 转 SRT/Word' },
  { id: 'srt-to' as const, icon: '▶', label: 'SRT 转 FCPXML' }
]

const needsUpload = computed(() => {
  if (currentTab.value === 'fcpxml-to') return parsedSegments.value.length === 0
  if (currentTab.value === 'srt-to') return !parsedSrt.value
  return false
})

const acceptTypes = computed(() => {
  return currentTab.value === 'fcpxml-to'
    ? '.xml,.fcpxml,.fcpxmld,application/zip,application/x-zip-compressed'
    : '.srt,text/plain'
})

const acceptedFormatText = computed(() => {
  return currentTab.value === 'fcpxml-to'
    ? 'FCPXML (.xml / .fcpxml; .fcpxmld 自动解压取 Info.fcpxml)'
    : 'SRT (.srt)'
})

const dropText = computed(() => {
  if (isProcessing.value) return '正在解析...'
  return currentTab.value === 'fcpxml-to'
    ? '拖入 FCPXML 文件,或点击选择'
    : '拖入 SRT 文件,或点击选择'
})

const dropSubText = computed(() => {
  return currentTab.value === 'fcpxml-to'
    ? '支持 FCPX 11 / 12 / 14 格式'
    : '字幕时间码 + 文本即可'
})

// 收集所有出现过的 displayRole(去重,按出现顺序),用于角色过滤下拉框
const uniqueRoles = computed(() => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of parsedSegments.value) {
    const r = s.displayRole || ''
    if (r && !seen.has(r)) {
      seen.add(r)
      out.push(r)
    }
  }
  return out
})

const filteredSegments = computed(() => {
  if (roleFilter.value === 'all') return parsedSegments.value
  // 按选中的 displayRole 过滤
  return parsedSegments.value.filter(s => (s.displayRole || '') === roleFilter.value)
})

// ============ 切 tab ============
function switchTab(id: 'fcpxml-to' | 'srt-to') {
  currentTab.value = id
  statusMsg.value = ''
}

// ============ 状态提示 ============
function setStatus(msg: string, type: 'ok' | 'err' | 'info' = 'info') {
  statusMsg.value = msg
  statusType.value = type
  if (type === 'ok') {
    setTimeout(() => {
      if (statusMsg.value === msg) statusMsg.value = ''
    }, 4000)
  }
}

// ============ FCPXML 解析 ============
function parseFcpxml(content: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/xml')

  // 浏览器差异:Chrome 把解析错误放 <parsererror>,Safari 有时直接返回空文档
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error('XML 格式错误: ' + parserError.textContent?.substring(0, 100))
  }

  // 检查根元素
  const root = doc.documentElement
  if (!root || root.nodeName !== 'fcpxml') {
    const preview = content.substring(0, 100).replace(/[^\x20-\x7e]/g, '?')
    throw new Error('XML 根元素不是 fcpxml。文件前 100 字符: ' + preview)
  }

  // 检查文件是否为空
  if (content.trim().length === 0) {
    throw new Error('文件为空')
  }

  // ★ 解析 FCPX 资源里的 effect 映射(把 id 映射到中文名"翻译字幕"/"主持人口播字幕"/"标题字幕")
  // <effect id="r2" name="翻译字幕"/>
  // <title ref="r2" ...> → 这个 title 用的是"翻译字幕"样式
  const effectMap: Record<string, string> = {}
  doc.querySelectorAll('resources > effect').forEach(eff => {
    const id = eff.getAttribute('id') || ''
    const name = eff.getAttribute('name') || ''
    if (id && name) effectMap[id] = name
  })

  // ★★★ 核心:按 role 属性智能分类成人类可读的中文角色 ★★★
  // FCPX 内部有 3 种语义角色:
  //   1. 字幕轨:role 包含 "subtitle"(如 subtitles.subtitles-1)→ "翻译字幕"
  //   2. 口播轨:role 是用户自定义的中文(以中文开头,后跟 .名字-N)→ 取点号前的部分
  //   3. 标题轨:无 role → "标题字幕"(默认 FCXP title/Lower Third 等)
  function getDisplayRole(internalRole: string, effectName: string): string {
    const r = internalRole || ''
    // 1. FCPX 默认字幕轨
    if (r.toLowerCase().includes('subtitle')) return '翻译字幕'
    // 2. 用户自定义角色(中文.中文-N 格式) → 取点号前的中文
    if (r) {
      const beforeDot = r.split('.')[0].trim()
      if (beforeDot) return beforeDot
    }
    // 3. 没有 role → 默认标题字幕
    // 但如果 effect 名本身就是字幕相关样式(如"翻译字幕"),也归为翻译字幕
    if (effectName.includes('字幕') || effectName.toLowerCase().includes('subtitle')) return '翻译字幕'
    return '标题字幕'
  }

  const titles = Array.from(doc.querySelectorAll('spine title'))  // 只取 spine 下的 title
  const segs: Array<{ start: number; end: number; text: string; role?: string; displayRole?: string; spineOrder: number }> = []
  let spineIdx = 0

  // 解析 FCPX 分数时间格式 "18005200/5000s" → 3601.04 秒
  function parseFcpTime(v: string): number {
    if (!v) return 0
    v = v.trim()
    if (v.endsWith('s')) v = v.slice(0, -1)
    if (v.includes('/')) {
      const [num, den] = v.split('/').map(parseFloat)
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den
    }
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }

  for (const t of titles) {
    const offset = parseFcpTime(t.getAttribute('offset') || '0')
    const start = parseFcpTime(t.getAttribute('start') || '0')
    const duration = parseFcpTime(t.getAttribute('duration') || '0')

    const segStart = start > 0 ? start : offset
    const segEnd = segStart + duration

    // role 属性是 FCPX 内部角色标识(如 subtitles.subtitles-1),通常以英文+数字结尾,人类不友好
    const internalRole = t.getAttribute('role') || ''
    const ref = t.getAttribute('ref') || ''
    const effectName = effectMap[ref] || ''
    const displayRole = getDisplayRole(internalRole, effectName)

    // ★ 屏幕实际显示的内容 = <text> 元素里的所有 <text-style> 拼接
    // 优先级 1:<text><text-style>...</text-style></text>(屏幕显示,关键!)
    const textStyles = Array.from(t.querySelectorAll('text text-style'))
    let text = textStyles.map(el => el.textContent || '').join('').trim()

    // 优先级 2(兜底):name 属性(只在 text 为空时用 — FCPX 老格式可能不写 text)
    if (!text) {
      text = (t.getAttribute('name') || '').trim()
    }

    // 优先级 3:title 元素的 textContent(再老的格式)
    if (!text) {
      text = t.textContent?.trim() || ''
    }

    if (text) {
      segs.push({
        start: segStart,
        end: segEnd,
        text,
        role: internalRole,           // 内部 role(给过滤逻辑用)
        displayRole: displayRole,     // 给用户看的中文角色
        spineOrder: spineIdx++,       // XML 出现顺序
      })
    }
  }

  // ★ 按 XML spine 顺序排(和 FCPX 时间线视觉顺序一致),不按 start 时间
  segs.sort((a, b) => a.spineOrder - b.spineOrder)
  return segs
}

// ============ SRT 解析 ============
// 放宽正则:支持 1-4 位毫秒(兼容非标 SRT,有些工具会写 4 位,如 WPS 字幕)
// 4 位毫秒 = 1/10000 秒,要进位到秒(例如 "1000" 实际是 1 秒,要加到 sec 上)
const SRT_TIME_RE = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,4})$/

function parseSrtTime(s: string): number {
  const m = SRT_TIME_RE.exec(s.trim())
  if (!m) throw new Error('SRT 时间格式错误: ' + s)
  let h = +m[1], min = +m[2], sec = +m[3], msRaw = m[4]
  // 处理 4 位毫秒:"1000" = 1 秒,要进位到 sec
  // 例如 "00:01:48,1000" 实际是 1 分 49 秒(108 + 1 = 109 秒)
  if (msRaw.length === 4) {
    // 4 位毫秒:1/10000 秒
    const extraSec = Math.floor(parseInt(msRaw, 10) / 1000)  // 进位的整秒
    const ms = parseInt(msRaw, 10) % 1000                     // 剩余毫秒
    sec += extraSec
    return h * 3600 + min * 60 + sec + ms / 1000
  }
  // 1-3 位毫秒:补 0 到 3 位
  const ms = msRaw.padEnd(3, '0').substring(0, 3)
  return h * 3600 + min * 60 + sec + parseInt(ms, 10) / 1000
}

function parseSrtFile(content: string): { segs: Array<{ start: number; end: number; text: string; originalText?: string; originalStart?: number; originalEnd?: number }>; skipped: number } {
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = content.split(/\n\n+/)
  const segs: Array<{ start: number; end: number; text: string; originalText?: string; originalStart?: number; originalEnd?: number }> = []
  let skipped = 0

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue
    if (!lines[1].includes('-->')) continue
    const [startS, endS] = lines[1].split('-->').map(s => s.trim())
    try {
      const start = parseSrtTime(startS)
      const end = parseSrtTime(endS)
      const text = lines.slice(2).join('\n').trim()
      segs.push({ start, end, text, originalText: text, originalStart: start, originalEnd: end })
    } catch {
      // 单条时间码坏掉,跳过,不毁整个文件
      skipped++
    }
  }
  return { segs, skipped }
}

// ============ SRT 在线编辑(2026-08-28 加) ============
function updateSegText(i: number, value: string) {
  if (!parsedSrt.value) return
  parsedSrt.value[i].text = value
}

function updateSegStart(i: number, value: string) {
  if (!parsedSrt.value) return
  try {
    const t = parseSrtTime(value)
    if (t < 0) { alert('开始时间不能为负数'); return }
    parsedSrt.value[i].start = t
  } catch (e: any) {
    alert('时间格式错误: ' + value + '\n正确格式: 00:00:00,000')
  }
}

function updateSegEnd(i: number, value: string) {
  if (!parsedSrt.value) return
  try {
    const t = parseSrtTime(value)
    if (t <= parsedSrt.value[i].start) {
      alert('结束时间必须大于开始时间')
      return
    }
    parsedSrt.value[i].end = t
  } catch (e: any) {
    alert('时间格式错误: ' + value + '\n正确格式: 00:00:00,000')
  }
}

function shiftSeg(i: number, delta: number) {
  if (!parsedSrt.value) return
  const seg = parsedSrt.value[i]
  parsedSrt.value[i].start = Math.max(0, +(seg.start + delta).toFixed(3))
  parsedSrt.value[i].end = +(seg.end + delta).toFixed(3)
}

function extendSeg(i: number, delta: number) {
  if (!parsedSrt.value) return
  const seg = parsedSrt.value[i]
  const newEnd = +(seg.end + delta).toFixed(3)
  if (newEnd <= seg.start) {
    alert('结束时间必须大于开始时间')
    return
  }
  parsedSrt.value[i].end = newEnd
}

function moveSeg(i: number, dir: number) {
  if (!parsedSrt.value) return
  const j = i + dir
  if (j < 0 || j >= parsedSrt.value.length) return
  const tmp = parsedSrt.value[i]
  parsedSrt.value[i] = parsedSrt.value[j]
  parsedSrt.value[j] = tmp
}

function mergeNext(i: number) {
  if (!parsedSrt.value) return
  if (i >= parsedSrt.value.length - 1) return
  const cur = parsedSrt.value[i]
  const next = parsedSrt.value[i + 1]
  cur.text = (cur.text + ' ' + next.text).trim()
  cur.end = next.end
  parsedSrt.value.splice(i + 1, 1)
}

function deleteSeg(i: number) {
  if (!parsedSrt.value) return
  if (!confirm(`确定删除第 ${i + 1} 条字幕?\n\n"${parsedSrt.value[i].text.slice(0, 50)}"`)) return
  parsedSrt.value.splice(i, 1)
}

function addSeg() {
  if (!parsedSrt.value) return
  const last = parsedSrt.value[parsedSrt.value.length - 1]
  const newStart = last ? last.end : 0
  const newEnd = +(newStart + 2).toFixed(3)
  parsedSrt.value.push({
    start: newStart,
    end: newEnd,
    text: '新字幕',
    originalText: undefined,
    originalStart: undefined,
    originalEnd: undefined
  })
}

// 批量替换（简盒 8-29 加）：查找/替换所有 SRT 字幕文字，支持正则
function applyBatchReplace() {
  if (!parsedSrt.value || parsedSrt.value.length === 0) {
    alert('还没有加载 SRT')
    return
  }
  if (!batchFind.value) {
    alert('请输入要查找的内容')
    return
  }
  let regex: RegExp
  try {
    regex = batchUseRegex.value
      ? new RegExp(batchFind.value, 'g')
      : new RegExp(batchFind.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
  } catch (e) {
    alert('正则表达式错误: ' + (e as Error).message)
    return
  }
  let count = 0
  parsedSrt.value.forEach((seg) => {
    const before = seg.text
    const after = before.replace(regex, batchReplace.value)
    if (before !== after) {
      seg.text = after
      seg.originalText = before
      count += before.match(regex)?.length || 0
    }
  })
  batchReplaceCount.value = count
  if (count > 0) {
    // 触发响应式刷新
    parsedSrt.value = [...parsedSrt.value]
  } else {
    alert('没有找到匹配项')
  }
}

// 预设清理规则（点一下直接应用，不打开对话框）
function applyPreset(preset: string) {
  showPresetMenu.value = false
  const presets: Record<string, { find: string; replace: string; regex: boolean; name: string }> = {
    'strip-html': {
      find: '<[^>]+>',
      replace: '',
      regex: true,
      name: '去除所有 HTML 标签'
    },
    'strip-davinci': {
      find: '</?b>|</?i>|</?u>|</?font[^>]*>|\\[\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s*-->\\s*\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\]|^\\s*\\[[A-Za-z\u4e00-\u9fa5]+\\]:?\\s*',
      replace: '',
      regex: true,
      name: '清理达芬奇 SRT 残留'
    },
    'strip-emotion': {
      find: '\\[(笑|叹气|旁白|哭|咳嗽|耳语|沉默|停顿|停顿)|\\(笑|叹气|旁白|哭|咳嗽|耳语|沉默|停顿\\)',
      replace: '',
      regex: true,
      name: '清理情感标记'
    },
    'strip-newline': {
      find: '\\r?\\n',
      replace: ' ',
      regex: true,
      name: '合并多行为单行'
    },
    'trim-space': {
      find: '^[ \\t]+|[ \\t]+$|[ \\t]{2,}',
      replace: ' ',
      regex: true,
      name: '清理空白'
    }
  }
  const p = presets[preset]
  if (!p) return
  batchFind.value = p.find
  batchReplace.value = p.replace
  batchUseRegex.value = p.regex
  applyBatchReplace()
}

function bulkShift(delta: number) {
  if (!parsedSrt.value || parsedSrt.value.length === 0) return
  if (!confirm(`全部 ${parsedSrt.value.length} 条字幕${delta > 0 ? '后移' : '前移'} ${Math.abs(delta)} 秒?`)) return
  parsedSrt.value.forEach((seg) => {
    seg.start = Math.max(0, +(seg.start + delta).toFixed(3))
    seg.end = +(seg.end + delta).toFixed(3)
  })
}

function matchesSearch(i: number): boolean {
  if (!parsedSrt.value) return false
  if (!searchText.value.trim()) return true
  const q = searchText.value.toLowerCase()
  return parsedSrt.value[i].text.toLowerCase().includes(q)
}

function getSegError(i: number): string {
  if (!parsedSrt.value) return ''
  const seg = parsedSrt.value[i]
  if (!seg.text || !seg.text.trim()) return 'empty'
  if (seg.end <= seg.start) return 'invalid-time'
  if (i > 0 && parsedSrt.value[i - 1].end > seg.start) return 'overlap'
  return ''
}

const modifiedCount = computed(() => {
  if (!parsedSrt.value) return 0
  let count = 0
  for (const seg of parsedSrt.value) {
    if (seg.originalText === undefined) { count++; continue }
    if (seg.text !== seg.originalText) count++
    else if (seg.start !== seg.originalStart || seg.end !== seg.originalEnd) count++
  }
  return count
})

// ============ FCPXML→SRT 路径的编辑(2026-08-28 加) ============
// 注:parsedSegments 是 ref<Array<...>>,改这里会直接修改原数组
// 但 filteredSegments 是 computed,基于 parsedSegments + roleFilter
// 操作 parsedSegments 后,filteredSegments 自动重算(但顺序会变,需要小心索引)
// 为简单起见:fcpxml tab 的编辑直接操作 parsedSegments,但 i 是 filteredSegments 里的索引,需要映射回 parsedSegments
const fcpxmlOriginalJson = ref<string>('')

function getFcpxmlOriginalIndex(filteredIdx: number): number {
  // 当前 filteredSegments 来自 parsedSegments,顺序一致(只是过滤)
  // 所以 filteredIdx == parsedSegments 索引(忽略被过滤掉的)
  // 但因为 Vue 的 v-for 用的是 filteredSegments 的索引,如果 roleFilter 改了,索引会变
  // 安全做法:通过 start + text 匹配定位(因为时间+文字唯一性较好)
  // 更简单:用户编辑时假设 roleFilter 是 'all' 或已知
  // 这里就用直接索引(假设默认 roleFilter 是 'all')
  if (roleFilter.value !== 'all') {
    // 警告用户切到 all
    return -1
  }
  return filteredIdx
}

function updateFcpxmlSegText(i: number, value: string) {
  const realIdx = getFcpxmlOriginalIndex(i)
  if (realIdx < 0) { alert('请先把"角色过滤"切到"全部"再编辑'); return }
  parsedSegments.value[realIdx].text = value
}

function updateFcpxmlSegStart(i: number, value: string) {
  const realIdx = getFcpxmlOriginalIndex(i)
  if (realIdx < 0) { alert('请先把"角色过滤"切到"全部"再编辑'); return }
  try {
    const t = parseSrtTime(value)
    if (t < 0) { alert('开始时间不能为负数'); return }
    parsedSegments.value[realIdx].start = t
  } catch (e: any) {
    alert('时间格式错误: ' + value + '\n正确格式: 00:00:00,000')
  }
}

function updateFcpxmlSegEnd(i: number, value: string) {
  const realIdx = getFcpxmlOriginalIndex(i)
  if (realIdx < 0) { alert('请先把"角色过滤"切到"全部"再编辑'); return }
  try {
    const t = parseSrtTime(value)
    if (t <= parsedSegments.value[realIdx].start) {
      alert('结束时间必须大于开始时间')
      return
    }
    parsedSegments.value[realIdx].end = t
  } catch (e: any) {
    alert('时间格式错误: ' + value + '\n正确格式: 00:00:00,000')
  }
}

function shiftFcpxmlSeg(i: number, delta: number) {
  const realIdx = getFcpxmlOriginalIndex(i)
  if (realIdx < 0) return
  const seg = parsedSegments.value[realIdx]
  parsedSegments.value[realIdx].start = Math.max(0, +(seg.start + delta).toFixed(3))
  parsedSegments.value[realIdx].end = +(seg.end + delta).toFixed(3)
}

function extendFcpxmlSeg(i: number, delta: number) {
  const realIdx = getFcpxmlOriginalIndex(i)
  if (realIdx < 0) return
  const seg = parsedSegments.value[realIdx]
  const newEnd = +(seg.end + delta).toFixed(3)
  if (newEnd <= seg.start) { alert('结束时间必须大于开始时间'); return }
  parsedSegments.value[realIdx].end = newEnd
}

function moveFcpxmlSeg(i: number, dir: number) {
  const realIdx = getFcpxmlOriginalIndex(i)
  if (realIdx < 0) return
  const j = realIdx + dir
  if (j < 0 || j >= parsedSegments.value.length) return
  const tmp = parsedSegments.value[realIdx]
  parsedSegments.value[realIdx] = parsedSegments.value[j]
  parsedSegments.value[j] = tmp
}

function mergeFcpxmlNext(i: number) {
  const realIdx = getFcpxmlOriginalIndex(i)
  if (realIdx < 0) return
  if (realIdx >= parsedSegments.value.length - 1) return
  const cur = parsedSegments.value[realIdx]
  const next = parsedSegments.value[realIdx + 1]
  cur.text = (cur.text + ' ' + next.text).trim()
  cur.end = next.end
  parsedSegments.value.splice(realIdx + 1, 1)
}

function deleteFcpxmlSeg(i: number) {
  const realIdx = getFcpxmlOriginalIndex(i)
  if (realIdx < 0) return
  if (!confirm(`确定删除第 ${i + 1} 条字幕?\n\n"${parsedSegments.value[realIdx].text.slice(0, 50)}"`)) return
  parsedSegments.value.splice(realIdx, 1)
}

function addFcpxmlSeg() {
  if (parsedSegments.value.length === 0) return
  const last = parsedSegments.value[parsedSegments.value.length - 1]
  const newStart = last.end
  const newEnd = +(newStart + 2).toFixed(3)
  parsedSegments.value.push({
    start: newStart,
    end: newEnd,
    text: '新字幕',
    role: '',
    displayRole: '',
    spineOrder: (last.spineOrder || 0) + 1
  })
}

function bulkFcpxmlShift(delta: number) {
  if (parsedSegments.value.length === 0) return
  if (!confirm(`全部 ${parsedSegments.value.length} 条字幕${delta > 0 ? '后移' : '前移'} ${Math.abs(delta)} 秒?`)) return
  parsedSegments.value.forEach((seg) => {
    seg.start = Math.max(0, +(seg.start + delta).toFixed(3))
    seg.end = +(seg.end + delta).toFixed(3)
  })
}

function matchesFcpxmlSearch(i: number): boolean {
  if (i >= filteredSegments.value.length) return false
  if (!searchText.value.trim()) return true
  const q = searchText.value.toLowerCase()
  return filteredSegments.value[i].text.toLowerCase().includes(q)
}

function getFcpxmlSegError(i: number): string {
  if (i >= filteredSegments.value.length) return ''
  const seg = filteredSegments.value[i]
  if (!seg.text || !seg.text.trim()) return 'empty'
  if (seg.end <= seg.start) return 'invalid-time'
  return ''
}

const fcpxmlModifiedCount = computed(() => {
  // 复用 batchReplaceCount(用户在 fcpxml-to tab 用批量替换工具改了多少处)
  // 不再 always 0,直接读 batchReplaceCount
  return batchReplaceCount.value
})

// ★ 按时间排序(SRT 源文件可能乱序,但 FCPXML spine 必须按时间排才不出错)
function sortByStart<T extends { start: number }>(segs: T[]): T[] {
  return [...segs].sort((a, b) => a.start - b.start)
}

// 把 .zip / .fcpxmld / .fcpxml 都正确处理
async function readFcpxmlFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  // .zip 或 .fcpxmld → JSZip 解压
  if (name.endsWith('.zip') || name.endsWith('.fcpxmld')) {
    const buf = await file.arrayBuffer()
    if (buf.byteLength === 0) {
      throw new Error('文件为空或浏览器无法读取')
    }
    console.log('[FcpxmlTool] arrayBuffer 大小:', buf.byteLength)
    let zip: JSZip
    try {
      zip = await JSZip.loadAsync(buf)
    } catch (e: any) {
      throw new Error('不是有效的 zip 文件(可能是 macOS bundle 而非 zip)。mac 上请右键 → "压缩" 生成真 zip 后再上传')
    }
    let target: JSZip.JSZipObject | null = null
    let allPaths: string[] = []
    zip.forEach((path, entry) => {
      allPaths.push((entry.dir ? '[DIR] ' : '[FILE] ') + path)
      if (target || entry.dir) return
      // 匹配 Info.fcpxml(可能在根,可能在任意子目录)
      if (/Info\.fcpxml$/i.test(path)) {
        target = entry
      }
    })
    if (!target) {
      throw new Error('ZIP 里找不到 Info.fcpxml。文件内容: ' + allPaths.join(', '))
    }
    return await target.async('string')
  }

  // .fcpxml / .xml → 当文本读
  return await file.text()
}

// ============ 文件处理 ============
function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) readFile(file)
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) {
    setStatus('没收到文件,请重试', 'err')
    return
  }
  readFile(file)
}

async function readFile(file: File) {
  isProcessing.value = true
  setStatus(`读取 ${file.name}...`, 'info')

  try {
    const name = file.name.toLowerCase()

    if (currentTab.value === 'fcpxml-to') {
      // .fcpxml / .fcpxmld / .zip 都走同一个 readFcpxmlFile
      setStatus('读取文件中...', 'info')
      const content = await readFcpxmlFile(file)
      const segs = parseFcpxml(content)
      parsedSegments.value = segs
      setStatus(`✓ 解析成功: ${segs.length} 条字幕`, 'ok')
    } else {
      // SRT
      const text = await file.text()
      const { segs, skipped } = parseSrtFile(text)
      // ★ 按时间排序后再用(原始 SRT 可能乱序,FCPXML spine 必须按时间排)
      parsedSrt.value = sortByStart(segs)
      const skipMsg = skipped > 0 ? ` (跳过 ${skipped} 条损坏时间码)` : ''
      setStatus(`✓ 解析成功: ${segs.length} 条字幕${skipMsg}`, 'ok')
    }
  } catch (e: any) {
    setStatus(`解析失败: ${e.message}`, 'err')
    console.error('[FcpxmlTool]', e)
  } finally {
    isProcessing.value = false
    // 清 input value,允许重选同一文件
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    if (input) input.value = ''
  }
}

function resetAll() {
  parsedSegments.value = []
  parsedSrt.value = null
  statusMsg.value = ''
}

// ============ 时间格式化 ============
function fmtTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s - Math.floor(s)) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`
}

function pad(n: number, len = 2): string {
  return n.toString().padStart(len, '0')
}

// ============ 导出 ============
function downloadFile(filename: string, content: string, mime: string) {
  try {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    console.log('[FcpxmlTool] 已触发下载:', filename, '大小:', content.length, '字节')
  } catch (e) {
    console.error('[FcpxmlTool] downloadFile 失败:', e)
    setStatus(`下载失败: ${(e as any).message}`, 'err')
  }
}

function exportSrt() {
  let srt = ''
  filteredSegments.value.forEach((seg, i) => {
    srt += `${i + 1}\n${fmtTime(seg.start)} --> ${fmtTime(seg.end)}\n${seg.text}\n\n`
  })
  downloadFile('subtitles.srt', srt.trim(), 'text/plain')
  setStatus('✓ SRT 已下载', 'ok')
}

function exportMarkdown() {
  const ts = includeTimestamp.value
  let md = `# 字幕导出\n\n`
  md += `> 导出时间:${new Date().toLocaleString('zh-CN')}\n`
  md += `> 共 ${filteredSegments.value.length} 条字幕\n\n`
  md += `---\n\n`
  filteredSegments.value.forEach((seg, i) => {
    const stamp = ts ? `**${fmtTime(seg.start)} → ${fmtTime(seg.end)}**${seg.displayRole ? ` _[${seg.displayRole}]_` : ''}\n\n` : ''
    md += `${stamp}${seg.text}\n\n`
  })
  downloadFile('subtitles.md', md, 'text/markdown')
  setStatus(`✓ Markdown 已下载（${ts ? '含' : '不含'}时间码）`, 'ok')
}

function exportWord() {
  const ts = includeTimestamp.value
  let html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
h1 { font-size: 20px; }
table { border-collapse: collapse; width: 100%; margin-top: 20px; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
th { background: #f5f5f5; }
tr:nth-child(even) { background: #fafafa; }
</style></head><body>
<h1>字幕导出</h1>
<p>导出时间:${new Date().toLocaleString('zh-CN')}</p>
<p>共 ${filteredSegments.value.length} 条字幕</p>
<table>
<thead>${ts ? '<tr><th>#</th><th>开始</th><th>结束</th><th>角色</th><th>字幕内容</th></tr>' : '<tr><th>#</th><th>字幕内容</th></tr>'}</thead>
<tbody>`
  filteredSegments.value.forEach((seg, i) => {
    if (ts) {
      html += `<tr><td>${i + 1}</td><td>${fmtTime(seg.start)}</td><td>${fmtTime(seg.end)}</td><td>${seg.displayRole || '-'}</td><td>${escapeHtml(seg.text)}</td></tr>`
    } else {
      html += `<tr><td>${i + 1}</td><td>${escapeHtml(seg.text)}</td></tr>`
    }
  })
  html += `</tbody></table></body></html>`
  downloadFile('subtitles.doc', html, 'application/msword')
  setStatus(`✓ Word 已下载（${ts ? '含' : '不含'}时间码）`, 'ok')
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c))
}

// SRT → FCPXML(默认样式,不带品牌,符合 FCPX 11/12 DTD)
function exportFcpxml() {
  if (!parsedSrt.value) return
  // 把 parsedSrt 转成 buildFcpxmlFromSegments 需要的格式
  const segs = parsedSrt.value.map(s => ({ ...s, role: undefined }))
  // 简盒 8-29 改：传 fcpxmlVersion 控制 DTD（避免老 FCPX 不认）
  const xml = buildFcpxmlFromSegments(segs, 'AI字幕', targetFps.value, fcpxmlVersion.value)
  // 文件名:subtitles-113.fcpxml（版本号在扩展名前，扩展名始终是 .fcpxml，FCPX 能识别）
  const versionTag = fcpxmlVersion.value.replace('.', '')
  downloadFile(`subtitles-${versionTag}.fcpxml`, xml, 'application/xml')
  setStatus(`✓ FCPXML 已下载(${segs.length} 条,${targetFps.value}fps)`, 'ok')
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] || c))
}

// ============ 共享:把 segments 拼成 FCPXML 字符串 ============
// FCPX 12 严格 DTD 校验要点(踩坑总结):
//   1. <resources> 只允许 (format | effect),不允许 text-style-def
//   2. 整个文档所有 id 必须唯一(FCPX 11 容忍重复,12 不容忍)
//   3. effect 的 uid 必须真实存在(指向用户 mac 上已安装的 .moti),否则警告"未能读取该项"
//   4. format 必须用 FCPX 认识的真实名字(如 FFVideoFormat1920x1080p50),不能用 RateUndefined
// 解决方案:
//   - 用 FCPX 系统必有的 format(1080p50,跟常见分辨率兼容)
//   - 不引用任何 effect(去掉 ref="r2"),title 用 FCPX 默认样式,完全内联 text-style
function buildFcpxmlFromSegments(
  segs: Array<{ start: number; end: number; text: string; role?: string; displayRole?: string }>,
  projectName = 'AI字幕',
  fps: number = 50,
  fcpxmlVer: string = '1.14'  // 简盒 8-29 加：DTD 版本控制（1.14=FCPX12, 1.10=FCPX11/12, 1.5=FCPX老版）
): string {
  // 中文字幕默认样式(macOS 系统字体)
  // ★ FCPX 12 关键:Subtitle.moti 是用户系统从 Apple 服务器下载的,不是内置,可能找不到
  // 解决方法:不加 effect 引用,FCPX 12 会用默认 title 渲染器
  const TEXT_STYLE = {
    font: 'PingFang SC',           // macOS 系统自带中文字体
    fontSize: 60,                  // 60pt(避免与模板冲突,用户可用 FCPX 检查器调大)
    fontColor: '1 1 1 1',          // 白色
    strokeColor: '0 0 0 1',        // 黑色描边
    strokeWidth: 2,                // 描边宽度
    alignment: 'center',
    lineSpacing: 12,
    bold: 0
  }

  // FCPX 12 严格校验:offset/duration 必须在帧边界上,而且必须**精确表示**
  // 浮点 1.64 在 XML 里写 1.640,parseFloat 后是 1.6400000000000001,与帧边界差 1e-16 → 警告
  // 原生 FCPX 用分数形式写时间(如 82/50s = 1.64s),避免浮点精度问题
  // 解决方案:用 FCPXML 分数格式 "X/Ns" (N=fps,帧号 = 整数)
  function frameStr(s: number): string {
    const n = Math.round(s * fps)
    return `${n}/${fps}s`
  }

  let titleXml = ''
  // 简盒 8-29 加：DTD 版本控制（提前定义，循环里要用）
  // ★ FCPX 11 (v1.13) 报错"Element title does not carry attribute ref"
  //   经过反复测试，可能解读是 "Element title **缺少 required 属性** ref"
  //   DTD 1.5 文档明确说 <title ref IDREF #REQUIRED>
  // ★ 解决：给 v1.13/v1.10 都加上 ref 属性（指向 r2 effect）
  //   v1.14 不加 ref（FCPX 12 改了规则）
  const isNewDTD = fcpxmlVer === '1.14'
  const supportsRefEffect = !isNewDTD  // 老 DTD：必须 ref；新 DTD：不 ref
  // 8-29 实测：用户 FCPX 11 真实没有 Basic Lower Third.moti（FCPX 12 才内置）
  // 用 FCPX 11 系统真实存在的 Upper.moti（Lower Thirds.localized/Upper.localized/Upper.moti）
  const legacyTitleUid = '.../Titles.localized/Lower Thirds.localized/Upper.localized/Upper.moti'
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    const startStr = frameStr(seg.start)
    const durStr = frameStr(seg.end - seg.start)
    // ★ 简盒 8-29 加：导出时先剥离 HTML 标签（达芬奇 SRT 会带 <b>，FCPX 解析后字会变小或变样式错乱）
    const stripped = seg.text.replace(/<[^>]+>/g, '').trim()
    const text = escapeXml(stripped)
    const name = escapeXml(stripped.substring(0, 20))
    // 8-29 改：参考 FCPX 11 真实生成格式（未命名项目.fcpxmld/Info.fcpxml）
    // 8-29 实测：所有版本都用 Upper.moti，所以所有版本都要 ref="r2" 指向 effect
    // v1.13/v1.10 带 ref + lane="1"（FCPX 11 格式）
    // v1.14 带 ref + lane="13"（FCPX 12 格式，统一用 Upper.moti）
    const titleRef = ` ref="r2"`
    const laneAttr = isNewDTD ? ` lane="13"` : ` lane="1"`
    const tsId = `ts${i + 1}`
    titleXml += `          <title${titleRef}${laneAttr} offset="${startStr}" name="${name}" start="${startStr}" duration="${durStr}">
            <text>
              <text-style ref="${tsId}">${text}</text-style>
            </text>
            <text-style-def id="${tsId}">
              <text-style font="${TEXT_STYLE.font}" fontSize="${TEXT_STYLE.fontSize}" fontFace="Regular" fontColor="${TEXT_STYLE.fontColor}"/>
            </text-style-def>
          </title>
`
  }

  // ★ sequence 总长度 = 最后一段的结束时间(FCPX 12 必需,否则 sequence 显示 0 长度)
  const sequenceDur = segs.length > 0 ? frameStr(segs[segs.length - 1].end) : `${fps}/${fps}s`

  // ★ 关键 5:用真实 format name(FCPX 12 系统 100% 识别)
  // format:用 fps 对应的真实名字(如 25fps → FFVideoFormat1080p25,50fps → FFVideoFormat1080p50)
  // ★ 关键 6:加 <!DOCTYPE fcpxml>(FCPX 12 必需,没有它 DTD 验证可能跳过)
  // ★ 关键 7:sequence 加 duration 属性(FCPX 12 必需,决定 timeline 总长度)
  // ★ 关键 8:用 fcpxml version="1.14"(FCPX 12 主版本)
  // ★ 关键 9:用一个大 gap 包裹所有 title,模拟原生 FCPX 项目结构
  // ★ 关键 10(2026-08-28 实测必须):resources 里必须有 <effect id="r2">,
  //   否则每个 <title ref="r2"> 引用不到,FCPX 12 DTD 验证报 "Element title does not carry attribute ref"
  const formatName = `FFVideoFormat1920x1080p${fps}`
  // 8-29 改：所有版本都用 Upper.moti（FCPX 11/12 都内置，避免字小问题）
  // 之前 v1.14 用 Subtitle.moti 会字小（模板默认字号 40pt），统一改用 Upper.moti
  const effectBlock = `    <effect id="r2" name="翻译字幕" uid=".../Titles.localized/Lower Thirds.localized/Upper.localized/Upper.moti"/>\n`
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>

<fcpxml version="${fcpxmlVer}">
  <resources>
    <format id="r1" name="${formatName}" frameDuration="1/${fps}s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
${effectBlock}
  </resources>
  <library>
    <event name="${escapeXml(projectName)}">
      <project name="${escapeXml(projectName)}">
        <sequence format="r1" duration="${sequenceDur}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
            <gap name="空隙" offset="0/${fps}s" start="0/${fps}s" duration="${sequenceDur}">
${titleXml}            </gap>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`
}

// ============ 导出 FCPXML(从 FCPXML 输入,应用角色过滤) ============
function exportFcpxmlFromFcpxml() {
  const segs = filteredSegments.value
  if (segs.length === 0) {
    setStatus('没有可导出的字幕', 'err')
    return
  }
  const xml = buildFcpxmlFromSegments(segs, '筛选字幕')
  downloadFile('subtitles.fcpxml', xml, 'application/xml')
  setStatus(`✓ FCPXML 已下载(${segs.length} 条)`, 'ok')
}

// ============ 导出 FCPXMLD (bundle zip) ============
// FCPX 12 要求 .fcpxmld 是 macOS bundle 目录,内部含 Info.fcpxml + Resources/
// 浏览器下载的 zip 双击解压后,把文件夹改名为 xxx.fcpxmld,拖入 FCPX 即可
// macOS 自动把 .fcpxmld 当 bundle 加载
async function downloadAsFcpxmld(filename: string, fcpxmlContent: string) {
  try {
    const zip = new JSZip()
    zip.file('Info.fcpxml', fcpxmlContent)
    // 占位文件让 Resources/ 目录在 zip 里存在(FCPX 期望)
    zip.file('Resources/.placeholder', 'Created by 简盒 FCPXML 工具')
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 下载下来是 zip(.fcpxmld.zip),用户解压后改名 .fcpxmld
    a.download = filename + '.zip'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    console.log('[FcpxmlTool] 已触发下载:', filename + '.zip')
  } catch (e) {
    console.error('[FcpxmlTool] downloadAsFcpxmld 失败:', e)
    setStatus(`下载失败: ${(e as any).message}`, 'err')
  }
}

async function exportFcpxmld() {
  const segs = filteredSegments.value
  if (segs.length === 0) {
    setStatus('没有可导出的字幕', 'err')
    return
  }
  const xml = buildFcpxmlFromSegments(segs, '筛选字幕')
  await downloadAsFcpxmld('subtitles.fcpxmld', xml)
  setStatus(`✓ FCPXMLD 已下载(${segs.length} 条)`, 'ok')
}

async function exportFcpxmldFromSrt() {
  if (!parsedSrt.value || parsedSrt.value.length === 0) {
    setStatus('没有可导出的字幕', 'err')
    return
  }
  // 把 parsedSrt 转成 buildFcpxmlFromSegments 需要的格式(role 可选)
  const segs = parsedSrt.value.map(s => ({ ...s, role: undefined }))
  const xml = buildFcpxmlFromSegments(segs, 'AI字幕', targetFps.value)
  await downloadAsFcpxmld('subtitles.fcpxmld', xml)
  setStatus(`✓ FCPXMLD 已下载(${segs.length} 条,${targetFps.value}fps)`, 'ok')
}

// ============ SRT → Word / Markdown ============
function exportSrtAsMd() {
  if (!parsedSrt.value || parsedSrt.value.length === 0) {
    setStatus('没有可导出的字幕', 'err')
    return
  }
  const ts = includeTimestamp.value
  const segs = parsedSrt.value
  let md = `# 字幕导出\n\n`
  md += `> 导出时间:${new Date().toLocaleString('zh-CN')}\n`
  md += `> 共 ${segs.length} 条字幕\n\n`
  md += `---\n\n`
  segs.forEach((seg, i) => {
    const stamp = ts ? `**${fmtTime(seg.start)} → ${fmtTime(seg.end)}**\n\n` : ''
    md += `${stamp}${seg.text}\n\n`
  })
  downloadFile('subtitles.md', md, 'text/markdown')
  setStatus(`✓ Markdown 已下载(${segs.length} 条,${ts ? '含' : '不含'}时间码)`, 'ok')
}

function exportSrtAsDoc() {
  if (!parsedSrt.value || parsedSrt.value.length === 0) {
    setStatus('没有可导出的字幕', 'err')
    return
  }
  const ts = includeTimestamp.value
  const segs = parsedSrt.value
  let html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
h1 { font-size: 20px; }
table { border-collapse: collapse; width: 100%; margin-top: 20px; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
th { background: #f5f5f5; }
tr:nth-child(even) { background: #fafafa; }
</style></head><body>
<h1>字幕导出</h1>
<p>导出时间:${new Date().toLocaleString('zh-CN')}</p>
<p>共 ${segs.length} 条字幕</p>
<table>
<thead>${ts ? '<tr><th>#</th><th>开始</th><th>结束</th><th>字幕内容</th></tr>' : '<tr><th>#</th><th>字幕内容</th></tr>'}</thead>
<tbody>`
  segs.forEach((seg, i) => {
    if (ts) {
      html += `<tr><td>${i + 1}</td><td>${fmtTime(seg.start)}</td><td>${fmtTime(seg.end)}</td><td>${escapeHtml(seg.text)}</td></tr>`
    } else {
      html += `<tr><td>${i + 1}</td><td>${escapeHtml(seg.text)}</td></tr>`
    }
  })
  html += `</tbody></table></body></html>`
  downloadFile('subtitles.doc', html, 'application/msword')
  setStatus(`✓ Word 已下载(${segs.length} 条,${ts ? '含' : '不含'}时间码)`, 'ok')
}
</script>

<style scoped>
/* ===== 暗色 + 蓝紫渐变(跟简盒主页一致) ===== */
/* 🇨🇳 2026-08-31 M3.9 R33:.fcpxml-page 不设 padding(让 nav 内 JianheboxLogo 跟其它工具页同位置) */
.fcpxml-page {
  margin: 0 auto;
  max-width: 1200px;
  color: #e5e7eb;
  padding-top: 16px; /* 跟主页 header.nav (top:16) 对齐 */
}
.fcpxml-tool-nav-wrap {
  background: #0a0a0a;
  max-width: 1200px;
  margin: 0 auto;
}

/* 🇨🇳 2026-08-31 M3.9 R33:container 跟 audio-container 一致,让 header 距离 nav 有 32px gap(16 sticky 偏移 + 16 间距) */
.fcpxml-container {
  padding-top: 16px; /* nav 在 wrap 里自己 sticky,container 只需 16px 间距 */
}

/* 🇨🇳 2026-08-31 M3.9 R33:删除 .fcpxml-nav-wrapper 死代码(已删除 wrapper 元素) */

/* 头部 */
.page-header {
  margin-bottom: var(--space-7);
  padding: var(--space-7);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.header-badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--color-bg-frosted);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}
.page-header h1 {
  margin: 0 0 8px 0;
  font-size: 26px;
  font-weight: 600;
  color: var(--color-text);
}
.subtitle {
  margin: 0;
  color: #9ca3af;
  font-size: 14px;
}

/* 标签页 */
.tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-5);
  background: var(--color-bg-frosted);
  padding: var(--space-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
}
.tab {
  flex: 1;
  min-width: 0;  /* 🇨🇳 2026-08-31 M3.9 R35:允许 flex item 收缩 */
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  font-size: var(--font-md);
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: calc(var(--radius-md) - 2px);
  transition: all var(--duration-fast) var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: inherit;
}
.tab:hover { color: var(--color-text); background: var(--color-bg-frosted-hover); }
.tab.active {
  color: var(--color-primary-text);
  background: var(--color-primary);
  font-weight: var(--weight-semibold);
}
.tab-icon { font-size: 14px; }
.tab-badge {
  background: var(--color-bg-frosted-hover);
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}
.tab.active .tab-badge { background: rgba(0, 0, 0, 0.12); }

/* 上传区 */
.upload-zone { padding: 12px 0 20px; }
.drop-area {
  border: 2px dashed rgba(99, 102, 241, 0.4);
  border-radius: 16px;
  padding: 56px 24px;
  text-align: center;
  cursor: pointer;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%);
  transition: all 0.25s;
}
.drop-area:hover {
  border-color: rgba(99, 102, 241, 0.6);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);
  transform: translateY(-2px);
}
.drop-area.dragging {
  border-color: #a78bfa;
  background: rgba(99, 102, 241, 0.2);
  transform: scale(1.01);
}
.drop-area.processing {
  cursor: wait;
  opacity: 0.7;
}
.drop-icon { font-size: 44px; margin-bottom: 12px; }
.drop-text { color: #e5e7eb; font-size: 16px; font-weight: 500; margin-bottom: 4px; }
.drop-sub { color: #9ca3af; font-size: 13px; }
.upload-tip {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  margin-top: 14px;
}
.upload-tip code {
  background: rgba(31, 41, 55, 0.8);
  padding: 3px 8px;
  border-radius: 4px;
  color: #c4b5fd;
  font-size: 12px;
}
.status { margin-left: 8px; font-weight: 500; }
.status.ok { color: #6ee7b7; }
.status.err { color: #fca5a5; }
.status.info { color: #93c5fd; }

/* 结果区 */
.result-zone { padding: 8px 0; }
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
  background: rgba(31, 41, 55, 0.4);
  border-radius: 12px;
  border: 1px dashed rgba(75, 85, 99, 0.4);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(31, 41, 55, 0.5);
  border: 1px solid rgba(75, 85, 99, 0.4);
  border-radius: 10px;
  flex-wrap: wrap;
}
.control-row label { font-weight: 500; font-size: 14px; color: #d1d5db; }
.control-row .count { color: #9ca3af; font-size: 13px; margin-left: auto; }
.select {
  padding: 6px 10px;
  border: 1px solid rgba(75, 85, 99, 0.6);
  border-radius: 6px;
  font-size: 13px;
  background: rgba(17, 24, 39, 0.8);
  color: #e5e7eb;
}

.timeline {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid rgba(75, 85, 99, 0.4);
  border-radius: 10px;
  background: rgba(17, 24, 39, 0.5);
  padding: 12px 16px;
  margin-bottom: 16px;
}
.timeline-item {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(75, 85, 99, 0.25);
  font-size: 13px;
}
.timeline-item:last-child { border-bottom: none; }
.timeline-item .time {
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #9ca3af;
  min-width: 180px;
  font-size: 12px;
}
.timeline-item .role {
  color: #a78bfa;
  font-size: 11px;
  min-width: 80px;
}
.timeline-item .text { flex: 1; color: #e5e7eb; }

/* ============ 可编辑时间线样式(2026-08-28 加 · 暗色主题适配) ============ */
.timeline-item.editable {
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  margin-bottom: 4px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  flex-wrap: wrap;
}
.timeline-item.editable:hover {
  border-color: rgba(139, 92, 246, 0.5);
  background: rgba(139, 92, 246, 0.08);
}
.timeline-item.editable.has-error {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
.seg-index {
  color: #9ca3af;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  min-width: 32px;
}
.time-input {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  padding: 5px 7px;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  width: 130px;
  background: rgba(0, 0, 0, 0.2);
  color: #e5e7eb;
}
.time-input:focus {
  outline: none;
  border-color: #8b5cf6;
  background: rgba(0, 0, 0, 0.4);
}
.time-input.search {
  width: 200px;
  font-family: inherit;
}
.time-arrow {
  color: #9ca3af;
  font-size: 14px;
}
.text-input {
  flex: 1;
  min-width: 200px;
  font-size: 13px;
  padding: 5px 9px;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
  color: #e5e7eb;
  margin-left: 4px;
}
.text-input:focus {
  outline: none;
  border-color: #8b5cf6;
  background: rgba(0, 0, 0, 0.4);
}
.seg-actions {
  display: flex;
  gap: 2px;
  margin-left: 8px;
  flex-wrap: wrap;
}
.ico-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: var(--color-bg-frosted);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-base);
  line-height: 1;
  color: var(--color-text);
  transition: all var(--duration-fast) var(--ease-out);
}
.ico-btn:hover:not(:disabled) {
  background: var(--color-bg-frosted-hover);
  border-color: var(--color-accent);
}
.ico-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.ico-btn.danger:hover:not(:disabled) {
  background: rgba(255, 77, 79, 0.12);
  border-color: var(--color-danger);
  color: var(--color-danger);
}
.add-row {
  text-align: center;
  padding: 12px 0;
}

.more {
  text-align: center;
  color: #6b7280;
  padding: 12px;
  font-size: 13px;
}

.output-section {
  margin-top: 14px;
}
.output-label {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 8px;
  font-weight: 500;
}
.output-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.output-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.output-grid .btn { width: 100%; }
.format-help {
  margin-top: 14px;
  padding: 10px 14px;
  background: rgba(99, 102, 241, 0.08);
  border-left: 3px solid rgba(99, 102, 241, 0.5);
  border-radius: 6px;
  color: #9ca3af;
  font-size: 12.5px;
  line-height: 1.7;
}
.format-help strong { color: #c7d2fe; }
.opt-checkbox {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #d1d5db;
  cursor: pointer;
  user-select: none;
}
.opt-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
  cursor: pointer;
}
.opt-checkbox span {
  line-height: 1.5;
}
/* .btn .btn-primary .btn-secondary .btn-ghost 系统已移到 src/styles/design-system.css
   此处只保留本页特殊样式 */

.format-hint {
  margin-top: 14px;
  padding: 10px 14px;
  background: rgba(99, 102, 241, 0.08);
  border-left: 3px solid rgba(99, 102, 241, 0.5);
  border-radius: 6px;
  color: #9ca3af;
  font-size: 13px;
}

/* SEO 内容区 */
.seo-content {
  margin-top: 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.seo-card {
  padding: 24px 28px;
  background: linear-gradient(135deg, rgba(31, 41, 55, 0.5) 0%, rgba(17, 24, 39, 0.5) 100%);
  border: 1px solid rgba(75, 85, 99, 0.3);
  border-radius: 14px;
  backdrop-filter: blur(4px);
}
.seo-card h2 {
  font-size: 18px;
  margin: 0 0 12px 0;
  color: #f3f4f6;
  font-weight: 600;
}
.seo-card h3 {
  font-size: 15px;
  margin: 0 0 14px 0;
  color: #d1d5db;
  font-weight: 500;
}
.seo-card p {
  color: #9ca3af;
  line-height: 1.75;
  font-size: 14px;
  margin: 0;
}
.seo-card strong { color: #c7d2fe; }

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}
.feature {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: rgba(17, 24, 39, 0.5);
  border: 1px solid rgba(75, 85, 99, 0.3);
  border-radius: 10px;
  transition: all 0.2s;
}
.feature:hover {
  border-color: rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}
.feature-icon {
  font-size: 22px;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
  border-radius: 8px;
}
.feature-text strong {
  display: block;
  color: #e5e7eb;
  font-size: 14px;
  margin-bottom: 4px;
}
.feature-text p {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
  line-height: 1.5;
}

.privacy-card {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(31, 41, 55, 0.5) 100%);
  border-color: rgba(34, 197, 94, 0.25);
}

/* mac fcpxmld 用户提示 */
.fcpxmld-hint {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(251, 191, 36, 0.08);
  border-left: 3px solid rgba(251, 191, 36, 0.5);
  border-radius: 6px;
  color: #fbbf24;
  font-size: 12.5px;
  line-height: 1.6;
}
.fcpxmld-hint strong { color: #fcd34d; }

/* 响应式 */
@media (max-width: 640px) {
  .fcpxml-page { padding: 16px 12px; }
  .page-header { padding: 20px; }
  .page-header h1 { font-size: 22px; }
  .timeline-item { flex-wrap: wrap; }
  .timeline-item .time { min-width: 100%; margin-bottom: 4px; }
}

/* 简盒 8-29 加：批量替换 + 预设清理 UI */
.batch-replace-row {
  background: rgba(0, 153, 255, 0.06);
  border: 1px solid rgba(0, 153, 255, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
  margin: 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.batch-replace-row .time-input {
  width: 160px;
}

.regex-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.regex-toggle input {
  cursor: pointer;
}

.preset-menu {
  background: #1f2937;
  border: 1px solid rgba(0, 153, 255, 0.3);
  border-radius: 8px;
  padding: 12px;
  margin: 4px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preset-menu-title {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 4px;
}

.preset-item {
  text-align: left;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 12px;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s ease;
}

.preset-item:hover {
  background: rgba(0, 153, 255, 0.18);
  border-color: rgba(0, 153, 255, 0.4);
}
/* 🇨🇳 2026-08-31 M3.9 R35:移动端紧凑排版 + h1 字号缩小避免溢出 */
@media (max-width: 720px) {
  .fcpxml-container { padding: 12px; max-width: 100vw; overflow-x: hidden; }
  .fcpxml-container > * { max-width: 100%; min-width: 0; }
  .fcpxml-container .page-header h1 { font-size: 18px !important; line-height: 1.3; word-break: break-word; }
  .fcpxml-container .page-header .subtitle { font-size: 12px !important; word-break: break-word; line-height: 1.4; }
  .fcpxml-container .tabs { gap: 4px; flex-wrap: wrap; }
  .fcpxml-container .tab {
    font-size: 11px !important;
    padding: 8px 6px !important;
    min-width: 0 !important;
    flex: 1 1 0 !important;
    text-align: center;
    white-space: normal;
    line-height: 1.3;
    height: auto;
  }
  .fcpxml-container .tab .tab-icon { display: none; }
  .fcpxml-container .upload-zone { padding: 24px 16px; }
  .fcpxml-container .info-card { padding: 12px; }
  .fcpxml-container .info-card h3 { font-size: 14px; }
  .fcpxml-container .feature-card { padding: 12px; }
}
</style>
