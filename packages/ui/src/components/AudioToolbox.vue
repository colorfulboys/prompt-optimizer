<!--
  🇨🇳 2026-09-02 R47:音频工具箱(单页 + Tab)
  - Tab 1: 转写(阿里云 ASR,需要登录 + 30分钟/月免费)
  - Tab 2: 剪辑(FFmpeg.wasm,免费,不登录)
  - Tab 3: 格式转换(FFmpeg.wasm,免费,不登录)
  - Tab 4: 从视频提取音频(FFmpeg.wasm,免费,不登录)
  - Tab 5: 降噪(Sprint 2)
  - Tab 6: 人声分离(腾讯云 CI,Sprint 3)
  - 默认 Tab: 转写(用户拍板)
-->
<template>
  <div class="audio-toolbox-page">
    <div class="audio-toolbox-nav-wrap">
      <JianheboxToolNav />
    </div>

    <div class="audio-toolbox-container">
      <!-- 🇨🇳 R47:Tab 切换 -->
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
        <!-- Tab 1: 转写 -->
        <TranscribeTab v-if="activeTab === 'transcribe'" />

        <!-- Tab 2: 剪辑 -->
        <CutTab v-else-if="activeTab === 'cut'" />

        <!-- Tab 3: 格式转换 -->
        <ConvertTab v-else-if="activeTab === 'convert'" />

        <!-- Tab 4: 从视频提取音频 -->
        <ExtractTab v-else-if="activeTab === 'extract'" />

        <!-- Tab 5: 降噪(真实 ffmpeg.wasm) -->
        <DenoiseTab v-else-if="activeTab === 'denoise'" />

        <!-- Tab 6: 人声分离(任何点击弹付费) -->
        <VocalTab v-else-if="activeTab === 'vocal'" />
      </div>

      <!-- 🇨🇳 R57:删试用/付费提示块,直接用 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed } from 'vue'
import JianheboxToolNav from './JianheboxToolNav.vue'
import TranscribeTab from './audio-toolbox/TranscribeTab.vue'
import CutTab from './audio-toolbox/CutTab.vue'
import ConvertTab from './audio-toolbox/ConvertTab.vue'
import ExtractTab from './audio-toolbox/ExtractTab.vue'
import DenoiseTab from './audio-toolbox/DenoiseTab.vue'
import VocalTab from './audio-toolbox/VocalTab.vue'

// 🇨🇳 R47:Tab 列表(顺序就是显示顺序)
// R47.9:删了"音量标准化"、"淡入淡出"(用处不大)
const tabs = computed(() => [
  { id: 'transcribe', name: t('audio.tab.transcribe'), emoji: '🎙', needsLogin: true },
  { id: 'cut', name: t('audio.tab.cut'), emoji: '✂️', needsLogin: false },
  { id: 'convert', name: t('audio.tab.convert'), emoji: '🔄', needsLogin: false },
  { id: 'extract', name: t('audio.tab.extract'), emoji: '🎬', needsLogin: false },
  { id: 'denoise', name: t('audio.tab.denoise'), emoji: '🔇', needsLogin: false },
  { id: 'vocal', name: t('audio.tab.vocal'), emoji: '🎤', needsLogin: true },
])

// 🇨🇳 R47:默认 Tab = 转写(用户拍板)
const activeTab = ref<'transcribe' | 'cut' | 'convert' | 'extract' | 'denoise' | 'vocal'>('transcribe')

// 🇨🇳 R57:删付费弹窗(暂不做付费)
// const showPaywall = ref(false)

// 🇨🇳 R47:从 URL query 读初始 Tab(/tools/audio?tab=cut 等)
import { useRoute } from 'vue-router'
const route = useRoute()
if (route.query.tab && typeof route.query.tab === 'string') {
  const tab = route.query.tab as any
  if (tabs.find(t => t.id === tab)) activeTab.value = tab
}
</script>

<style scoped>
.audio-toolbox-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
  padding-top: 16px; /* 跟主页 header.nav (top:16) 对齐,nav 自身 sticky 到 top:16 */
}
.audio-toolbox-nav-wrap {
  background: #0a0a0a;
}
.audio-toolbox-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 32px 80px;
}

/* 🇨🇳 R47.6:底部试用提示块(原顶部 banner 撤掉,挪到这里) */
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
.trial-icon {
  font-size: 28px;
  flex-shrink: 0;
}
.trial-text {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.5;
}
.trial-text strong {
  color: #ffe066;
  margin-right: 4px;
}
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

/* 🇨🇳 R47 Tab 切换栏 */
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
  /* 🇨🇳 R47.7:横向滚动提示(8 个 Tab 1440 宽挤) */
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
  /* 🇨🇳 R52.19:8 个 tab 在 1280px 屏宽下裁切,加 flex-shrink:0 防止被压缩 */
  flex-shrink: 0;
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
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.55);
}
.tab-btn.active .tab-badge {
  background: rgba(0, 153, 255, 0.3);
  color: #99ddff;
}

/* Coming soon 占位 */
.coming-soon {
  text-align: center;
  padding: 100px 24px;
  color: rgba(255, 255, 255, 0.55);
}
.coming-soon-icon { font-size: 64px; margin-bottom: 16px; }
.coming-soon h2 { font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 8px; }
.coming-soon p { font-size: 14px; margin: 0; }

/* 移动端 */
@media (max-width: 720px) {
  .audio-toolbox-container { padding: 16px; }
  .tab-bar { gap: 4px; }
  .tab-btn { padding: 8px 12px; font-size: 13px; }
  .tab-badge { display: none; }
}
</style>