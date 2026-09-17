<template>
  <!-- 使用ToastUI包装整个布局以提供NMessageProvider -->
  <ToastUI>
    <NLayout style="position: fixed; inset: 0; width: 100vw; height: 100vh;
    max-height: 100vh;
    overflow: hidden; display: flex; min-height: 0;"
    content-style="height: 100%; max-height: 100%; min-height: 0; overflow: hidden;"
    >

      <NFlex vertical style="position: fixed; inset: 0; width: 100vw; max-height: 100vh; height: 100vh; min-height: 0;">
      <!-- 简盒定制：首次使用提示横幅（可关闭） -->
      <div v-if="showFirstUseBanner" class="jianhebox-notice">
        <span>👋 首次使用？</span>
        <span>请先点右上角 <strong>⚙️ 模型管理 → 添加模型</strong>填入您自己的 API Key；</span>
        <a href="#" @click.prevent="showFirstUseGuide = true">查看教程 →</a>
        <button class="jianhebox-notice-close" @click="showFirstUseBanner = false" aria-label="关闭">×</button>
      </div>

      <!-- 顶部导航栏 -->
      <NLayoutHeader class="theme-header nav-header-enhanced">
        <NFlex justify="space-between" align="center" class="w-full nav-content" :wrap="false" :size="[16, 12]">
          <!-- 左侧：Logo + 标题 + 核心导航 -->
          <NFlex align="center" :size="16" :wrap="false">
            <!-- Logo + 标题 -->
            <!-- 简盒定制：用 #title slot 简化掉紫色 brand-link + 默认 logo image -->
            <!-- <NButton @click="openBrandWebsite"> ... 已删除 -->
            <slot name="title">{{ t('common.appName') }}</slot>

            <!-- 核心导航元素 -->
            <div class="core-navigation">
              <slot name="core-nav"></slot>
            </div>
          </NFlex>

          <!-- 右侧：操作按钮 -->
          <NFlex align="center" :size="8" :wrap="true" justify="end" class="nav-actions">
            <slot name="actions"></slot>
          </NFlex>
        </NFlex>
      </NLayoutHeader>

      <!-- 主要内容区域 - 严格控制在剩余空间内 -->
      <NLayoutContent has-sider
        style="flex: 1; min-height: 0; overflow: hidden;"
        content-style="height: 100%; max-height: 100%; min-height: 0; box-sizing: border-box; padding: 24px clamp(16px, 2vw, 48px) 40px; display: flex; flex-direction: column; align-items: stretch; overflow: hidden;"
      >
        <div class="main-content-wrapper">
          <slot name="main"></slot>
        </div>
      </NLayoutContent>
      </NFlex>

      <!-- 弹窗插槽 -->
      <slot name="modals"></slot>

      <!-- AGPL-3.0 合规 footer（简盒定制，保留原作者版权链接） -->
      <div class="agpl-footer">
        <span>{{ t('common.appName') }} · 基于 </span>
        <a href="https://github.com/linshenkx/prompt-optimizer" target="_blank" rel="noopener noreferrer">linshenkx/prompt-optimizer</a>
        <span> 修改 · </span>
        <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">AGPL-3.0</a>
        <span> · 源代码: </span>
        <a href="https://github.com/colorfulboys/prompt-optimizer" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span> · </span>
        <a href="#/articles">教程</a>
        <span> · </span>
        <a href="#" @click.prevent="showFirstUseGuide = true">首次使用指南</a>
        <span> · </span>
        <FeedbackButton />
      </div>

      <!-- 首次使用指南弹窗 -->
      <NModal v-model:show="showFirstUseGuide" preset="card" title="首次使用指南" style="max-width: 640px">
        <div style="line-height: 1.7; font-size: 14px;">
          <p><strong>简盒 JianHeBox</strong> 是一个 LLM 提示词优化工具，使用前需要您添加一个 AI 模型（填入您自己的 API Key）。</p>

          <h3 style="margin-top: 16px; font-size: 15px;">🔒 您的 Key 绝对安全</h3>
          <ul style="margin-left: 20px;">
            <li>Key <strong>仅保存在您本机浏览器的数据库中</strong>（IndexedDB）</li>
            <li>本站 <strong>没有任何后端服务器</strong>，无法记录您的 Key</li>
            <li>Key 不会上传到任何地方，所有 AI 调用都是浏览器直连 AI 服务商</li>
          </ul>

          <h3 style="margin-top: 16px; font-size: 15px;">📝 配置步骤（跟着界面走）</h3>
          <ol style="margin-left: 20px;">
            <li>回到本页面 → 右上角 <strong>⚙️ 模型管理</strong></li>
            <li>点 <strong>「添加模型」</strong> 按钮（右上角）</li>
            <li>填<strong>显示名称</strong>（如"我的 DeepSeek"）</li>
            <li>选<strong>提供商（Provider）</strong>：支持 OpenAI / DeepSeek / 智谱 / Gemini / 阿里百炼 / MiniMax / Chrome 内置 / 自定义 API 等</li>
            <li>如果选的不是 Chrome 内置 → 填 <strong>API Key</strong>（弹窗里有"获取 API Key"链接直接跳到服务商控制台）</li>
            <li>选 <strong>模型</strong>（填 Key 后会自动拉取可用模型列表）</li>
            <li>勾 <strong>「启用」</strong> 复选框</li>
            <li>点 <strong>保存</strong></li>
            <li>回到主页 → 「优化模型」下拉选你刚加的 → 开始用</li>
          </ol>

          <h3 style="margin-top: 16px; font-size: 15px;">💡 小贴士</h3>
          <ul style="margin-left: 20px;">
            <li>第一次不知道选什么 → 选 <strong>Chrome 内置</strong>（无需 API Key，本地 Gemini Nano，但仅支持英语）</li>
            <li>想用国内大模型 → 选 <strong>DeepSeek</strong>（1 元起充）或 <strong>智谱 / 阿里百炼</strong></li>
            <li>已有 OpenAI 账号 → 选 <strong>OpenAI</strong>，需国际网络</li>
            <li>想用本地 Ollama / LM Studio → 选 <strong>OpenAI 兼容（自定义）</strong>，填本地 Base URL</li>
          </ul>

          <h3 style="margin-top: 16px; font-size: 15px;">❓ 常见问题</h3>
          <p><strong>Q: 一定要配 Key 吗？</strong><br>A: 大多数 Provider 需要。Chrome 内置不需要但功能受限。</p>
          <p><strong>Q: 为什么站长不提供免费 Key？</strong><br>A: AI 工具必须每用户自带 API Key，站长无法替所有人付费（成本和合规上都不现实）。本站不存储任何 Key，零成本零风险。</p>

          <p style="font-size: 12px; color: var(--n-text-color-3); margin-top: 16px; border-top: 1px solid var(--n-border-color); padding-top: 12px;">
            简盒 JianHeBox 源代码遵循 AGPL-3.0 协议公开 · 本站由 Cloudflare Pages 提供托管
          </p>
        </div>
      </NModal>

    </NLayout>
  </ToastUI>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NLayout, NLayoutHeader, NLayoutContent, NFlex, NText, NModal } from 'naive-ui'
import ToastUI from './Toast.vue'
import logoImage from '../assets/logo.png'
import AppPreviewImage from './media/AppPreviewImage.vue'
import FeedbackButton from './FeedbackButton.vue'
import { openExternalUrl } from '../utils/open-external-url'

const { t } = useI18n()

// 首次使用指南弹窗状态
const showFirstUseGuide = ref(false)
// 顶部首次使用提示横幅（默认不显示，避免挡 UI；用户可手动开启）
const showFirstUseBanner = ref(false)

// 首次访问自动弹出指南
onMounted(() => {
  if (typeof window === 'undefined') return
  const hasSeenGuide = localStorage.getItem('jianhebox_guide_seen')
  if (!hasSeenGuide) {
    setTimeout(() => {
      showFirstUseGuide.value = true
    }, 500)
  }
})

// 关闭指南时记录已查看
watch(showFirstUseGuide, (val) => {
  if (!val && typeof window !== 'undefined') {
    localStorage.setItem('jianhebox_guide_seen', '1')
  }
})

// Logo图片配置
const logoSrc = logoImage

// 创建简单的SVG fallback logo
const createFallbackSvg = () => {
  const svg = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#3b82f6"/>
      <text x="16" y="21" text-anchor="middle" fill="white" font-family="system-ui" font-size="14" font-weight="bold">P</text>
    </svg>
  `)}`
  return svg
}

const fallbackLogoSrc = createFallbackSvg()

// 响应式Logo尺寸 - 使用更智能的检测
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    window.addEventListener('resize', updateWindowWidth)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateWindowWidth)
  }
})

const logoSize = computed(() => {
  if (windowWidth.value < 480) {
    return 20 // 超小屏幕
  } else if (windowWidth.value < 640) {
    return 24 // 小屏幕
  }
  return 28 // 默认尺寸
})

const openBrandWebsite = async () => {
  await openExternalUrl('https://always200.com', { logPrefix: 'MainLayout' })
}
</script>

<style>
.main-content-wrapper {
  width: 100%;
  margin: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.main-content-wrapper > * {
  flex: 1;
  min-height: 0;
}

/* 增强导航栏样式 */
.nav-header-enhanced {
  min-height: 64px !important;
  padding: 12px 16px !important;
}

.nav-content {
  min-height: 40px;
}

.nav-actions {
  min-height: 40px;
}

.brand-link {
  align-items: center;
  padding: 6px 10px 6px 6px;
  border-radius: 12px;
  color: inherit;
  transition:
    background-color 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out,
    transform 0.2s ease-in-out;
}

.brand-link:hover {
  background: color-mix(in srgb, var(--n-primary-color) 10%, transparent);
  transform: translateY(-1px);
}

.brand-link:hover .logo-image {
  transform: scale(1.05);
}

.brand-link:hover .theme-title {
  opacity: 0.88;
}

.brand-link:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--n-primary-color) 14%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--n-primary-color) 28%, transparent);
}

/* Logo样式优化 */
.logo-image {
  border-radius: 6px;
  transition: transform 0.2s ease-in-out;
  flex-shrink: 0;
}

/* 标题文字对齐优化 */
.theme-title {
  line-height: 1.2 !important;
  margin: 0 !important;
  white-space: nowrap;
  transition: opacity 0.2s ease-in-out;
}

/* 核心导航样式 */
.core-navigation {
  display: flex;
  align-items: center;
  margin-left: 16px;
  padding-left: 16px;
  border-left: 1px solid var(--n-border-color);
  min-height: 32px;
}

/* 响应式优化 */
@media (max-width: 639px) {
  .logo-image {
    border-radius: 4px;
  }

  .core-navigation {
    margin-left: 8px;
    padding-left: 8px;
  }
}

.custom-select {
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  appearance: none !important;
  background-image: none !important;
}

.custom-select::-ms-expand {
  display: none;
}

/* 简盒安全公告横幅 */
.jianhebox-notice {
  position: relative;
  z-index: 50;
  background: linear-gradient(90deg, #1a3a5c 0%, #2a5a8c 100%);
  color: #e8f0f8;
  font-size: 12px;
  line-height: 1.4;
  padding: 6px 32px 6px 16px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.jianhebox-notice span {
  margin: 0 4px;
}

.jianhebox-notice a {
  color: #ffd966;
  text-decoration: none;
  margin: 0 4px;
}

.jianhebox-notice a:hover {
  text-decoration: underline;
}

.jianhebox-notice-close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #e8f0f8;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.jianhebox-notice-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* AGPL-3.0 合规 footer 样式 */
.agpl-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 6px 12px;
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  background: color-mix(in srgb, var(--n-color) 92%, transparent);
  backdrop-filter: blur(8px);
  border-top: 1px solid var(--n-border-color);
  color: var(--n-text-color-2);
  pointer-events: auto;
}

.agpl-footer a {
  color: var(--n-primary-color);
  text-decoration: none;
  margin: 0 2px;
}

.agpl-footer a:hover {
  text-decoration: underline;
}
</style>
