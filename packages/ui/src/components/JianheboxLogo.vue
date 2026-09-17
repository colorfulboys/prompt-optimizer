<template>
  <a href="#/" class="jianhebox-logo" aria-label="简盒 JianHeBox 返回主页">
    <span class="jianhebox-logo-mark" aria-hidden="true">
      <svg viewBox="0 0 12 12" fill="none" width="14" height="14">
        <path
          d="M6 1l5 5-5 5-5-5 5-5z"
          stroke="#fff"
          stroke-width="1.5"
          fill="none"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span class="jianhebox-logo-text">
      <span class="jianhebox-logo-zh">简盒</span>
      <span class="jianhebox-logo-sub">JianHeBox</span>
    </span>
  </a>
</template>

<script setup lang="ts">
// 🇨🇳 2026-08-31 M3.9 R32:唯一 logo 组件 - 全站统一,主页 / 工具页 / BasicSystem 都用这一个
// 关键:font-feature-settings:"tnum","ss01" 强制用 SF Pro 的 stylized "a" (双层 ɑ)
// 而不是 fallback 后的 Helvetica/仿宋/系统字体(单层 a)
</script>

<style scoped>
.jianhebox-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, 'Helvetica Neue', Arial, sans-serif;
  font-feature-settings: 'tnum', 'ss01', 'kern';
  -webkit-font-feature-settings: 'tnum', 'ss01', 'kern';
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #ffffff;
  text-decoration: none;
  flex-shrink: 0;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.15s ease;
  /* 🇨🇳 2026-08-31 M3.9 R32:全站唯一的 logo 样式,任何父容器的 font 都不会覆盖 */
  font-synthesis: none;
}

.jianhebox-logo:hover {
  opacity: 0.85;
}

.jianhebox-logo-mark {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #0099ff;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  align-self: center;
  font-family: inherit;
}

.jianhebox-logo-mark svg {
  width: 14px;
  height: 14px;
  display: block;
}

.jianhebox-logo-text {
  display: inline-flex;
  align-items: baseline;
  gap: 0;
  /* 🇨🇳 2026-08-31 M3.9 R32:让文字在 mark 居中线对齐 */
  line-height: 1;
}

.jianhebox-logo-zh {
  font-size: 18px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: -0.2px;
}

.jianhebox-logo-sub {
  font-size: 18px;
  font-weight: 500;
  font-family: inherit;
  opacity: 0.75;
  letter-spacing: -0.1px;
  margin-left: 6px;
}
</style>