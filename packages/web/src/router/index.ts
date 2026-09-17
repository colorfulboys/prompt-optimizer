import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { beforeRouteSwitch } from './guards'

/**
 * Vue Router 配置
 *
 * 简盒 JianHeBox V2 — 2026-09-17
 * 变更: 删除所有 AI 工具路由 (basic/pro/image)
 * 保留: 字幕工坊 fcpxml + 工具箱 + 后台 + 文章 + 收藏
 *
 * - "/" → LandingPage（直接挂载，无外壳）
 * - "/tools/*" → 各工具（自带 JianheboxToolNav 顶栏，不套外壳）
 * - "/admin/dashboard" → 运营后台
 * - "/favorites" → 收藏页
 * - "/articles" → 文章管理
 * - 兜底 → "/"
 *
 * - 使用 hash 模式（#/basic/system），Electron 兼容
 * - 路由懒加载，减少初始 bundle
 * - 路由守卫：监控导航事件
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../components/LandingPage.vue')
  },
  // 简盒 JianHeBox 定制：FCPXML 字幕互转（直接挂载，自带 JianheboxToolNav 顶栏）
  {
    path: '/tools/fcpxml',
    name: 'tools-fcpxml',
    component: () => import('../components/FcpxmlTool.vue')
  },
  // 🇨🇳 2026-09-17 V2:字幕工坊 4 个子页面(主入口 + 互转 + 编辑 + 工作流 + 剪映)
  {
    path: '/tools/subtitle',
    name: 'tools-subtitle',
    component: () => import('../components/SubtitleWorkshop.vue')
  },
  {
    path: '/tools/subtitle/convert',
    name: 'tools-subtitle-convert',
    component: () => import('../components/SubtitleConvert.vue')
  },
  {
    path: '/tools/subtitle/edit',
    name: 'tools-subtitle-edit',
    component: () => import('../components/SubtitleEditor.vue')
  },
  // 🇨🇳 2026-09-17 V2:工作流(上传视频/音频 → ASR → 编辑 → 导出)
  // 注意:需要阿里云 ASR API key 才完整可用;否则返回 mock 提示用户用剪映导出 SRT
  {
    path: '/tools/subtitle/workflow',
    name: 'tools-subtitle-workflow',
    component: () => import('../components/SubtitleWorkflow.vue')
  },
  // 🇨🇳 2026-09-17 V2:剪映草稿识别(只识别文件元数据,protobuf 需剪映导出 SRT)
  {
    path: '/tools/subtitle/jianying',
    name: 'tools-subtitle-jianying',
    component: () => import('../components/SubtitleJianYing.vue')
  },
  // 简盒 JianHeBox 定制：PDF 处理套件（直接挂载，自带 JianheboxToolNav 顶栏）
  {
    path: '/tools/pdf',
    name: 'tools-pdf',
    component: () => import('../components/PdfTool.vue')
  },
  // 🇨🇳 2026-09-02 R47:音频工具箱(转写 / 剪辑 / 格式转换 / 降噪 / 人声分离)
  // 路径 /tools/audio-transcribe 重定向到 /tools/audio(老链接不失效)
  {
    path: '/tools/audio-transcribe',
    redirect: '/tools/audio?tab=transcribe'
  },
  {
    path: '/tools/audio',
    name: 'tools-audio',
    component: () => import('../components/AudioToolbox.vue')
  },
  // 简盒 JianHeBox 定制：一切皆可二维码 (R43a)
  {
    path: '/tools/qr',
    name: 'tools-qr',
    component: () => import('../components/QrTool.vue')
  },
  // 🇨🇳 2026-09-04 R50:视频工具箱(压缩 / 转GIF / 去水印 / 合并 / 竖↔横)
  {
    path: '/tools/video',
    name: 'tools-video',
    component: () => import('../components/VideoToolbox.vue')
  },
  // 🇨🇳 2026-09-04 R51:图片工具箱(压缩 / 裁剪加水印 / 转PDF / 抠图 / 老照片 / 证件照)
  {
    path: '/tools/image',
    name: 'tools-image',
    component: () => import('../components/ImageToolbox.vue')
  },
  // 🇨🇳 R57.8:移除 /articles /article/:slug 占位路由
  // 原因:那些是"骨架文章"(内容写着"访问 GitHub 仓库"),用户被骗以为是真文章
  // 真文章用静态 HTML 部署(/article-fcpxml-guide.html 等),不在 SPA 路由里
  // /articles 老访问 → 重定向到首页(因为 SPA 内没文章列表页了)
  {
    path: '/articles',
    redirect: '/'
  },
  // /article/:slug → 重定向到首页(老占位 slug 全部失效)
  {
    path: '/article/:slug',
    redirect: '/'
  },
  // 🇨🇳 R54:个人中心(整合了原 AccountSecurity 的改密/注销功能) + 忘记密码
  {
    path: '/account',
    name: 'account',
    component: () => import('../components/Account.vue')
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../components/ForgotPassword.vue')
  },
  // 🇨🇳 2026-09-04 R52:简盒后台运营仪表盘(用户自己看数据)
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('../components/AdminDashboard.vue')
  },
  // 🇨🇳 R43c:二维码短链下载落地页 — 用户扫码后跳转这里,自动下载原文件
  {
    path: '/q/:shortId',
    name: 'qr-download',
    component: () => import('../components/QrDownload.vue')
  },
  // 🇨🇳 2026-09-17 V2:收藏页 (从 favorites 组件复用)
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('../components/favorites/FavoritesPage.vue')
  },
  // 兜底：找不到的路径回到首页
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 挂载路由守卫
router.beforeEach(beforeRouteSwitch)

export default router
