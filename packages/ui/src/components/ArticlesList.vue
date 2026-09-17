<template>
  <div class="articles-list-page">
    <!-- 🇨🇳 R57:简盒 Nav(顶层路由自挂) -->
    <JianheboxToolNav />
    <header class="page-header">
      <h1>📚 简盒 JianHeBox 教程</h1>
      <p class="subtitle">AI 提示词、DeepSeek 使用、AI 副业方向的实战文章</p>
    </header>

    <div class="articles-grid">
      <a v-for="article in articles" :key="article.slug" :href="'#/article/' + article.slug" class="article-card">
        <div class="article-icon">{{ article.icon }}</div>
        <h2 class="article-title">{{ article.title }}</h2>
        <p class="article-desc">{{ article.description }}</p>
        <div class="article-meta">
          <span class="article-words">{{ article.words }} 字</span>
          <span class="article-cta">阅读 →</span>
        </div>
      </a>
    </div>

    <footer class="page-footer">
      <p>更多 AI 工具 → <a href="https://www.jianhebox.cn/#/basic/system">简盒提示词优化器</a></p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import JianheboxToolNav from './JianheboxToolNav.vue'
const articles = [
  {
    slug: 'ai-prompt-guide',
    icon: '✨',
    title: 'AI 提示词优化完全指南',
    description: '从零开始让 AI 听懂你在说什么，5 个万能公式 + 3 个真实案例。',
    words: 4836
  },
  {
    slug: 'deepseek-prompt',
    icon: '🚀',
    title: 'DeepSeek 提示词实战指南',
    description: '让国产最强 AI 听懂你，3 个反常识技巧 + 5 大场景模板。',
    words: 3313
  },
  {
    slug: 'prompt-engineer',
    icon: '💼',
    title: '提示词工程师入门',
    description: '2026 年最被低估的 5 个 AI 副业方向，月入 3000-30000 元的具体路径。',
    words: 6233
  },
  {
    slug: 'wechat-ai',
    icon: '📱',
    title: '用 AI 写公众号爆款的 5 个秘密',
    description: 'AI 工作流 1 天 1 小时，标题/开头/排版/选题/矩阵全攻略。',
    words: 5717
  },
  {
    slug: 'chatgpt-templates',
    icon: '📋',
    title: 'ChatGPT 提示词模板大全',
    description: '50 个直接能用的实战模板，覆盖工作/写作/学习/生活/创作 5 大类。',
    words: 7650
  },
  {
    slug: 'ai-writing-tools',
    icon: '✍️',
    title: 'AI 写作入门',
    description: '0 基础 30 分钟写出第 1 篇可用稿，5 个立竿见影场景 + 3 个底层心法。',
    words: 2611
  },
  {
    slug: 'prompt-debugging',
    icon: '🔧',
    title: '提示词调试技巧',
    description: '改 10 版提示词没用的根因是缺方法，5 步调试法让 AI 输出从 60 分到 90 分。',
    words: 3188
  },
  {
    slug: 'ai-workflow',
    icon: '⚙️',
    title: 'AI 工作流搭建',
    description: '把 AI 串成自动化流水线的 3 个真实案例：自媒体日更、电商客服、知识付费。',
    words: 3911
  },
  {
    slug: 'xiaohongshu-ai',
    icon: '📕',
    title: '用 AI 写小红书爆款',
    description: '小红书 3.5 亿日活，AI 辅助爆款率高 2-3 倍，从找对标到出爆款 5 步流程。',
    words: 3126
  },
  {
    slug: 'ai-side-hustle',
    icon: '💰',
    title: 'AI 副业月入 1 万',
    description: 'AI 副业平均月入 3000-8000，3 个真实可复制项目：简历优化/代运营/工具搭建。',
    words: 3828
  },
  {
    slug: 'role-play-prompt',
    icon: '🎭',
    title: 'AI 角色扮演提示词',
    description: '7 步打造专属 AI 人设：角色卡设计+记忆系统+剧情推进，6 套直接能用的实战模板。',
    words: 3200
  },
  {
    slug: 'chatgpt-xiaohongshu',
    icon: '📕',
    title: 'ChatGPT 做小红书',
    description: '6 步流程把 ChatGPT 变成小红书爆款生产机，3 个真实爆款案例（带涨粉数据）。',
    words: 3300
  },
  {
    slug: 'ai-translation',
    icon: '🌐',
    title: 'AI 翻译技巧',
    description: '8 个让 ChatGPT 翻译质量翻倍的技巧，中英对比表+本地化处理+术语一致性。',
    words: 3800
  },
  {
    slug: 'ai-product-manager',
    icon: '📊',
    title: 'AI 做产品经理',
    description: 'PRD/竞品分析/用户访谈/评审，AI 4 大产品经理工作流的工具组合表+实战模板。',
    words: 3700
  },
  {
    slug: 'ai-writing-speedup',
    icon: '⚡',
    title: 'AI 写作效率提升',
    description: '7 个把写作速度提 3 倍的方法（提效倍数表）+ 真实案例：从 1 篇 3 小时到 1 篇 1 小时。',
    words: 3900
  },
  {
    slug: 'ai-coding',
    icon: '💻',
    title: 'AI 写代码入门',
    description: '用 AI 辅助编程 0 基础到熟练，9 步流程：自然语言 → 提示词 → 调试 → 上线。',
    words: 1894
  },
  {
    slug: 'ai-ppt',
    icon: '📊',
    title: '用 AI 做 PPT',
    description: 'AI 帮你从大纲到成稿，9 步把 PPT 时间从 4 小时压到 30 分钟。',
    words: 2071
  },
  {
    slug: 'ai-sales-letter',
    icon: '💌',
    title: 'AI 做销售信',
    description: 'AI 写销售信的 5 段式框架，从打开率 5% 到 25% 的真实案例。',
    words: 2481
  },
  {
    slug: 'ai-language-learning',
    icon: '🌐',
    title: 'AI 学习外语',
    description: 'AI 帮你练听说读写，9 步用 ChatGPT 提升英语/日语 3 倍效率。',
    words: 2411
  },
  {
    slug: 'ai-video-script',
    icon: '🎬',
    title: 'AI 做视频脚本',
    description: '从主题到分镜到口播稿，9 步用 AI 把视频脚本时间从 4 小时压到 45 分钟。',
    words: 2166
  },
  {
    slug: 'pdf-to-markdown',
    icon: '📄',
    title: 'PDF 转 Markdown',
    description: '3 大免费 PDF 转 MD 工具横评 + 5 分钟实操：从扫描版到加密文档 100% 准。',
    words: 2018
  },
  {
    slug: 'pdf-to-word-free',
    icon: '📝',
    title: 'PDF 转 Word 免费',
    description: '5 个免费 PDF 转 Word 工具横评（在线/桌面/插件），含排版保留度实测。',
    words: 2017
  },
  {
    slug: 'batch-pdf',
    icon: '📚',
    title: '批量处理 PDF',
    description: '100 个 PDF 怎么 5 分钟处理完？网页版/客户端/脚本 3 方案横评。',
    words: 1809
  },
  {
    slug: 'pdf-ocr',
    icon: '🔍',
    title: '扫描版 PDF 转文字',
    description: '3 大 OCR 工具准确率实测（含中文古籍/表格/手写），免费版够用吗？',
    words: 2064
  },
  {
    slug: 'academic-pdf',
    icon: '🎓',
    title: '学术论文 PDF 转 Markdown',
    description: '学生/研究者场景：3 个使用技巧 + 文献/公式/表格保留实测。',
    words: 2224
  },
  {
    slug: 'xhs-title-formulas',
    icon: '📱',
    title: 'AI 写小红书标题',
    description: '6 套爆款标题公式 + 5 大行业模板表，让你的小红书笔记点开率翻倍。',
    words: 1533
  },
  {
    slug: 'ai-video-workflow',
    icon: '🎬',
    title: '用 AI 做短视频',
    description: '从脚本到分镜到剪辑 4 段流水线 + 发布后数据复盘，30 天涨 1 万粉实操。',
    words: 1523
  },
  {
    slug: 'ai-writing-monetize',
    icon: '💰',
    title: 'AI 写作变现',
    description: '5 条 AI 写作变现路径 + 现金流公式，从 0 到月入 5,000 的 90 天实操。',
    words: 1512
  },
  {
    slug: 'ai-conversation',
    icon: '💬',
    title: 'AI 对话技巧',
    description: '10 个让 AI 回答质量翻倍的心法（不是模板），从新手到高手的对话思维框架。',
    words: 1607
  },
  {
    slug: 'ai-ppt-batch',
    icon: '📊',
    title: 'AI 做 PPT 自动生成',
    description: 'Python + AI 批量自动生成 PPT 的完整流水线 + 3 级自动化（从 4 小时到 30 分钟）。',
    words: 1570
  },
  {
    slug: 'ai-painting-prompt',
    icon: '🎨',
    title: 'AI 绘画提示词',
    description: 'Midjourney / 即梦 / 文心一格 6 大画面公式 + 风格关键词速查表。',
    words: 1070
  },
  {
    slug: 'ai-coding-prompt',
    icon: '💻',
    title: 'AI 写代码提示词',
    description: 'Cursor/Copilot 9 步工作流 + 3 套实测模板（重构/调试/单元测试）。',
    words: 1416
  },
  {
    slug: 'ai-ppt-outline',
    icon: '📋',
    title: 'AI 做 PPT 大纲',
    description: '5 段式大纲 + 6 页黄金结构，10 分钟从主题到可演 PPT 大纲。',
    words: 1533
  },
  {
    slug: 'ai-translate-pdf',
    icon: '🌐',
    title: 'AI 翻译 PDF',
    description: 'PDF 翻译 4 步法 + 3 工具横评 + 学术论文场景模板。',
    words: 1380
  },
  {
    slug: 'ai-interview',
    icon: '🎤',
    title: 'AI 面试准备',
    description: 'AI 模拟面试的 5 段流程 + 高频题库 + 回答评估模板。',
    words: 1550
  },
  {
    slug: 'ai-resume',
    icon: '📄',
    title: 'AI 做简历',
    description: 'STAR 公式 + AI 优化简历 7 步，3 个真实案例（从 0 投到 50+ 面）。',
    words: 1481
  },
  {
    slug: 'ai-product-intro',
    icon: '📦',
    title: 'AI 做产品介绍',
    description: 'FAB 公式 + 5 段式产品介绍，PR/官网/PPT 都用得上。',
    words: 1643
  },
  {
    slug: 'ai-market-research',
    icon: '📊',
    title: 'AI 做市场调研',
    description: 'PEST + 3 步流程 + 5 行业模板，2 小时出 1 份专业调研报告。',
    words: 1505
  },
  {
    slug: 'ai-user-research',
    icon: '🗣️',
    title: 'AI 做客户调研',
    description: '漏斗式追问 + 5 问 5 记，1 份访谈记录变 1 份洞察报告。',
    words: 2080
  },
  {
    slug: 'ai-seo',
    icon: '🔍',
    title: 'AI 做 SEO',
    description: 'AI + SEO 实战：关键词挖掘、内容生产、外链建设 3 步全自动。',
    words: 1576
  },
  {
    slug: 'ai-weekly-report',
    icon: '📅',
    title: 'AI 写周报',
    description: '5 段式周报模板 + 3 个真实案例（从"流水账"到"老板想看的报告"）。',
    words: 3000
  },
  {
    slug: 'ai-meeting-minutes',
    icon: '🤝',
    title: 'AI 做会议纪要',
    description: '3 步自动整理会议记录 + 5 段式输出 + 5 类常见场景模板。',
    words: 3000
  },
  {
    slug: 'ai-customer-analysis',
    icon: '👥',
    title: 'AI 做客户分析',
    description: 'RFM 客户分层模型 + 5 步 AI 辅助分析 + 实操案例。',
    words: 3700
  },
  {
    slug: 'ai-email',
    icon: '📧',
    title: 'AI 写邮件',
    description: '4 类邮件模板（冷邮/跟进/道歉/转化）+ 5 段式万能公式。',
    words: 3900
  },
  {
    slug: 'ai-competitor-analysis',
    icon: '🔍',
    title: 'AI 做竞品分析',
    description: '5 维度框架 + 3 工具横评 + 实操模板（含报告输出）。',
    words: 4400
  },
  {
    slug: 'ai-prd',
    icon: '📋',
    title: 'AI 做 PRD',
    description: '4 段式 PRD 模板 + 真实案例 + 工具组合表。',
    words: 4500
  },
  {
    slug: 'ai-interview-deep',
    icon: '🎤',
    title: 'AI 做用户访谈',
    description: '漏斗式追问 5 问 5 记，1 份访谈记录变 1 份洞察报告。',
    words: 4500
  },
  {
    slug: 'ai-data-analysis',
    icon: '📈',
    title: 'AI 做数据分析',
    description: '3 步拆数据 + 5 个可视化建议 + 实战模板。',
    words: 4300
  },
  {
    slug: 'ai-marketing',
    icon: '💰',
    title: 'AI 写营销文案',
    description: 'AIDA 公式 + 5 行业话术模板 + 实测效果。',
    words: 4100
  },
  {
    slug: 'ai-side-hustle-30',
    icon: '💸',
    title: 'AI 副业 30 个真实案例',
    description: '5 大类副业 30 个真实月入案例，按行业/收入/成本分类。',
    words: 9200
  },
  {
    slug: 'fcpx-import-srt',
    icon: '🎬',
    title: 'FCPX 怎么导入 SRT 字幕？3 步搞定',
    description: 'Adobe/DaVinci/剪映做好的字幕如何导入 FCPX。',
    words: 1850
  },
  {
    slug: 'fcpxml-export-srt',
    icon: '📤',
    title: 'FCPXML 转 SRT 给剪映/PR/达芬奇用',
    description: 'FCPX 项目如何分享给其他剪辑软件的用户。',
    words: 1680
  }
]
</script>

<style scoped>
.articles-list-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  color: var(--n-text-color);
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--n-border-color);
}

.page-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 15px;
  opacity: 0.7;
  margin: 0;
}

.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.article-card {
  display: block;
  background: var(--n-card-color);
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  padding: 24px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
}

.article-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: var(--n-primary-color);
}

.article-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.article-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.article-desc {
  font-size: 13px;
  opacity: 0.7;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.article-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  opacity: 0.6;
}

.article-cta {
  color: var(--n-primary-color);
  font-weight: 600;
}

.page-footer {
  text-align: center;
  font-size: 13px;
  opacity: 0.6;
  padding: 24px 0;
  border-top: 1px solid var(--n-border-color);
}

.page-footer a {
  color: var(--n-primary-color);
  text-decoration: none;
  font-weight: 600;
}
</style>
