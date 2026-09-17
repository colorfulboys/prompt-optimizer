<!--
  🇨🇳 2026-09-04 R50:视频工具箱(单页 + Tab)
  - 默认 Tab: 压缩(用户拍板:最大流量)
  - Tab 1: 🎞️ 压缩 — 改分辨率+码率,纯 ffmpeg.wasm
  - Tab 2: 🎞️ 转 GIF — 视频截取片段 + 转 GIF
  - Tab 3: 🎞️ 去水印 — 拖框裁剪
  - Tab 4: 🎞️ 合并 — 多片段拼接
  - Tab 5: 🎞️ 竖↔横 — 加模糊背景
  - 全部 0 登录 + 0 服务器带宽(浏览器里跑 ffmpeg)
-->
<template>
  <div class="video-toolbox-page">
    <div class="video-toolbox-nav-wrap">
      <JianheboxToolNav />
    </div>

    <div class="video-toolbox-container">
      <!-- 🇨🇳 R50:Tab 切换(风格与 AudioToolbox 一致) -->
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

      <!-- Tab 内容 -->
      <div class="tab-content">
        <VideoCompressTab v-if="activeTab === 'compress'" />
        <VideoToGifTab v-else-if="activeTab === 'gif'" />
        <VideoCropTab v-else-if="activeTab === 'crop'" />
        <VideoRatioTab v-else-if="activeTab === 'ratio'" />
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
import VideoCompressTab from './video-toolbox/VideoCompressTab.vue'
import VideoToGifTab from './video-toolbox/VideoToGifTab.vue'
import VideoCropTab from './video-toolbox/VideoCropTab.vue'
import VideoRatioTab from './video-toolbox/VideoRatioTab.vue'
import { useRoute } from 'vue-router'

// 🇨🇳 R50:Tab 列表(顺序 = 显示顺序)
// R50.1:A1 视频压缩放首位(用户需求最高)
// R50.2:默认 Tab = 压缩(用户拍板)
// R52.14:删除'合并'tab(fmp4.wasm 物理限制,实测 6 个方案都失败)
const tabs = computed(() => [
  { id: 'compress', name: t('video.tab.compress'), emoji: '🎞️' },
  { id: 'gif', name: t('video.tab.gif'), emoji: '🎬' },
  { id: 'crop', name: t('video.tab.crop'), emoji: '✂️' },
  { id: 'ratio', name: t('video.tab.ratio'), emoji: '📱' },
])

const activeTab = ref<'compress' | 'gif' | 'crop' | 'ratio'>('compress')

// 🇨🇳 R57:删付费弹窗
// const showPaywall = ref(false)

// 🇨🇳 R50:URL ?tab=gif 等
const route = useRoute()
if (route.query.tab && typeof route.query.tab === 'string') {
  const tab = route.query.tab as any
  if (tabs.find(t => t.id === tab)) activeTab.value = tab
}
</script>

<style>
/* 🇨🇳 R57.8 修复:防止 tab 内容宽度溢出导致整个页面水平滚动,把参数面板推出屏幕外
   不用 scoped 是因为 vite scoped id hash bug 会导致 css 不生效 */
.video-toolbox-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
  overflow-x: hidden !important;
  padding-top: 16px; /* 跟主页 header.nav (top:16) 对齐,nav 自身 sticky 到 top:16 */
}
.video-toolbox-nav-wrap {
  background: #0a0a0a;
}
.video-toolbox-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 32px 80px;
  overflow-x: hidden !important;
}

/* 🇨🇳 R50:Tab 栏(完全复用 AudioToolbox 风格) */
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.2) transparent;
}
.tab-bar::-webkit-scrollbar { height: 4px; }
.tab-bar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.tab-btn:hover { color: #ffffff; background: rgba(255, 255, 255, 0.06); }
.tab-btn.active {
  color: #ffffff;
  background: rgba(0, 153, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(0, 153, 255, 0.4);
}
.tab-emoji { font-size: 16px; }
.tab-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 9999px;
  background: rgba(255, 200, 0, 0.2);
  color: #ffe066;
}
.tab-btn.active .tab-badge {
  background: rgba(0, 153, 255, 0.3);
  color: #99ddff;
}

.tab-content { min-height: 400px; }

/* 底部试用提示(同音频 — 不用重复修) */
.toolbox-footer {
  margin-top: 80px;
  padding: 24px 0 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.trial-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(90deg, rgba(255, 200, 0, 0.08), rgba(255, 200, 0, 0.02));
  border: 1px solid rgba(255, 200, 0, 0.18);
  border-radius: 12px;
}
.trial-icon { font-size: 28px; flex-shrink: 0; }
.trial-text { flex: 1; font-size: 14px; color: rgba(255, 255, 255, 0.85); line-height: 1.5; }
.trial-text strong { color: #ffe066; margin-right: 4px; }
.trial-sub {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}
.trial-btn {
  padding: 8px 18px;
  background: transparent;
  border: 1px solid rgba(255, 200, 0, 0.4);
  border-radius: 9999px;
  color: #ffe066;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.trial-btn:hover {
  background: rgba(255, 200, 0, 0.15);
  border-color: rgba(255, 200, 0, 0.7);
}

/* 移动端 */
@media (max-width: 720px) {
  .video-toolbox-container { padding: 16px; }
  .tab-bar { gap: 4px; }
  .tab-btn { padding: 8px 12px; font-size: 13px; }
  .tab-badge { display: none; }
}
</style>
