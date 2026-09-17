import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { beforeRouteSwitch } from './guards'
import ContextSystemWorkspace from '../components/context-mode/ContextSystemWorkspace.vue'
import ContextUserWorkspace from '../components/context-mode/ContextUserWorkspace.vue'

/**
 * Vue Router 配置
 *
 * 简盒 JianHeBox 定制路由架构:
 * - "/" → LandingPage（直接挂载，无外壳）
 * - "/basic/*", "/pro/*", "/image/*", "/favorites", "/articles/*"
 *     → PromptOptimizerApp 作为父级（带外壳+子 RouterView 渲染工作区）
 * - "/tools/fcpxml" → FcpxmlTool（自带 JianheboxToolNav 顶栏，不套外壳）
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
  {
    path: '/app',
    component: () => import('../components/app-layout/PromptOptimizerApp.vue'),
    children: [
      {
        path: '/basic/system',
        name: 'basic-system',
        component: () => import('../components/basic-mode/BasicSystemWorkspace.vue')
      },
      {
        path: '/basic/user',
        name: 'basic-user',
        component: () => import('../components/basic-mode/BasicUserWorkspace.vue')
      },
      {
        path: '/pro/multi',
        name: 'pro-multi',
        component: ContextSystemWorkspace
      },
      {
        path: '/pro/variable',
        name: 'pro-variable',
        component: ContextUserWorkspace
      },
      {
        path: '/image/text2image',
        name: 'image-text2image',
        component: () => import('../components/image-mode/ImageText2ImageWorkspace.vue')
      },
      {
        path: '/image/image2image',
        name: 'image-image2image',
        component: () => import('../components/image-mode/ImageImage2ImageWorkspace.vue')
      },
      {
        path: '/image/multiimage',
        name: 'image-multiimage',
        component: () => import('../components/image-mode/ImageMultiImageWorkspace.vue')
      },
      {
        // /app 默认重定向到 /basic/system（保持老用户"上次工作区"行为）
        path: '',
        redirect: '/basic/system'
      }
    ]
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
  // 简盒 JianHeBox 定制：FCPXML 字幕互转（直接挂载，自带 JianheboxToolNav 顶栏）
  {
    path: '/tools/fcpxml',
    name: 'tools-fcpxml',
    component: () => import('../components/FcpxmlTool.vue')
  },
  // 简盒 JianHeBox 定制：PDF 处理套件（直接挂载，自带 JianheboxToolNav 顶栏）
  {
    path: '/tools/pdf',
    name: 'tools-pdf',
    component: () => import('../components/PdfTool.vue')
  },
  // 🇨🇳 2026-09-02 R47:音频工具箱(转写 / 剪辑 / 格式转换 / 降噪 / 人声分离)  // 路径 /tools/audio-transcribe 重定向到 /tools/audio(老链接不失效)
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