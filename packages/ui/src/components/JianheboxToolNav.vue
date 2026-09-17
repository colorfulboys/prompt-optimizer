<!--
  🇨🇳 2026-09-02 R44:工具页顶栏(从 tools.ts 工具注册表读)
  - 默认显示主推工具链接
  - hover "🛠 所有工具" 弹出全分类下拉(与主页一致)
  - 当前工具页面用 active 高亮
-->
<template>
  <header class="jianhebox-tool-nav">
    <div class="jianhebox-tool-nav-inner">
      <a href="#/" class="logo">
        <JianheboxLogo />
      </a>
      <nav class="nav-links" aria-label="主导航">
        <router-link to="/" class="home-btn" aria-label="返回简盒主页">
          <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1.5L1.5 6.5v6h3.5v-4h4v4h3.5v-6L7 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none" />
          </svg>
          <span>{{ t("nav.home") }}</span>
        </router-link>

        <!-- 🇨🇳 R44:所有工具下拉(hover + click 触发 + 缓冲) -->
        <div
          class="tools-trigger"
          @mouseenter="toolsMenuOpen = true"
          @mouseleave="onToolsMenuLeave"
        >
          <button
            class="tools-btn"
            :class="{ active: toolsMenuOpen }"
            @click.stop="toggleToolsMenu"
          >
            🛠 {{ t("nav.allTools") }} · {{ allTools.length }}
            <span class="nav-caret">▾</span>
          </button>
          <teleport to="body">
            <div
              v-show="toolsMenuOpen"
              class="tools-panel"
              :style="dropdownPosition"
              @mouseenter="cancelToolsMenuLeave"
              @mouseleave="onToolsMenuLeave"
              @click.stop
            >
              <div class="tools-grid">
                <div v-for="cat in categoryKeys" :key="cat" class="tools-col" v-show="toolsByCategory[cat].length > 0">
                  <div class="tools-cat-title">{{ categoryName[cat] }}</div>
                  <router-link
                    v-for="tool in toolsByCategory[cat]"
                    :key="tool.id"
                    :to="tool.path"
                    class="tools-item"
                    :class="{ 'tools-item-active': isActive(tool.path) }"
                    @click="closeToolsMenu"
                  >
                    <span class="tools-emoji">{{ tool.emoji }}</span>
                    <span class="tools-name">{{ tool.name }}</span>
                    <span v-if="tool.tags && tool.tags.includes('NEW')" class="tools-mini-tag tag-new">NEW</span>
                    <span v-if="tool.tags && tool.tags.includes('BETA')" class="tools-mini-tag tag-beta">BETA</span>
                  </router-link>
                </div>
              </div>
            </div>
          </teleport>
        </div>

        <!-- 主推工具快速入口(只在 featured 工具里展示 — 避免 nav 拥挤) -->
        <router-link
          v-for="tool in featuredTools"
          :key="tool.id"
          :to="tool.path"
          class="tool-quick-link"
          :class="{ active: isActive(tool.path) }"
        >
          {{ tool.emoji }} {{ tool.name }}
        </router-link>
      </nav>
      <!-- 🇨🇳 2026-09-11 R53.2:头像下拉菜单(替代旧的 GlobalUserArea:用户名 chip + 独立退出按钮) -->
      <AvatarMenu />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AvatarMenu from './AvatarMenu.vue'
import JianheboxLogo from './JianheboxLogo.vue'
import { TOOLS, TOOLS_BY_CATEGORY, CATEGORY_NAME, type ToolCategory } from '@/config/tools'

const { t } = useI18n()
const route = useRoute()
const allTools = computed(() => TOOLS)
const toolsByCategory = computed(() => TOOLS_BY_CATEGORY)
const categoryName = computed(() => CATEGORY_NAME)
const categoryKeys = computed(() => Object.keys(CATEGORY_NAME) as ToolCategory[])
const featuredTools = computed(() => {
  // 🇨🇳 R52.4:nav 横条工具链接显示规则(用户原话"看到啥工具就显示其它 3 个,排除当前页")
  // 选 featured + media 但不是当前正在浏览的工具(避免显示自己)
  // 总量 4 个(fcpxml/audio/video/image),排除当前页剩 3 个显示在 nav
  // 主页 ("/") 显示全部 4 个(用户不一定正在看某个工具)
  const route = useRoute()
  const filtered = TOOLS
    .filter(t => t.featured && t.category === 'media')
    .filter(t => route.path === '/' ? true : t.path !== route.path)
  // 🇨🇳 R52.4:固定显示 3 个(如果当前页是 media 工具)或 4 个(其他页面)
  // (简化:固定取前 3 个,但都已过滤掉当前页)
  // 如果是{{ t("nav.home") }}且 4 个都满足,返回全部 4 个
  return filtered
})

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

// 🇨🇳 R44:下拉菜单状态
const toolsMenuOpen = ref(false)
let leaveTimer: ReturnType<typeof setTimeout> | null = null
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
  // 🇨🇳 R44:清除 inline display,让 CSS 规则生效
  const panel = document.querySelector('.tools-panel') as HTMLElement | null
  if (panel) panel.style.display = 'none'
}
// 🇨🇳 R44:点击按钮只在关闭时触发;菜单已开则保持
function toggleToolsMenu() {
  if (toolsMenuOpen.value) return
  toolsMenuOpen.value = true
  nextTick(() => {
    const panel = document.querySelector('.tools-panel') as HTMLElement | null
    if (!panel) return
    panel.style.display = 'block'
    updateDropdownPosition()
  })
}
const dropdownPosition = ref({ top: '0px', left: '0px' })
function updateDropdownPosition() {
  const btn = document.querySelector('.jianhebox-tool-nav .tools-btn') as HTMLElement | null
  if (!btn) return
  const r = btn.getBoundingClientRect()
  dropdownPosition.value = {
    top: `${r.bottom + 16}px`,
    left: `${r.left + r.width / 2 - 280}px`,
  }
}
watch(toolsMenuOpen, (open) => {
  if (open) {
    updateDropdownPosition()
    // 延后一帧挂监听,避免 button click 立刻被吞
    setTimeout(() => {
      document.addEventListener('click', onDocClick, true)
    }, 0)
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
  } else {
    document.removeEventListener('click', onDocClick, true)
    window.removeEventListener('resize', updateDropdownPosition)
    window.removeEventListener('scroll', updateDropdownPosition, true)
  }
})
function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.tools-trigger') || target.closest('.tools-panel')) return
  closeToolsMenu()
}
// 路由切换自动关掉下拉
watch(() => route.path, () => { closeToolsMenu() })
onUnmounted(() => {
  if (leaveTimer) clearTimeout(leaveTimer)
})
</script>

<style scoped>
.jianhebox-tool-nav {
  position: sticky;
  top: 16px;
  z-index: 100;
  max-width: 1080px;  /* 🇨🇳 R47.9:对齐 qr-container 的 max-width,nav 和 page title 左边缘一致 */
  margin: 0 auto;
  padding: 0 20px;
}

.jianhebox-tool-nav-inner {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 100px;
  padding: 6px 18px 6px 24px; /* 🇨🇳 2026-08-31 M3.8:跟主页一致 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  box-shadow: rgba(255, 255, 255, 0.05) 0px 0.5px 0px 0.5px,
    rgba(0, 0, 0, 0.5) 0px 10px 30px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.15s ease;
}

.logo:hover {
  opacity: 0.85;
}

/* 🇨🇳 2026-09-02 R46:主页按钮改成跟"登录"一样明显的实心 CTA(用户原话:"{{ t("nav.home") }}不是很明显,稍稍和其他有区别,想登录一样,也明显一些") */
.home-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px !important;
  margin-left: 12px;  /* R52.7:跟 logo 之间留空隙(用户原话"挡住 logo 了") */
  border-radius: 9999px !important;
  background: #0099ff !important;  /* 🇨🇳 R46:跟登录同款实心蓝底 */
  color: #ffffff !important;
  font-size: 14px;
  font-weight: 600;  /* 比普通 nav-link 重 */
  text-decoration: none;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.home-btn:hover {
  background: #007acc !important;  /* hover 深一点 */
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 153, 255, 0.3);
}
.home-btn svg { width: 14px; height: 14px; }

.nav-links {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  justify-content: center;
}

.nav-links a {
  font-size: 14px;
  font-weight: 400;
  color: #ffffff;
  opacity: 0.7;
  padding: 6px 12px;
  border-radius: 9999px;
  white-space: nowrap;
  text-decoration: none;
  border: 1px solid transparent;
  transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.nav-links a:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
}
.nav-links a.active {
  opacity: 1;
  background: rgba(0, 153, 255, 0.12);
  border-color: rgba(0, 153, 255, 0.35);
  color: var(--blue);
}

/* 🇨🇳 R44:工具下拉按钮 */
.tools-trigger { position: relative; }
.tools-btn {
  font-size: 14px;
  font-weight: 400;
  color: var(--white);
  opacity: 0.7;
  padding: 6px 12px;
  white-space: nowrap;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.tools-btn:hover, .tools-btn.active {
  opacity: 1;
  background: rgba(0, 153, 255, 0.12);
  border-color: rgba(0, 153, 255, 0.35);
  color: var(--blue);
}
.nav-caret { font-size: 10px; opacity: 0.7; }

/* 🇨🇳 R44:下拉面板(同主页) */
.tools-panel {
  position: fixed;  /* teleport 后用 fixed 比较稳 */
  background: rgba(15, 15, 15, 0.96);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(0, 153, 255, 0.3);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 153, 255, 0.1);
  min-width: 560px;
  z-index: 9999;
  animation: toolsFadeIn 0.18s ease;
}
@keyframes toolsFadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tools-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.tools-col { display: flex; flex-direction: column; gap: 4px; }
.tools-cat-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--silver);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 8px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 4px;
}
.tools-item {
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
.tools-item:hover { background: rgba(0, 153, 255, 0.12); }
.tools-item-active {
  background: rgba(0, 153, 255, 0.18) !important;
  color: var(--blue) !important;
}
.tools-emoji { font-size: 16px; line-height: 1; }
.tools-name {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tools-mini-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.3px;
  font-family: var(--font-mono);
  flex-shrink: 0;
}
.tools-mini-tag.tag-new { background: rgba(0, 153, 255, 0.25); color: var(--blue); }
.tools-mini-tag.tag-beta { background: rgba(255, 180, 0, 0.2); color: #ffcc66; }

/* 移动端:藏工具快速链接,留 logo + 主页按钮 + 下拉 */
@media (max-width: 1024px) {
  .nav-links .tool-quick-link { display: none; }
  .tools-panel { min-width: 90vw; max-width: 90vw; }
  .tools-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px) {
  .nav-links {
    gap: 8px;
    justify-content: flex-end;
  }
  .nav-links .home-btn span { display: none; }
  .nav-links .tools-btn { font-size: 13px; padding: 6px 10px; }
  .tools-panel { min-width: 92vw; max-width: 92vw; }
  .tools-grid { grid-template-columns: 1fr; }
  .jianhebox-tool-nav { padding: 0 12px; }
  .jianhebox-tool-nav-inner { padding: 6px 8px 6px 14px; position: relative; }
  .jianhebox-tool-nav-inner > :deep(.global-user-area) {
    position: absolute !important;
    right: 8px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
  }
}
@media (max-width: 420px) {
  .logo { gap: 6px; }
  :deep(.jianhebox-logo-text) { font-size: 16px; }
}
</style>