<!--
  🇨🇳 2026-09-04 R51:图片工具箱(单页 + Tab)
  - 默认 Tab: 压缩(用户拍板:最大流量)
  - 6 个 Tab: 压缩 / ✂️ 图片裁剪 + 水印 / 转PDF / AI抠图 / 老照片修复 / 证件照
  - 4 个免费(纯前端 Canvas),2 个接阿里云 API
-->
<template>
  <div class="image-toolbox-page">
    <div class="image-toolbox-nav-wrap">
      <JianheboxToolNav />
    </div>

    <div class="image-toolbox-container">
      <div class="tab-bar">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab-btn"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id as any"
        >
          <span class="tab-emoji">{{ t.emoji }}</span>
          <span class="tab-name">{{ t.name }}</span>
        </button>
      </div>

      <div class="tab-content">
        <ImageCompressTab v-if="activeTab === 'compress'" />
        <ImageCropTab v-else-if="activeTab === 'crop'" />
        <ImageToPdfTab v-else-if="activeTab === 'topdf'" />
        <ImageBgRemoveTab v-else-if="activeTab === 'bg'" />
        <ImageRestoreTab v-else-if="activeTab === 'restore'" />
        <ImageIdPhotoTab v-else-if="activeTab === 'idphoto'" />
      </div>

      <!-- 🇨🇳 R57:删试用/付费提示块 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed } from 'vue'
import JianheboxToolNav from './JianheboxToolNav.vue'
import ImageCompressTab from './image-toolbox/ImageCompressTab.vue'
import ImageCropTab from './image-toolbox/ImageCropTab.vue'
import ImageToPdfTab from './image-toolbox/ImageToPdfTab.vue'
import ImageBgRemoveTab from './image-toolbox/ImageBgRemoveTab.vue'
import ImageRestoreTab from './image-toolbox/ImageRestoreTab.vue'
import ImageIdPhotoTab from './image-toolbox/ImageIdPhotoTab.vue'
import { useRoute } from 'vue-router'

// R51:Tab 顺序 = 显示顺序
// B1 压缩放首位(用户需求最高)
const tabs = computed(() => [
  { id: 'compress', name: t('image.tab.compress'), emoji: '🗜️' },
    { id: 'crop', name: t('image.tab.crop'), emoji: '✂️' },
    { id: 'topdf', name: t('image.tab.topdf'), emoji: '📄' },
    { id: 'bg', name: t('image.tab.bg'), emoji: '🪄' },
    { id: 'restore', name: t('image.tab.restore'), emoji: '🖼️' },
    { id: 'idphoto', name: t('image.tab.idphoto'), emoji: '👔' },
  ])

const activeTab = ref<'compress' | 'crop' | 'topdf' | 'bg' | 'restore' | 'idphoto'>('compress')
// 🇨🇳 R57:删付费弹窗
// const showPaywall = ref(false)

// URL ?tab=bg 等
const route = useRoute()
if (route.query.tab && typeof route.query.tab === 'string') {
  const tab = route.query.tab as any
  if (tabs.find(t => t.id === tab)) activeTab.value = tab
}
</script>

<style>
/* 🇨🇳 R57.8 修复:防止 tab 内容宽度溢出导致整个页面水平滚动,把参数面板推出屏幕外
   不用 scoped 是因为 vite scoped id hash bug 会导致 css 不生效 */
.image-toolbox-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
  overflow-x: hidden !important;
  padding-top: 16px; /* 跟主页 header.nav (top:16) 对齐,nav 自身 sticky 到 top:16 */
}
.image-toolbox-nav-wrap {
  background: #0a0a0a;
}
.image-toolbox-container {
  max-width: 1100px;
  margin: 0 auto 80px;
  padding: 24px 32px;
  overflow-x: hidden !important;
}
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  padding: 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.3) transparent;
}
.tab-bar::-webkit-scrollbar { height: 4px; }
.tab-bar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 2px; }
.tab-btn {
  flex-shrink: 0;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
  font-family: inherit;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tab-btn:hover {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,1);
}
.tab-btn.active {
  background: linear-gradient(135deg, rgba(0,153,255,0.25), rgba(0,153,255,0.15));
  border-color: rgba(0,153,255,0.5);
  color: #ffffff;
}
.tab-emoji { font-size: 16px; }
.tab-content { width: 100%; }
</style>
