<template>
  <div class="landing">
    <!-- 🇨🇳 2026-09-02 R44:顶部导航栏 + 全部工具下拉(用户不滚动也能找到{{ t('nav.home') }}) -->
    <header class="nav" :class="{ 'nav-scrolled': navScrolled }">
      <div class="nav-inner">
        <router-link to="/" class="logo">
          <JianheboxLogo />
        </router-link>

        <!-- 顶部主导航(常驻) -->
        <nav class="nav-links" aria-label="主导航">
          <!-- 全部工具下拉(核心 R44 新增) -->
          <div
            class="nav-tools-trigger"
            @mouseenter="toolsMenuOpen = true"
            @mouseleave="onToolsMenuLeave"
          >
            <button
              class="nav-link nav-tools-btn"
              :class="{ 'is-open': toolsMenuOpen }"
              @click.stop="toggleToolsMenu"
            >
              <span class="nav-tools-icon">▦</span>
              <span>{{ t('nav.home') }}</span>
              <span class="nav-tools-count">{{ allTools.length }}</span>
              <span class="nav-caret">▾</span>
            </button>
            <!-- 🇨🇳 R44:下拉面板 — 不用 teleport,因为 teleport 后 scoped CSS 失效导致背景/blur 都没了 -->
            <div
              v-show="toolsMenuOpen"
              class="nav-tools-panel"
              :style="dropdownPosition"
              @mouseenter="cancelToolsMenuLeave"
              @mouseleave="onToolsMenuLeave"
              @click.stop
            >
                <div class="nav-tools-grid">
                  <div v-for="cat in categoryKeys" :key="cat" class="nav-tools-col" v-show="toolsByCategory[cat].length > 0">
                    <div class="nav-tools-cat-title">{{ categoryName[cat] || cat }}</div>
                    <router-link
                      v-for="tool in toolsByCategory[cat]"
                      :key="tool.id"
                      :to="tool.path"
                      class="nav-tools-item"
                      @click="closeToolsMenu"
                    >
                      <span class="nav-tools-emoji">{{ tool.emoji }}</span>
                      <span class="nav-tools-name">{{ tool.name }}</span>
                      <span v-if="tool.tags && tool.tags.includes('NEW')" class="nav-tools-mini-tag tag-new">NEW</span>
                      <span v-if="tool.tags && tool.tags.includes('BETA')" class="nav-tools-mini-tag tag-beta">BETA</span>
                    </router-link>
                  </div>
                </div>
            </div>
          </div>

        </nav>


        <!-- R57.8 教程链接(指向文章列表页) -->
        <a href="/articles.html" class="nav-link nav-articles-link">📚 {{ t('nav.tutorials') }}</a>

        <router-link :to="PRIMARY_TOOL?.path || '/tools/fcpxml'" class="btn btn-primary nav-cta">{{ PRIMARY_TOOL?.emoji || "🎬" }} {{ PRIMARY_TOOL?.name?.split(' ')[0] || "FCPXML" }} →</router-link>
        <!-- 🇨🇳 2026-08-31:M2 全局登录按钮 -->
        <GlobalUserArea />
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="hero-tag">{{ allTools.length }} 个工具 · 字幕 / 音频 / 视频 / 图片 — 全部在浏览器里跑</div>
        <h1>{{ t('hero.title') }}<br /><span class="blue">{{ t('hero.titleAccent') }}</span></h1>
        <p class="subtitle">
          {{ t('hero.subtitle') }}
        </p>
        <div class="hero-cta">
          <router-link :to="PRIMARY_TOOL?.path || '/tools/fcpxml'" class="btn btn-primary">打开 {{ PRIMARY_TOOL?.name || t("tools.fcpxml.name") }}</router-link>
          <a href="#" class="btn btn-secondary" @click.prevent="scrollToId('tools-grid')">查看全部工具</a>
        </div>
      </section>

      <!-- 主推工具(Featured) -->
      <!-- 🇨🇳 R45:主推工具展示区(沿用 FCPXML 的代码 preview 设计,因为它就是当前主推)
           标题/CTA 用 PRIMARY_TOOL 动态取,以后换主推自动改 -->
      <section class="featured">
        <div class="featured-card">
          <div class="featured-inner">
            <div class="featured-info">
              <span class="badge">★ {{ t("common.featured") }}</span>
              <h2>{{ PRIMARY_TOOL?.name || t("tools.fcpxml.name") }}</h2>
              <p>
                <strong>{{ (PRIMARY_TOOL?.desc || "").split(" · ")[0] }}</strong>. 打开后查看更多详情。
              </p>
              <router-link :to="PRIMARY_TOOL?.path || '/tools/fcpxml'" class="btn btn-primary">
                {{ t("common.use") }}
                <svg viewBox="0 0 12 12" fill="none">
                  <path d="M2 6h7m-3-3l3 3-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </router-link>
            </div>
            <div class="featured-preview" aria-hidden="true">
              <div class="head">FCPXML 预览</div>
              <div class="line"><span class="num">01</span> <span class="tag">&lt;fcpxml</span> <span class="attr">version</span>=<span class="str">"1.14"</span><span class="tag">&gt;</span></div>
              <div class="line"><span class="num">02</span> &nbsp;&nbsp;<span class="tag">&lt;resources&gt;</span></div>
              <div class="line"><span class="num">03</span> &nbsp;&nbsp;&nbsp;&nbsp;<span class="tag">&lt;format</span> <span class="attr">name</span>=<span class="str">"FFVideoFormat1920x1080p50"</span><span class="tag">/&gt;</span></div>
              <div class="line"><span class="num">04</span> &nbsp;&nbsp;&nbsp;&nbsp;<span class="tag">&lt;effect</span> <span class="attr">uid</span>=<span class="str">".../Subtitle.moti"</span><span class="tag">/&gt;</span></div>
              <div class="line"><span class="num">05</span> &nbsp;&nbsp;<span class="tag">&lt;/resources&gt;</span></div>
              <div class="line"><span class="num">06</span> &nbsp;&nbsp;<span class="tag">&lt;spine&gt;</span></div>
              <div class="line"><span class="num">07</span> &nbsp;&nbsp;&nbsp;&nbsp;<span class="tag">&lt;title</span> <span class="attr">offset</span>=<span class="str">"82/50s"</span><span class="tag">&gt;</span></div>
              <div class="line"><span class="num">08</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="plain">Hello, this is the first subtitle</span></div>
              <div class="line"><span class="num">09</span> &nbsp;&nbsp;&nbsp;&nbsp;<span class="tag">&lt;/title&gt;</span></div>
              <div class="line"><span class="num">10</span> &nbsp;&nbsp;<span class="tag">&lt;/spine&gt;</span></div>
              <div class="line"><span class="num">11</span> <span class="tag">&lt;/fcpxml&gt;</span></div>
            </div>
          </div>
        </div>
      </section>

      <!-- 工具网格(从 tools.ts 工具注册表读,R44 新增) -->
      <section class="tools-grid" id="tools-grid">
        <div class="tools-grid-head">
          <h2>{{ t('nav.home') }} · <span class="tools-count">{{ allTools.length }} 个</span></h2>
          <p>{{ t('tools.sectionSubtitle') }}</p>
        </div>

        <!-- 按分类展示 -->
        <div class="tools-categories">
          <div v-for="cat in categoryKeys" :key="cat" class="tools-category" v-show="toolsByCategory[cat].length > 0">
            <h3 class="tools-category-title">{{ categoryName[cat] || cat }}</h3>
            <div class="grid">
              <router-link
                v-for="tool in toolsByCategory[cat]"
                :key="tool.id"
                :to="tool.path"
                class="grid-card tool-card"
                :class="{ 'tool-card-featured': tool.featured }"
              >
                <div class="tool-card-emoji">{{ tool.emoji }}</div>
                <div class="tool-card-body">
                  <div class="tool-card-head">
                    <h3>{{ tool.name }}</h3>
                    <span v-for="tag in tool.tags" :key="tag" class="tool-card-tag" :class="`tag-${tag.toLowerCase()}`">{{ tag }}</span>
                  </div>
                  <p>{{ tool.desc }}</p>
                </div>
                <span class="arrow-link">{{ t('tools.open') }}</span>
              </router-link>
            </div>
          </div>
        </div>

        <!-- 老式硬编码 fallback(若 tools.ts 出问题,这里兜底)
             2026-09-02:保留 5 个手动卡片,确保即使 import 失败,主页仍可看到工具入口 -->
        <div v-if="allTools.length === 0" class="grid">
          <router-link to="/tools/fcpxml" class="grid-card">
            <div class="icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6" />
                <path d="M3 9h18M7 13h4M7 16h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <h3>{{ t('tools.fcpxml.name') }}</h3>
            <p>{{ t('tools.fcpxml.desc') }}</p>
            <span class="arrow-link">{{ t('tools.open') }}</span>
          </router-link>
          <router-link to="/tools/qr" class="grid-card">
            <div class="icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" stroke="currentColor" stroke-width="1.6" />
                <rect x="13" y="3" width="8" height="8" stroke="currentColor" stroke-width="1.6" />
                <rect x="3" y="13" width="8" height="8" stroke="currentColor" stroke-width="1.6" />
                <rect x="13" y="13" width="3" height="3" stroke="currentColor" stroke-width="1.6" />
                <rect x="17" y="17" width="4" height="4" stroke="currentColor" stroke-width="1.6" />
              </svg>
            </div>
            <h3>{{ t('tools.qr.name') }}</h3>
            <p>{{ t('tools.qr.desc') }}</p>
            <span class="arrow-link">{{ t('tools.open') }}</span>
          </router-link>
        </div>
      </section>

      <!-- R57.8: 实用教程(指向真文章 HTML,不在 SPA 路由里) -->
      <section class="articles-section">
        <div class="section-inner">
          <h2 class="section-title">📚 {{ t('tutorials.sectionTitle') }}</h2>
          <p class="section-sub">{{ t('tutorials.sectionSubtitle') }}</p>
          <div class="articles-grid">
            <a href="/article-fcpxml-guide.html" class="article-card">
              <div class="article-icon">🎬</div>
              <h3>{{ t("tutorials.articles.fcpxml") }}</h3>
              <p>{{ t('tutorials.articles.fcpxmlDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-ai-prompt-engineer.html" class="article-card">
              <div class="article-icon">✨</div>
              <h3>{{ t('tutorials.articles.prompt') }}</h3>
              <p>{{ t('tutorials.articles.promptDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-free-ai-tools-2026.html" class="article-card">
              <div class="article-icon">🛠️</div>
              <h3>{{ t("tutorials.articles.freeTools") }}</h3>
              <p>{{ t('tutorials.articles.freeToolsDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-video-compress.html" class="article-card">
              <div class="article-icon">🎥</div>
              <h3>{{ t("tutorials.articles.videoCompress") }}</h3>
              <p>{{ t('tutorials.articles.videoCompressDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-mp4-to-gif.html" class="article-card">
              <div class="article-icon">🎞️</div>
              <h3>{{ t("tutorials.articles.gif") }}</h3>
              <p>{{ t('tutorials.articles.gifDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-video-watermark-removal.html" class="article-card">
              <div class="article-icon">🚫</div>
              <h3>{{ t("tutorials.articles.watermark") }}</h3>
              <p>{{ t('tutorials.articles.watermarkDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-pdf-to-word.html" class="article-card">
              <div class="article-icon">📄</div>
              <h3>{{ t("tutorials.articles.pdfWord") }}</h3>
              <p>{{ t('tutorials.articles.pdfWordDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-pdf-to-markdown.html" class="article-card">
              <div class="article-icon">📝</div>
              <h3>{{ t("tutorials.articles.pdfMd") }}</h3>
              <p>{{ t('tutorials.articles.pdfMdDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-pdf-ocr.html" class="article-card">
              <div class="article-icon">🔍</div>
              <h3>{{ t("tutorials.articles.pdfOcr") }}</h3>
              <p>{{ t('tutorials.articles.pdfOcrDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-image-compress.html" class="article-card">
              <div class="article-icon">🖼️</div>
              <h3>{{ t("tutorials.articles.imgCompress") }}</h3>
              <p>{{ t('tutorials.articles.imgCompressDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-old-photo-restore.html" class="article-card">
              <div class="article-icon">📸</div>
              <h3>{{ t("tutorials.articles.oldPhoto") }}</h3>
              <p>{{ t('tutorials.articles.oldPhotoDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-ai-image-cutout.html" class="article-card">
              <div class="article-icon">✂️</div>
              <h3>{{ t("tutorials.articles.cutout") }}</h3>
              <p>{{ t('tutorials.articles.cutoutDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-xiaohongshu-ai.html" class="article-card">
              <div class="article-icon">📕</div>
              <h3>{{ t("tutorials.articles.xhs") }}</h3>
              <p>{{ t('tutorials.articles.xhsDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-wechat-ai.html" class="article-card">
              <div class="article-icon">📱</div>
              <h3>{{ t("tutorials.articles.wechat") }}</h3>
              <p>{{ t('tutorials.articles.wechatDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
            <a href="/article-deepseek-prompt.html" class="article-card">
              <div class="article-icon">🚀</div>
              <h3>{{ t("tutorials.articles.deepseek") }}</h3>
              <p>{{ t('tutorials.articles.deepseekDesc') }}</p>
              <span class="article-cta">{{ t('tutorials.readMore') }}</span>
            </a>
          </div>
        </div>
      </section>

      <!-- 功能特性 -->
    </main>

    <footer>
      <div class="footer-inner">
        <div class="footer-bottom">
          <span class="footer-meta">{{ t('footer.copyright') }} · <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" title="京ICP备2026058075号">京ICP备2026058075号-1</a> · v2026-09-16-seo · <a href="/sitemap.html">{{ t('footer.allTutorials') }}</a> · <a href="/about.html">关于</a> · <a href="/contact.html">联系</a> · <a href="/privacy.html">隐私</a> · <a href="/terms.html">条款</a></span>
          <div class="footer-links">
            <router-link :to="PRIMARY_TOOL?.path || '/tools/fcpxml'">{{ PRIMARY_TOOL?.name?.split(' ')[0] || "FCPXML" }}</router-link>
            <router-link to="/basic/system">{{ t('tools.ai.name') }}</router-link>
            <a href="https://www.jianhebox.cn">jianhebox.cn</a>
            <a href="/articles.html">{{ t('footer.allTutorials') }}</a>
            <FeedbackButton />
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
const { t, locale } = useI18n()
import { useAuthStore } from '@/stores/auth'
import GlobalUserArea from './GlobalUserArea.vue'
import JianheboxLogo from './JianheboxLogo.vue'
import FeedbackButton from './FeedbackButton.vue'

// 🇨🇳 2026-09-02 R44:工具注册表(集中管理,所有地方读这里)
import { TOOLS, TOOLS_BY_CATEGORY, CATEGORY_NAME, PRIMARY_TOOL, type ToolCategory } from '@/config/tools'

// 🇨🇳 2026-09-01 R41:登录后简化 nav(只留 mobile-show 工具入口 + "立即打开"),避免挤压
const auth = useAuthStore()
const loggedIn = computed(() => auth.isLoggedIn)

const scrollToId = (id: string) => {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// 🇨🇳 R44:工具区渲染
const allTools = computed(() => TOOLS)
const toolsByCategory = computed(() => TOOLS_BY_CATEGORY)
const categoryName = computed(() => CATEGORY_NAME)
const categoryKeys = computed(() => Object.keys(CATEGORY_NAME) as ToolCategory[])

// 🇨🇳 R44:工具下拉菜单
const toolsMenuOpen = ref(false)
// 🇨🇳 R57.8:教程下拉菜单
const articlesMenuOpen = ref(false)
let articlesLeaveTimer: ReturnType<typeof setTimeout> | null = null
function onArticlesMenuLeave() {
  if (articlesLeaveTimer) clearTimeout(articlesLeaveTimer)
  articlesLeaveTimer = setTimeout(() => { articlesMenuOpen.value = false }, 150)
}
function cancelArticlesMenuLeave() {
  if (articlesLeaveTimer) { clearTimeout(articlesLeaveTimer); articlesLeaveTimer = null }
}
function closeArticlesMenu() {
  articlesMenuOpen.value = false
  if (articlesLeaveTimer) { clearTimeout(articlesLeaveTimer); articlesLeaveTimer = null }
}
// 鼠标从 trigger 移到 panel 的过程中允许 ~150ms 缓冲,避免路径上空白触发 mouseleave
let leaveTimer: ReturnType<typeof setTimeout> | null = null
// 记录"刚被 toggle 过",避免 document listener 在同一 click 事件里立刻关掉
let justToggled = false
function onToolsMenuLeave() {
  if (leaveTimer) clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => { toolsMenuOpen.value = false }, 150)
}
function cancelToolsMenuLeave() {
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
}
function closeToolsMenu() {
  toolsMenuOpen.value = false
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
  // 🇨🇳 R44:清除 inline display,让 CSS 的 display:none/hover规则生效
  const panel = document.querySelector('.nav-tools-panel') as HTMLElement | null
  if (panel) panel.style.display = 'none'
}
function toggleToolsMenu() {
  // 🇨🇳 R44:点击按钮只在关闭时触发;菜单已开则保持(防止 hover 后点击反而关闭)
  if (toolsMenuOpen.value) return
  toolsMenuOpen.value = true
  nextTick(() => {
    const panel = document.querySelector('.nav-tools-panel') as HTMLElement | null
    if (!panel) return
    panel.style.display = 'block'
    updateDropdownPosition()
  })
}
// 位置 — panel 相对于 trigger 按钮(用 getBoundingClientRect 算坐标)
const dropdownPosition = ref({ top: '0px', left: '0px' })
const navToolsBtnRef = ref<HTMLElement | null>(null)
const navToolsPanelRef = ref<HTMLElement | null>(null)
function updateDropdownPosition() {
  const btn = document.querySelector('.nav-tools-btn') as HTMLElement | null
  const panel = document.querySelector('.nav-tools-panel') as HTMLElement | null
  if (!btn) return
  const r = btn.getBoundingClientRect()
  // 测一下 panel 实际宽度(响应式),居中于按钮下方
  const panelWidth = panel?.offsetWidth || 560
  // 留 12px 边距,防止 panel 顶到屏幕边缘
  const margin = 12
  const viewportW = window.innerWidth
  let left = r.left + r.width / 2 - panelWidth / 2
  if (left < margin) left = margin
  if (left + panelWidth > viewportW - margin) left = viewportW - panelWidth - margin
  dropdownPosition.value = {
    top: `${r.bottom + 16}px`,
    left: `${left}px`,
  }
}
// 监听打开时定位 + resize/scroll 重定位
watch(toolsMenuOpen, (open) => {
  if (open) {
    // 🇨🇳 R44:watcher 里也更新位置,防止 toggle 流程没赶上
    nextTick(() => updateDropdownPosition())
    document.addEventListener('click', onDocClick)
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
  } else {
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('resize', updateDropdownPosition)
    window.removeEventListener('scroll', updateDropdownPosition, true)
  }
})
function onDocClick(e: MouseEvent) {
  // 🇨🇳 R44:点击外部时直接关闭;点击 trigger/panel 本身时保持打开
  const target = e.target as HTMLElement
  if (target.closest('.nav-tools-trigger') || target.closest('.nav-tools-panel')) return
  closeToolsMenu()
}

// 🇨🇳 R44:滚动时给 nav 加 scrolled 状态(更精致)
const navScrolled = ref(false)
const onScroll = () => {
  navScrolled.value = window.scrollY > 30
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
  // 🇨🇳 R44:清除 hover 定时器,防止旧实例的 timer 关掉新页面的面板
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
})
</script>

<style scoped>
/* LandingPage 局部样式 — Framer 风格,黑底蓝紫 */
.landing {
  --void: #000000;
  --near-black: #090909;
  --white: #ffffff;
  --silver: #a6a6a6;
  --ghost: rgba(255, 255, 255, 0.6);
  --frosted: rgba(255, 255, 255, 0.1);
  --frosted-hover: rgba(255, 255, 255, 0.15);
  --blue: #0099ff;
  --blue-glow: rgba(0, 153, 255, 0.15);

  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  background: var(--void);
  color: var(--white);
  font-family: var(--font-sans);
  font-weight: 400;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  font-feature-settings: 'cv01', 'cv05', 'cv09', 'cv11', 'ss03', 'ss07';
}

/* 🇨🇳 2026-08-31 M3.7:不要 padding: 0 重置所有元素 — 会让 .btn 的 padding 失效,
   改成只对 .landing > div, .landing > section 等布局容器 reset box-sizing,
   不去碰 button/a/input 等具体元素的 padding */
.landing { box-sizing: border-box; }
.landing > * { box-sizing: border-box; margin: 0; }
.landing button,
.landing input,
.landing select,
.landing textarea,
.landing a {
  box-sizing: border-box;
}
/* ⚠️ M3 修复:不再让 a 强制 inherit 父级 color
   否则会覆盖 .btn-primary 的 color: var(--color-primary-text)=#000,
   导致白底按钮里的字也是白色完全不可见 */
.landing a:not(.btn):not([class*="btn "]) { color: inherit; text-decoration: none; }
.landing button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }

/* === NAV === */
.landing .nav {
  position: sticky;
  top: 16px;
  z-index: 100;
  max-width: 1200px;
  margin: 16px auto 0;
  padding: 0 20px;
}
.landing .nav-inner {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 100px;
  padding: 6px 18px 6px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  height: 52px;  /* 🇨🇳 2026-08-31 M3.9:固定 52px(原来 min-height 让已登录态会撑开,现在锁死高度) */
  box-shadow: rgba(255, 255, 255, 0.05) 0px 0.5px 0px 0.5px, rgba(0, 0, 0, 0.5) 0px 10px 30px;
}
/* 🇨🇳 2026-08-31 M3.9 R33:logo 模板已迁移到 JianheboxLogo,这里只保留 .logo 容器的 flex 布局 */
.landing .logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
  white-space: nowrap;
}
/* 🇨🇳 2026-08-31 M3.9 R33:删除 .logo-mark / .logo-text / .logo-sub 死代码(模板里已用 <JianheboxLogo />) */
.landing .nav-links {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-shrink: 1;  /* 🇨🇳 2026-08-31 M3.9:nav-links 是 flex item,可压缩 */
  min-width: 0;  /* 🇨🇳 2026-08-31 M3.9:允许 flex 容器收缩到内容以下 */
}
.landing .nav-links a {
  font-size: 14px;
  font-weight: 400;
  color: var(--white);
  opacity: 0.7;
  padding: 6px 12px;
  white-space: nowrap;  /* 🇨🇳 2026-08-31 M3.6:中文按字符断行 */
  border-radius: 9999px;
  border: 1px solid transparent;
  transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.landing .nav-links a:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
}

/* 🇨🇳 2026-09-02 R44:顶部 nav 链接(统一规范)— 全部 nav-link 无边框透明,
   hover 半透明背景,只有"主推工具立即打开"是实心大按钮 nav-cta */
.landing .nav-link,
.landing .nav-tools-btn {
  font-size: 14px;
  font-weight: 400;
  color: var(--white);
  opacity: 0.65;
  padding: 6px 12px;
  white-space: nowrap;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: opacity 0.15s ease, background 0.15s ease;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  text-decoration: none;
  line-height: 1.2;
}
.landing .nav-link:hover,
.landing .nav-tools-btn:hover,
.landing .nav-tools-btn.is-open {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}
.landing .nav-tools-btn.is-open {
  background: rgba(0, 153, 255, 0.14);
  color: var(--blue);
  opacity: 1;
}
.landing .nav-tools-icon {
  font-size: 15px;
  opacity: 0.9;
  margin-right: -2px;
}
.landing .nav-tools-count {
  font-size: 11px;
  font-family: 'SF Mono', ui-monospace, monospace;
  color: var(--blue);
  background: rgba(0, 153, 255, 0.12);
  border-radius: 6px;
  padding: 1px 5px;
  margin-left: 2px;
}
.landing .nav-caret {
  font-size: 9px;
  opacity: 0.5;
  margin-left: 2px;
  transition: transform 0.15s ease;
}
.landing .nav-tools-btn.is-open .nav-caret {
  transform: rotate(180deg);
  opacity: 0.8;
}

/* 🇨🇳 R44:工具下拉面板(用户鼠标悬停"🛠 {{ t('nav.home') }}"按钮即展开) */
.landing .nav-tools-trigger {
  position: relative;
}
/* 🇨🇳 R44:工具下拉面板(用户点击"{{ t('nav.home') }}"展开)
   🇨🇳 修正:必须用 fixed 定位 + JS 设坐标,不能用 absolute + calc(100%)
   原因:teleport 到 body 后,trigger 的 relative 父级丢失 */
.landing .nav-tools-panel {
  position: fixed;  /* 不能用 absolute — teleport 后没有 relative 祖先 */
  background: #0f0f0f;  /* 🇨🇳 R45:headless Chrome 渲染 rgba 时 backdrop-filter 失效会透,改用实色 */
  border: 1px solid rgba(0, 153, 255, 0.3);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 153, 255, 0.1);
  min-width: 560px;
  z-index: 999;
  animation: navToolsFadeIn 0.18s ease;
}
/* 🇨🇳 R44:不用 transform(会和 JS 算的 left 冲突导致 panel 位置跳),只做 opacity 淡入 */
@keyframes navToolsFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.landing .nav-tools-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.landing .nav-tools-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.landing .nav-tools-cat-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--silver);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 8px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 4px;
}
.landing .nav-tools-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--white);
  font-size: 13px;
  transition: background 0.12s ease;
}
.landing .nav-tools-item:hover {
  background: rgba(0, 153, 255, 0.12);
}
.landing .nav-tools-emoji {
  font-size: 16px;
  line-height: 1;
}
.landing .nav-tools-name {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.landing .nav-tools-mini-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.3px;
  font-family: var(--font-mono);
  flex-shrink: 0;
}
.landing .nav-tools-mini-tag.tag-new {
  background: rgba(0, 153, 255, 0.25);
  color: var(--blue);
}
.landing .nav-tools-mini-tag.tag-beta {
  background: rgba(255, 180, 0, 0.2);
  color: #ffcc66;
}
/* 🇨🇳 R44:滚动时 nav 状态(scrolled 加深背景) */
.landing .nav-scrolled .nav-inner {
  background: rgba(0, 0, 0, 0.85);
  border-color: rgba(255, 255, 255, 0.12);
}

/* 🇨🇳 R44:窄屏处理(下拉单列)— 用 max-width,left 改由 JS 算 */
@media (max-width: 1024px) {
  .landing .nav-tools-panel {
    min-width: 90vw;
    max-width: 90vw;
  }
  .landing .nav-tools-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .landing .nav-tools-panel {
    min-width: 92vw;
    max-width: 92vw;
  }
  .landing .nav-tools-grid {
    grid-template-columns: 1fr;
  }
  /* 🇨🇳 2026-08-31 M3.9 R35:窄屏整个隐藏 nav-links(主页本身就是工具目录),只留 logo + 登录按钮 */
  .landing .nav-links { display: none; }
}
.landing .nav-cta.btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  background: var(--color-primary);
  color: var(--color-primary-text);
  border: 1px solid transparent;
  white-space: nowrap;
}
.landing .nav-cta.btn:hover {
  background: var(--color-primary-hover);
}
@media (max-width: 1024px) {
  /* 🇨🇳 2026-08-31 M3.6:中等宽度(1024px 以下)就折叠次要 nav 链接 */
  .landing .nav-links a:not(.btn):not(.mobile-show) { display: none; }
}

/* 🇨🇳 2026-09-01 R41:窄屏 < 1024 隐藏外层 nav-cta */
@media (max-width: 1024px) {
  .landing .nav-cta.btn { display: none; }
}

/* 🇨🇳 2026-09-01 R41:登录后"立即打开"按钮靠右紧贴 GlobalUserArea */
.landing .nav-cta.btn {
  background: #ffffff;
  color: #111;
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}
.landing .nav-cta.btn:hover {
  background: #3b82f6;
  color: #ffffff;
}
@media (max-width: 720px) {
  /* 🇨🇳 2026-08-31 M3.9 R35:窄屏整个隐藏 nav-links(主页本身就是工具目录),只留 logo + 登录按钮 */
  .landing .nav-links { display: none; }
  .landing .nav-cta.btn { display: none; }
  .landing .nav {
    padding: 0 12px; /* 移动端 nav 容器更窄 padding,给 nav-inner 留更多空间 */
  }
  .landing .nav-inner {
    padding: 6px 8px 6px 14px;
    gap: 8px; /* 移动端 gap 更小 */
    /* 🇨🇳 2026-09-01 R37 需求3:nav-inner 相对定位,GlobalUserArea 绝对定位右侧(跟 JianheboxToolNav 一致) */
    position: relative;
  }
  .landing .nav-links {
    gap: 8px;
  }
  /* 🇨🇳 2026-09-01 R37 需求3:GlobalUserArea 锚定右侧,不再被 flex flow 挤出视口 */
  .landing .nav-inner > :deep(.global-user-area) {
    position: absolute !important;
    right: 8px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
  }
}

/* === HERO === */
.landing main { padding-top: 1px; }
.landing .hero {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 32px 60px;
  text-align: center;
}
.landing .hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 100px;
  background: var(--frosted);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  font-weight: 500;
  color: var(--white);
  margin-bottom: 32px;
  backdrop-filter: blur(10px);
}
.landing .hero-tag::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--blue);
  box-shadow: 0 0 8px var(--blue);
}
.landing .hero h1 {
  font-size: 96px;
  font-weight: 700;
  line-height: 0.95;
  letter-spacing: -4.5px;
  color: var(--white);
  max-width: 1000px;
  margin: 0 auto 24px;
}
.landing .hero h1 .blue { color: var(--blue); }
.landing .hero p.subtitle {
  font-size: 19px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--silver);
  max-width: 600px;
  margin: 0 auto 40px;
}
.landing .hero-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.landing .hero-cta .btn {
  white-space: nowrap;  /* 🇨🇳 R45:主推工具名长时不要换行 */
  flex-shrink: 0;
}

@media (max-width: 800px) {
  .landing .hero h1 { font-size: 48px; letter-spacing: -2.2px; line-height: 1.0; }
  .landing .hero p.subtitle { font-size: 16px; }
}
@media (max-width: 480px) {
  .landing .hero h1 { font-size: 38px; letter-spacing: -1.6px; }
}

/* === FEATURED TOOL === */
.landing .featured {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 32px 80px;
}
.landing .featured-card {
  background: var(--near-black);
  border-radius: var(--radius-lg);
  padding: 1px;
  box-shadow: rgba(0, 153, 255, 0.15) 0px 0px 0px 1px;
  overflow: hidden;
  position: relative;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.landing .featured-card:hover {
  box-shadow: 0 0 0 2px rgba(0, 153, 255, 0.55), 0 16px 40px rgba(0, 0, 0, 0.5);
  transform: translateY(-2px);
}
.landing .featured-inner {
  background: var(--near-black);
  border-radius: calc(var(--radius-lg) - 1px);
  padding: var(--space-12);
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: var(--space-12);
  align-items: center;
}
@media (max-width: 900px) {
  .landing .featured-inner {
    grid-template-columns: 1fr;
    padding: var(--space-8);
    gap: var(--space-8);
  }
}
.landing .featured-info .badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--blue);
  padding: 4px 10px;
  border-radius: 9999px;
  background: rgba(0, 153, 255, 0.1);
  border: 1px solid rgba(0, 153, 255, 0.2);
  margin-bottom: 20px;
}
.landing .featured-info h2 {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -1.4px;
  color: var(--white);
  margin-bottom: 16px;
}
.landing .featured-info p {
  font-size: 16px;
  color: var(--silver);
  line-height: 1.6;
  margin-bottom: 24px;
}
.landing .featured-info p strong { color: var(--white); font-weight: 500; }
.landing .featured-info .btn svg { width: 12px; height: 12px; }

.landing .featured-preview {
  background: #050505;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--silver);
  overflow: hidden;
}
.landing .featured-preview .line { display: flex; gap: 8px; }
.landing .featured-preview .num { color: #4a4a4a; flex-shrink: 0; }
.landing .featured-preview .tag { color: var(--blue); }
.landing .featured-preview .str { color: #c4f0a4; }
.landing .featured-preview .attr { color: #ff9ec7; }
.landing .featured-preview .plain { color: #a6a6a6; }
.landing .featured-preview .head {
  color: var(--white);
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* === TOOLS GRID === */
.landing .tools-grid {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 32px 100px;
}
.landing .tools-grid-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 32px;
  gap: 24px;
  flex-wrap: wrap;
}
.landing .tools-grid-head h2 {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -2px;
  color: var(--white);
}
.landing .tools-grid-head p {
  font-size: 15px;
  color: var(--silver);
  max-width: 320px;
}
.landing .grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 900px) {
  .landing .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
  .landing .grid { grid-template-columns: 1fr; }
}
.landing .grid-card {
  background: var(--near-black);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  border: 1px solid rgba(0, 153, 255, 0.15);
  box-shadow: rgba(0, 153, 255, 0.12) 0px 0px 0px 1px;
  transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 220px;
  position: relative;
  text-decoration: none;
  color: inherit;
}
/* 🇨🇳 R44 工具卡片(emoji 大圆 + 标签) */
.landing .tool-card { gap: var(--space-3); }
.landing .tool-card-emoji {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(0, 153, 255, 0.18), rgba(0, 153, 255, 0.05));
  border: 1px solid rgba(0, 153, 255, 0.25);
  display: grid;
  place-items: center;
  font-size: 26px;
  line-height: 1;
}
.landing .tool-card-body { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.landing .tool-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.landing .tool-card-head h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--white);
  margin: 0;
}
.landing .tool-card-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  font-family: var(--font-mono);
}
.landing .tool-card-tag.tag-new,
.landing .tool-card-tag.tag-主推 {
  background: rgba(0, 153, 255, 0.2);
  color: var(--blue);
  border: 1px solid rgba(0, 153, 255, 0.4);
}
.landing .tool-card-tag.tag-beta {
  background: rgba(255, 180, 0, 0.18);
  color: #ffcc66;
  border: 1px solid rgba(255, 180, 0, 0.4);
}
.landing .tool-card-featured {
  border-color: rgba(0, 153, 255, 0.35);
  background: linear-gradient(180deg, rgba(0, 153, 255, 0.05) 0%, var(--near-black) 70%);
}
/* 🇨🇳 R44 工具分类标题 */
.landing .tools-categories {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.landing .tools-category-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--silver);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.landing .tools-count {
  font-family: var(--font-mono);
  color: var(--blue);
  font-weight: 500;
}
.landing .grid-card:hover {
  border-color: rgba(0, 153, 255, 0.55);
  background: linear-gradient(180deg, rgba(0, 153, 255, 0.06) 0%, var(--near-black) 60%);
  box-shadow: 0 0 0 2px rgba(0, 153, 255, 0.55), 0 12px 32px rgba(0, 0, 0, 0.45);
  transform: translateY(-3px);
}
.landing .grid-card:hover .icon {
  background: rgba(0, 153, 255, 0.22);
}
.landing .grid-card .icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(0, 153, 255, 0.12);
  display: grid;
  place-items: center;
}
.landing .grid-card .icon svg { width: 18px; height: 18px; color: var(--blue); }
.landing .grid-card .icon-muted {
  background: rgba(255, 255, 255, 0.05);
}
.landing .grid-card .icon-muted svg { color: #a6a6a6; }
.landing .grid-card h3 {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.5px;
  color: var(--white);
  line-height: 1.3;
}
.landing .grid-card p {
  font-size: 14px;
  color: var(--silver);
  line-height: 1.5;
  flex: 1;
}
.landing .grid-card p strong { color: var(--white); font-weight: 500; }
.landing .grid-card .arrow-link {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--blue);
  margin-top: auto;
}
.landing .grid-card .arrow-link-muted { color: #a6a6a6; }
.landing .grid-card.coming {
  opacity: 0.55;
  border-style: dashed;
  box-shadow: rgba(255, 255, 255, 0.05) 0px 0px 0px 1px;
}
.landing .grid-card.coming:hover {
  box-shadow: rgba(255, 255, 255, 0.08) 0px 0px 0px 1px;
  transform: none;
}

/* === FEATURES === */
.landing .features {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 32px 100px;
}
.landing .features h2 {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -2px;
  color: var(--white);
  margin-bottom: 48px;
}
.landing .feature-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: var(--space-16);
  align-items: center;
  padding: var(--space-12) 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
@media (max-width: 800px) {
  .landing .feature-row {
    grid-template-columns: 1fr;
    gap: var(--space-8);
    padding: var(--space-8) 0;
  }
}
.landing .feature-row:nth-child(even) {
  grid-template-columns: 1.2fr 1fr;
}
.landing .feature-row:nth-child(even) .feature-text { order: 2; }
.landing .feature-row:nth-child(even) .feature-visual { order: 1; }
@media (max-width: 800px) {
  .landing .feature-row:nth-child(even) .feature-text,
  .landing .feature-row:nth-child(even) .feature-visual { order: initial; }
}
.landing .feature-text .label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--blue);
  text-transform: uppercase;
  margin-bottom: 16px;
  letter-spacing: 0.5px;
}
.landing .feature-text h3 {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -1px;
  color: var(--white);
  margin-bottom: 16px;
}
.landing .feature-text p {
  font-size: 16px;
  color: var(--silver);
  line-height: 1.6;
}
.landing .feature-text p strong { color: var(--white); font-weight: 500; }
.landing .feature-visual {
  background: var(--near-black);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  box-shadow: rgba(0, 153, 255, 0.1) 0px 0px 0px 1px;
  min-height: 240px;
  display: grid;
  place-items: center;
}
.landing .feature-visual svg { max-width: 100%; height: auto; }

/* === FOOTER === */
.landing footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 80px 32px 40px;
}
.landing .footer-inner {
  max-width: 1200px;
  margin: 0 auto;
}
.landing .newsletter {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: center;
  padding-bottom: var(--space-16);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
@media (max-width: 720px) {
  .landing .newsletter { grid-template-columns: 1fr; gap: var(--space-6); }
  /* 🇨🇳 2026-08-31 M3.9 R35:hero 字号缩小,避免水平溢出 */
  .landing .hero { padding: 40px 16px 32px; }
  .landing .hero h1 { font-size: 38px; letter-spacing: -1.5px; line-height: 1.05; }
  .landing .hero p.subtitle { font-size: 15px; line-height: 1.5; }
  .landing .hero .hero-cta { flex-direction: column; gap: var(--space-3); }
  .landing .hero .hero-cta .btn {
    width: 100% !important;
    max-width: 100%;
    font-size: 14px !important;
    padding: 12px 16px !important;
    white-space: nowrap;
    text-align: center;
    line-height: 1.4;
  }
  .landing .hero-tag { font-size: 11px; }
  /* 🇨🇳 2026-08-31 M3.9 R35:工具卡 / 代码 preview 移动端不溢出 */
  .landing .tools-grid { padding: 0 16px; }
  .landing .tools-grid .grid { grid-template-columns: 1fr; gap: var(--space-4); }
  .landing .tools-grid .grid-card { padding: var(--space-5); }
  .landing .tools-grid .grid-card h3 { font-size: 18px; }
  .landing .tools-grid .featured-preview,
  .landing .tools-grid pre,
  .landing .tools-grid code {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    max-width: 100%;
  }
  .landing .featured-card { min-width: 0; overflow: hidden; }
  .landing .featured-card .featured-preview pre,
  .landing .featured-card .featured-preview code {
    font-size: 11px !important;
    line-height: 1.5;
  }
  .landing .featured-card p { font-size: 14px !important; word-break: break-word; }
}
.landing .newsletter h3 {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -1px;
  color: var(--white);
  margin-bottom: 8px;
}
.landing .newsletter p {
  font-size: 14px;
  color: var(--silver);
}
.landing .newsletter-form {
  display: flex;
  gap: 8px;
  background: var(--near-black);
  padding: 6px;
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.landing .newsletter-form input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 10px 16px;
  color: var(--white);
  font-size: 14px;
  font-family: inherit;
}
.landing .newsletter-form input::placeholder { color: var(--silver); }
.landing .newsletter-form button {
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-primary-text);
  font-size: var(--font-base);
  font-weight: var(--weight-semibold);
  font-family: inherit;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.15s var(--ease-out), background 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
}
.landing .newsletter-form button:hover { transform: scale(0.97); background: var(--color-primary-hover); box-shadow: 0 0 0 3px var(--color-accent-soft); }

.landing .footer-bottom {
  padding-top: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.landing .footer-meta {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--silver);
}
.landing .footer-meta a:hover { color: var(--white); }

/* R57.8 顶部导航 - 教程链接 */
.landing .nav-articles-link {
  color: var(--text);
  font-size: 14px;
  padding: 6px 12px;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
  margin-left: 8px;
}
.landing .nav-articles-link:hover {
  background: rgba(0, 153, 255, 0.1);
  color: #0099ff;
}

/* R57.8 实用教程 section */
.landing .articles-section {
  padding: 80px 24px;
  background: linear-gradient(180deg, transparent 0%, rgba(0,153,255,0.04) 100%);
}
.landing .articles-section .section-inner {
  max-width: 1200px;
  margin: 0 auto;
}
.landing .articles-section .section-title {
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px;
  text-align: center;
}
.landing .articles-section .section-sub {
  font-size: 15px;
  color: rgba(255,255,255,0.7);
  text-align: center;
  margin: 0 0 40px;
}
.landing .articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  max-width: 1100px;
  margin: 0 auto;
}
.landing .article-card {
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  padding: 28px 24px;
  text-decoration: none;
  color: #1a1a1a;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.landing .article-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0,153,255,0.15);
  border-color: rgba(0,153,255,0.3);
}
.landing .article-card .article-icon {
  font-size: 36px;
  line-height: 1;
}
.landing .article-card h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #1a1a1a;
}
.landing .article-card p {
  font-size: 14px;
  color: #666666;
  margin: 0;
  line-height: 1.6;
  flex: 1;
}
.landing .article-card .article-cta {
  font-size: 14px;
  color: #0099ff;
  font-weight: 500;
  margin-top: 4px;
}
.landing .footer-links {
  display: flex;
  gap: 24px;
  font-size: 13px;
  color: var(--silver);
}
.landing .footer-links a:hover { color: var(--white); }

/* 🇨🇳 2026-09-16 v2: 全面移动端优化 (全部 @media 包裹, PC 0 改动) */

/* ===== 1. footer 不遮挡内容 (≤720px 移动端) ===== */
@media (max-width: 720px) {
  .landing {
    padding-bottom: 200px !important; /* footer (~60px) + fun-btn (~80px) + 间距 */
  }
}

/* ===== 2. 触摸按钮加大 (移动端 44px+ 推荐) ===== */
@media (max-width: 720px) {
  .landing .btn,
  .landing button.btn,
  .landing .feedback-btn,
  .landing .nav-links a {
    min-height: 44px !important;
    padding: 12px 16px !important;
    font-size: 15px !important;
  }
}

/* ===== 3. 字号移动端优化 (易读) ===== */
@media (max-width: 720px) {
  .landing h1 { font-size: 32px !important; line-height: 1.2 !important; }
  .landing h2 { font-size: 22px !important; }
  .landing h3 { font-size: 18px !important; }
  .landing p { font-size: 15px !important; line-height: 1.7 !important; }
}

/* ===== 4. 卡片单列 (移动端) ===== */
@media (max-width: 720px) {
  .landing .feature-grid,
  .landing .tools-grid,
  .landing [class*="grid"] {
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }
}

/* ===== 5. 容器内边距 (移动端) ===== */
@media (max-width: 720px) {
  .landing .landing-container,
  .landing [class*="container"] {
    padding: 16px !important;
  }
}

/* ===== 6. 顶部 nav 简化 (移动端隐藏次要链接) ===== */
@media (max-width: 720px) {
  .landing .nav-links { gap: 8px !important; }
  .landing .nav-links a { font-size: 13px !important; padding: 8px 10px !important; }
}

/* ===== 7. 极小屏 (≤375px iPhone SE) 紧凑 ===== */
@media (max-width: 375px) {
  .landing h1 { font-size: 28px !important; }
  .landing .footer-bottom {
    padding: 0 8px !important;
    font-size: 11px !important;
  }
  .landing .footer-links {
    flex-wrap: wrap !important;
    gap: 8px !important;
  }
}

/* ===== 8. 防止横向溢出 ===== */
@media (max-width: 720px) {
  .landing, .landing * {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
}
</style>
