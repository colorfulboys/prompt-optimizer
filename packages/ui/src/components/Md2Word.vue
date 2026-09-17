<template>
  <div class="md2word-page">
    <header class="page-header">
      <h1>📝 Markdown → Word 转换器</h1>
      <p class="subtitle">纯前端转换，文件不上传服务器，零隐私风险。输出 .doc 文件，Word / WPS 直接打开</p>
    </header>

    <div class="tool-grid">
      <div class="tool-pane">
        <div class="pane-header">
          <span>Markdown 源文本</span>
          <button class="sample-btn" @click="loadSample">加载示例</button>
        </div>
        <textarea
          v-model="markdown"
          placeholder="在此粘贴或输入 Markdown 文本..."
          class="md-input"
        ></textarea>
        <div class="pane-footer">
          <span>{{ markdown.length }} 字符</span>
          <button class="primary-btn" :disabled="!markdown.trim() || converting" @click="convert">
            {{ converting ? '转换中...' : '转换为 Word (.doc)' }}
          </button>
        </div>
      </div>

      <div class="tool-pane preview-pane">
        <div class="pane-header">
          <span>预览</span>
        </div>
        <div class="preview-area">
          <div v-if="!previewHtml" class="empty-preview">
            点击「转换」后此处显示预览
          </div>
          <div v-else v-html="previewHtml" class="preview-content"></div>
        </div>
      </div>
    </div>

    <div v-if="errorMsg" class="error-bar">
      ⚠️ {{ errorMsg }}
    </div>

    <div class="features">
      <h3>✅ 功能特点</h3>
      <ul>
        <li><strong>零上传</strong>：所有转换在浏览器本地完成，文本永不离开你的设备</li>
        <li><strong>支持语法</strong>：标题、列表、代码块、表格、粗体/斜体、链接、图片引用、引用</li>
        <li><strong>实时预览</strong>：转换前可看到大致样式</li>
        <li><strong>无水印</strong>：完全免费，无广告弹窗</li>
        <li><strong>通用格式</strong>：输出标准 .doc（HTML 容器），Word 2003+ / WPS / Pages 都能开</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
// markdown-it 已在 package.json 里，无需新增依赖
import MarkdownIt from 'markdown-it'

const markdown = ref('')
const previewHtml = ref('')
const converting = ref(false)
const errorMsg = ref('')

const md = new MarkdownIt({
  html: false,    // 不允许内嵌 HTML（防 XSS）
  linkify: true,  // 自动识别 URL
  breaks: true    // \n 变 <br>
})

const SAMPLE = `# 简盒 Markdown 转 Word 示例

这是一份**粗体**和*斜体*混排的演示文档。

## 功能列表
1. 标题层级 H1-H6
2. 有序 / 无序列表
3. 行内代码 和代码块
4. 表格支持
5. 链接和图片

## 代码块

\`\`\`javascript
function hello(name) {
  return 'Hello, ' + name;
}
\`\`\`

## 表格

| 列1 | 列2 |
|-----|-----|
| A   | B   |
| C   | D   |

> 引用块也支持。

[简盒主页](https://jianhebox.pages.dev)
`

function loadSample() {
  markdown.value = SAMPLE
  errorMsg.value = ''
}

async function convert() {
  errorMsg.value = ''
  converting.value = true
  try {
    const bodyHtml = md.render(markdown.value)
    previewHtml.value = bodyHtml
    // Word 能直接打开 HTML。包一层完整 HTML 文档，带 MSO 命名空间提示 Word 这是 HTML。
    const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>简盒 Md2Word</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
@page { size: A4; margin: 2cm; }
body { font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; font-size: 11pt; line-height: 1.6; }
h1, h2, h3, h4, h5, h6 { color: #1f2937; margin-top: 16pt; margin-bottom: 8pt; }
h1 { font-size: 22pt; border-bottom: 2px solid #2563eb; padding-bottom: 4pt; }
h2 { font-size: 18pt; }
h3 { font-size: 14pt; }
code { background: #f1f5f9; padding: 1pt 4pt; border-radius: 2pt; font-family: Consolas, monospace; font-size: 10pt; }
pre { background: #1e293b; color: #e2e8f0; padding: 8pt; border-radius: 4pt; }
pre code { background: transparent; color: inherit; padding: 0; }
table { border-collapse: collapse; margin: 12pt 0; }
th, td { border: 1px solid #d1d5db; padding: 4pt 8pt; }
th { background: #f3f4f6; }
blockquote { border-left: 3pt solid #9ca3af; padding-left: 8pt; color: #4b5563; margin: 8pt 0; }
img { max-width: 100%; }
a { color: #2563eb; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`
    // 使用 BOM 让 Word 正确识别 UTF-8
    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `简盒-md2word-${Date.now()}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e: any) {
    errorMsg.value = `转换失败：${e?.message || String(e)}`
  } finally {
    converting.value = false
  }
}
</script>

<style scoped>
.md2word-page { max-width: 1200px; margin: 0 auto; padding: 24px; }
.page-header { margin-bottom: 24px; }
.page-header h1 { margin: 0 0 8px 0; font-size: 28px; }
.subtitle { margin: 0; color: #666; }
.tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .tool-grid { grid-template-columns: 1fr; } }
.tool-pane { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: white; }
.pane-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f7f7f7; border-bottom: 1px solid #e0e0e0; font-weight: 600; font-size: 13px; }
.sample-btn { background: none; border: 1px solid #ccc; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.sample-btn:hover { background: #eee; }
.md-input { width: 100%; min-height: 400px; padding: 12px; border: none; resize: vertical; font-family: 'SF Mono', Consolas, monospace; font-size: 13px; line-height: 1.6; box-sizing: border-box; outline: none; }
.pane-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f7f7f7; border-top: 1px solid #e0e0e0; font-size: 13px; color: #666; }
.primary-btn { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
.primary-btn:hover:not(:disabled) { background: #1d4ed8; }
.primary-btn:disabled { background: #94a3b8; cursor: not-allowed; }
.preview-pane .preview-area { min-height: 400px; padding: 16px; overflow-y: auto; }
.empty-preview { color: #999; text-align: center; padding: 80px 20px; }
.preview-content { line-height: 1.7; }
.preview-content h1, .preview-content h2, .preview-content h3 { color: #1f2937; margin-top: 16px; }
.preview-content code { background: #f1f5f9; padding: 2px 5px; border-radius: 3px; font-size: 12px; }
.preview-content pre { background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; }
.preview-content pre code { background: transparent; color: inherit; padding: 0; }
.preview-content table { border-collapse: collapse; margin: 12px 0; }
.preview-content th, .preview-content td { border: 1px solid #ddd; padding: 6px 12px; }
.preview-content blockquote { border-left: 4px solid #ccc; padding-left: 12px; color: #666; margin-left: 0; }
.error-bar { background: #fee; color: #c00; padding: 10px 14px; border-radius: 6px; margin-top: 16px; font-size: 13px; }
.features { margin-top: 32px; padding: 16px; background: #f0f9ff; border-radius: 8px; }
.features h3 { margin: 0 0 12px 0; }
.features ul { margin: 0; padding-left: 20px; line-height: 1.8; }
</style>