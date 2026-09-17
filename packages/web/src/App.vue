<template>
  <!--
        Web App 入口组件

        职责:
        - 使用 vue-router 的 <router-view> 渲染当前路由
        - 全局:强制黑底 + 简盒标题 + 拦截 logo 点击回主页

        设计说明:
        - 用 <router-view> 而不是 <component :is>，因为 <component :is> 不会响应路由变化
        - PromptOptimizerApp 自带 i18n 会改 document.title，加路由监听覆盖
        - PromptOptimizerApp 默认白底背景，用全局 style 强制黑底避免"白边儿"
        - logo 点击可能触发 PromptOptimizerApp 的 @click → always200.com，用全局 click 捕获器强制跳主页
    -->
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

// 强制覆盖 document.title（PromptOptimizerApp 自带 i18n 会改成"提示词优化器"）
const setJianheboxTitle = () => {
  const path = route?.path ?? "/";
  const titleMap: Record<string, string> = {
    "/": "简盒 JianHeBox - AI 工具合集 | FCPXML 字幕转换 · 提示词优化",
    "/tools/fcpxml": "FCPXML 字幕互转 - 简盒 JianHeBox",
  };
  const base = titleMap[path] || "简盒 JianHeBox - 工具合集";
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.endsWith("jianhebox.com")) {
      const enMap: Record<string, string> = {
        "/": "JianHeBox - Free AI Toolkit | FCPXML Converter & Prompt Optimizer",
        "/tools/fcpxml": "FCPXML Converter - JianHeBox",
      };
      document.title = enMap[route.path] || "JianHeBox - Toolkit";
    } else {
      document.title = base;
    }
  }
};

// 强制黑底，避免 PromptOptimizerApp 的默认亮色背景造成"白边儿"
const resetBodyBackground = () => {
  if (typeof document === "undefined") return;
  document.documentElement.style.background = "#000";
  document.documentElement.style.margin = "0";
  document.documentElement.style.padding = "0";
  document.body.style.background = "#000";
  document.body.style.color = "#fff";
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.minHeight = "100vh";
};

onMounted(() => {
  setJianheboxTitle();
  resetBodyBackground();
});

watch(
  () => route?.path ?? "/",
  () => {
    setJianheboxTitle();
    resetBodyBackground();
  }
);

// 拦截 logo 点击 → 强制回到主页 /
// PromptOptimizerApp 内部有 openOfficialWebsite 跳 always200.com，
// 在捕获阶段抢先处理 .jianhebox-logo 和简盒的 .logo a[href="#/"]
const handleLogoClick = (e: Event) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  // 匹配：JianheboxLogo(<a class="jianhebox-logo">) + JianheboxToolNav 的 logo(<a class="logo" href="#/">) + LandingPage 的 logo(<a class="logo" href="#/">)
  const logo = target.closest(
    'a.jianhebox-logo, a.jianhebox-tool-nav .logo, a.logo[href="#/"]'
  ) as HTMLAnchorElement | null;
  if (logo) {
    // 阻止事件继续冒泡（防止 PromptOptimizerApp 内部 openOfficialWebsite 抢走）
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    // 用 vue-router 跳主页（不走 href="#/"，避免 hash 干扰）
    void router.push("/");
  }
};

onMounted(() => {
  document.addEventListener("click", handleLogoClick, true);
});
</script>

<style>
/* 全局重置：消除 body 默认 margin + 强制黑底，避免任何工具页"白边儿" */
html,
body {
  margin: 0 !important;
  padding: 0 !important;
  background: #000 !important;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}
body {
  min-height: 100vh;
}
</style>
