<template>
  <div class="article-view-page">
    <!-- 🇨🇳 R57:简盒 Nav -->
    <JianheboxToolNav />
    <a href="#/articles" class="back-link">← 返回文章列表</a>
    <article class="article-content" v-if="article">
      <header class="article-header">
        <h1>{{ article.title }}</h1>
        <div class="article-meta-bar">
          <span>📅 {{ article.date }}</span>
          <span>⏱ {{ article.readTime }} 分钟</span>
          <span>🏷 {{ article.tag }}</span>
        </div>
      </header>
      <div class="article-body" v-html="article.content"></div>
      <footer class="article-footer">
        <p>💡 想用 AI 优化你自己的提示词？<a href="https://www.jianhebox.cn/#/basic/system">点这里试简盒</a></p>
      </footer>
    </article>
    <div v-else class="not-found">
      <h2>文章不存在</h2>
      <a href="#/articles">返回列表</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import JianheboxToolNav from './JianheboxToolNav.vue'
import { computed } from 'vue'

const props = defineProps<{ slug: string }>()

// 5 篇文章的元数据
const articleMeta: Record<string, { title: string; date: string; readTime: number; tag: string }> = {
  'ai-prompt-guide': { title: 'AI 提示词优化完全指南', date: '2026-08-26', readTime: 8, tag: '入门' },
  'deepseek-prompt': { title: 'DeepSeek 提示词实战指南', date: '2026-08-26', readTime: 6, tag: 'DeepSeek' },
  'prompt-engineer': { title: '提示词工程师入门', date: '2026-08-26', readTime: 5, tag: '副业' },
  'wechat-ai': { title: '用 AI 写公众号爆款的 5 个秘密', date: '2026-08-26', readTime: 5, tag: '公众号' },
  'chatgpt-templates': { title: 'ChatGPT 提示词模板大全', date: '2026-08-26', readTime: 8, tag: '模板' },
  'ai-writing-tools': { title: 'AI 写作入门', date: '2026-08-26', readTime: 6, tag: '入门' },
  'prompt-debugging': { title: '提示词调试技巧', date: '2026-08-26', readTime: 7, tag: '调试' },
  'ai-workflow': { title: 'AI 工作流搭建', date: '2026-08-26', readTime: 8, tag: '工作流' },
  'xiaohongshu-ai': { title: '用 AI 写小红书爆款', date: '2026-08-26', readTime: 7, tag: '小红书' },
  'ai-side-hustle': { title: 'AI 副业月入 1 万', date: '2026-08-26', readTime: 8, tag: '副业' },
  'role-play-prompt': { title: 'AI 角色扮演提示词', date: '2026-08-26', readTime: 6, tag: '角色' },
  'chatgpt-xiaohongshu': { title: 'ChatGPT 做小红书', date: '2026-08-26', readTime: 6, tag: '小红书' },
  'ai-translation': { title: 'AI 翻译技巧', date: '2026-08-26', readTime: 7, tag: '翻译' },
  'ai-product-manager': { title: 'AI 做产品经理', date: '2026-08-26', readTime: 7, tag: '产品' },
  'ai-writing-speedup': { title: 'AI 写作效率提升', date: '2026-08-26', readTime: 7, tag: '效率' },
  'ai-coding': { title: 'AI 写代码入门', date: '2026-08-26', readTime: 6, tag: '代码' },
  'ai-ppt': { title: '用 AI 做 PPT', date: '2026-08-26', readTime: 6, tag: 'PPT' },
  'ai-sales-letter': { title: 'AI 做销售信', date: '2026-08-26', readTime: 7, tag: '销售' },
  'ai-language-learning': { title: 'AI 学习外语', date: '2026-08-26', readTime: 7, tag: '语言' },
  'ai-video-script': { title: 'AI 做视频脚本', date: '2026-08-26', readTime: 6, tag: '视频' },
  'pdf-to-markdown': { title: 'PDF 转 Markdown', date: '2026-08-26', readTime: 6, tag: 'PDF' },
  'pdf-to-word-free': { title: 'PDF 转 Word 免费', date: '2026-08-26', readTime: 6, tag: 'PDF' },
  'batch-pdf': { title: '批量处理 PDF', date: '2026-08-26', readTime: 5, tag: 'PDF' },
  'pdf-ocr': { title: '扫描版 PDF 转文字', date: '2026-08-26', readTime: 6, tag: 'OCR' },
  'academic-pdf': { title: '学术论文 PDF 转 Markdown', date: '2026-08-26', readTime: 6, tag: '论文' },
  'xhs-title-formulas': { title: 'AI 写小红书标题', date: '2026-08-27', readTime: 5, tag: '小红书' },
  'ai-video-workflow': { title: '用 AI 做短视频', date: '2026-08-27', readTime: 5, tag: '短视频' },
  'ai-writing-monetize': { title: 'AI 写作变现', date: '2026-08-27', readTime: 5, tag: '变现' },
  'ai-conversation': { title: 'AI 对话技巧', date: '2026-08-27', readTime: 5, tag: '对话' },
  'ai-ppt-batch': { title: 'AI 做 PPT 自动生成', date: '2026-08-27', readTime: 5, tag: 'PPT' },
  'ai-painting-prompt': { title: 'AI 绘画提示词', date: '2026-08-27', readTime: 5, tag: '绘画' },
  'ai-coding-prompt': { title: 'AI 写代码提示词', date: '2026-08-27', readTime: 5, tag: '编程' },
  'ai-ppt-outline': { title: 'AI 做 PPT 大纲', date: '2026-08-27', readTime: 5, tag: 'PPT' },
  'ai-translate-pdf': { title: 'AI 翻译 PDF', date: '2026-08-27', readTime: 5, tag: '翻译' },
  'ai-interview': { title: 'AI 面试准备', date: '2026-08-27', readTime: 5, tag: '面试' },
  'ai-resume': { title: 'AI 做简历', date: '2026-08-27', readTime: 5, tag: '简历' },
  'ai-product-intro': { title: 'AI 做产品介绍', date: '2026-08-27', readTime: 5, tag: '产品' },
  'ai-market-research': { title: 'AI 做市场调研', date: '2026-08-27', readTime: 5, tag: '调研' },
  'ai-user-research': { title: 'AI 做客户调研', date: '2026-08-27', readTime: 5, tag: '调研' },
  'ai-seo': { title: 'AI 做 SEO', date: '2026-08-27', readTime: 5, tag: 'SEO' },
  'ai-weekly-report': { title: 'AI 写周报', date: '2026-08-27', readTime: 7, tag: '工作' },
  'ai-meeting-minutes': { title: 'AI 做会议纪要', date: '2026-08-27', readTime: 7, tag: '工作' },
  'ai-customer-analysis': { title: 'AI 做客户分析', date: '2026-08-27', readTime: 8, tag: '客户' },
  'ai-email': { title: 'AI 写邮件', date: '2026-08-27', readTime: 8, tag: '邮件' },
  'ai-competitor-analysis': { title: 'AI 做竞品分析', date: '2026-08-27', readTime: 9, tag: '竞品' },
  'ai-prd': { title: 'AI 做 PRD', date: '2026-08-27', readTime: 9, tag: '产品' },
  'ai-interview-deep': { title: 'AI 做用户访谈', date: '2026-08-27', readTime: 9, tag: '调研' },
  'ai-data-analysis': { title: 'AI 做数据分析', date: '2026-08-27', readTime: 8, tag: '数据' },
  'ai-marketing': { title: 'AI 写营销文案', date: '2026-08-27', readTime: 8, tag: '营销' },
  'ai-side-hustle-30': { title: 'AI 副业 30 个真实案例', date: '2026-08-27', readTime: 15, tag: '副业' }
}

const article = computed(() => {
  const meta = articleMeta[props.slug]
  if (!meta) return null
  return { ...meta, content: `<p>文章内容已部署。完整版访问 <a href="https://github.com/colorfulboys/prompt-optimizer/tree/main/docs/articles">GitHub 仓库</a> 查看。</p><p>这是简盒 JianHeBox SEO 文章系列的第 1 篇。当前为骨架，正式内容由 Mavis 自动维护。</p>` }
})
</script>

<style scoped>
.article-view-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 24px;
  color: var(--n-text-color);
}

.back-link {
  display: inline-block;
  margin-bottom: 24px;
  color: var(--n-primary-color);
  text-decoration: none;
  font-size: 14px;
}

.back-link:hover {
  text-decoration: underline;
}

.article-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--n-border-color);
}

.article-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px 0;
  line-height: 1.3;
}

.article-meta-bar {
  display: flex;
  gap: 16px;
  font-size: 13px;
  opacity: 0.7;
}

.article-body {
  font-size: 16px;
  line-height: 1.8;
}

.article-body :deep(h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 32px 0 16px 0;
  padding-top: 16px;
  border-top: 1px solid var(--n-border-color);
}

.article-body :deep(h3) {
  font-size: 19px;
  font-weight: 600;
  margin: 24px 0 12px 0;
}

.article-body :deep(p) {
  margin: 0 0 16px 0;
}

.article-body :deep(a) {
  color: var(--n-primary-color);
  text-decoration: none;
}

.article-body :deep(a:hover) {
  text-decoration: underline;
}

.article-body :deep(code) {
  background: var(--n-color-embedded);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
}

.article-body :deep(pre) {
  background: var(--n-color-embedded);
  padding: 12px 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.article-body :deep(blockquote) {
  border-left: 4px solid var(--n-primary-color);
  padding-left: 16px;
  margin: 16px 0;
  opacity: 0.85;
}

.article-footer {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--n-border-color);
  text-align: center;
  font-size: 14px;
  opacity: 0.8;
}

.article-footer a {
  color: var(--n-primary-color);
  text-decoration: none;
  font-weight: 600;
}

.not-found {
  text-align: center;
  padding: 60px 20px;
}

.not-found a {
  display: inline-block;
  margin-top: 16px;
  color: var(--n-primary-color);
  text-decoration: none;
}
</style>
