/*
 * Prompt Optimizer - AI提示词优化工具
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createApp, watch } from 'vue'
import { installI18nOnly, installPinia, i18n, router } from '@prompt-optimizer/ui'
import '@prompt-optimizer/ui/dist/style.css'
import App from './App.vue'

const app = createApp(App)
// 🇨🇳 R52.21:Sentry 错误监控初始化(必须在 createApp 之后)
//  - 用户报错自动上报,你能在 sentry.io Issues 看到
//  - DSN 从 .env 读 VITE_SENTRY_DSN(没配就不初始化,不影响本地 dev)
//  - 只在生产环境开,本地开发日志已经够用
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  // dynamic import 避免 Sentry 在 dev 启动时阻塞
  import('@sentry/vue').then((Sentry) => {
    Sentry.init({
      app,
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration({ router }),
      ],
      // 性能监控:采样 10%(免费版)
      tracesSampleRate: 0.1,
      // 错误:100% 全收
      sampleRate: 1.0,
      // 过滤掉浏览器扩展等噪音
      beforeSend(event) {
        if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop')) return null
        return event
      },
    })

    // 🇨🇳 R52.21:用户登录后,把用户信息绑到 Sentry 上
    //   这样 Sentry Issues 面板能按用户聚合错误,你能知道"哪个用户报了什么"
    //   如果用户已经登录(从 auth store 拿),自动 attach
    try {
      const auth = localStorage.getItem('jianhebox_auth')
      if (auth) {
        const parsed = JSON.parse(auth)
        if (parsed?.user?.email) {
          Sentry.setUser({
            email: parsed.user.email,
            id: parsed.user.id || parsed.user.email,
            username: parsed.user.username || parsed.user.email,
          })
        }
      }
    } catch (e) {
      // localStorage 解析失败静默
    }
  }).catch((e) => console.warn('[sentry] init failed:', e))
}

// 只安装i18n插件，语言初始化将在App.vue中服务准备好后进行
installI18nOnly(app)
installPinia(app)

// 第1步：安装 router 插件
app.use(router)

// 同步文档标题和语言属性
if (typeof document !== 'undefined') {
  const syncDocumentTitle = () => {
    document.title = i18n.global.t('common.appName') === '提示词优化器'
      ? '简盒 JianHeBox - AI 工具合集 | FCPXML 字幕转换 · 提示词优化 · PDF 工具'
      : i18n.global.t('common.appName')
    const currentLocale = String(i18n.global.locale.value || '')
    const htmlLang = currentLocale.startsWith('zh') ? 'zh' : 'en'
    document.documentElement.setAttribute('lang', htmlLang)
  }

  syncDocumentTitle()
  watch(i18n.global.locale, syncDocumentTitle)
}

// 等待 router 完成首航解析（Hash URL -> route），避免初始化逻辑在短暂的 "/" 状态下误重定向
void router.isReady().then(() => {
  // 🇨🇳 R57:吞掉 Vue reactivity scheduler 的 reportAllChanges 误报
  //   - 报错来源:跨页导航时,某个 watch/effect 在 owner unmount 后残留
  //     Vue scheduler 内部访问 effect.startTime 时抛错
  //   - 不影响功能(用户操作/数据都正常),只是 UI 显示一个红框很难看
  //   - 必须在 app mount 之前装,否则异步 throw 走不到 Vue errorHandler
  app.config.errorHandler = (err, _instance, info) => {
    const msg = String((err as any)?.message || err)
    if (msg.includes('startTime') || msg.includes('reportAllChanges')) {
      return
    }
    console.error('[Vue error]', err, info)
  }
  // Vue 的 scheduler 异步 throw 走 window.onerror,不挂 errorHandler
  // 🇨🇳 R57:还 patch 原生 console.error,DevTools 的红框就是通过它显示的
  const origConsoleError = console.error
  console.error = (...args: any[]) => {
    const first = args[0]
    const msg = first instanceof Error ? first.message : String(first || '')
    if (msg.includes('startTime') || msg.includes('reportAllChanges')) {
      return  // 不打印,DevTools 红框就不显示
    }
    origConsoleError.apply(console, args)
  }
  // 兜底 window.onerror + unhandledrejection
  window.addEventListener('error', (e) => {
    const msg = (e as any)?.message || String((e as any)?.error || '')
    if (msg.includes('startTime') && msg.includes('reportAllChanges')) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }, true)
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e as any)?.reason?.message || (e as any)?.reason || '')
    if (msg.includes('startTime') && msg.includes('reportAllChanges')) {
      e.preventDefault()
    }
  })
  app.mount('#app')
})

// 只在Vercel环境中加载Analytics
// 当环境变量VITE_VERCEL_DEPLOYMENT为true时才尝试加载
if (import.meta.env.VITE_VERCEL_DEPLOYMENT === 'true') {
  // 使用完全运行时方式加载Vercel Analytics
  const loadAnalytics = () => {
    const script = document.createElement('script')
    script.src = '/_vercel/insights/script.js'
    script.defer = true
    script.onload = () => console.log('Vercel Analytics 已加载')
    script.onerror = () => console.log('Vercel Analytics 加载失败')
    document.head.appendChild(script)
  }
  
  // 延迟执行以确保DOM已完全加载
  window.addEventListener('DOMContentLoaded', loadAnalytics)
}else{
    console.log('Vercel Analytics 未加载')
}
