/**
 * 🇨🇳 2026-09-04 R52:前端埋点 hook(自动 page_view)
 *
 * 设计:
 *   - main.ts 启动时调用一次 startTracking()
 *   - 用 nanoid 生成 anonymous_id,存 localStorage
 *   - router.afterEach 自动埋 page_view
 *   - 用户登录后,AnonymousIdUtils.bindUser(userId) 关联真实用户
 *   - 工具使用:任何 Tab 调 useToolTracking('transcribe') 上报
 */
import { nanoid } from './id'

const ANON_ID_KEY = 'jianhebox_anon_id'
const USER_ID_KEY = 'jianhebox_user_id'

let anonId = localStorage.getItem(ANON_ID_KEY) || ''
if (!anonId) {
  anonId = nanoid(10)
  localStorage.setItem(ANON_ID_KEY, anonId)
}

let userId: string | null = localStorage.getItem(USER_ID_KEY) || null

let currentRoute = '/'
let lastNavAt = 0

interface TrackPayload {
  eventType: 'page_view' | 'tool_use' | 'login' | 'payment' | 'error'
  toolId?: string
  toolCategory?: string
  meta?: any
  durationMs?: number
}

async function send(evt: TrackPayload) {
  // 🇨🇳 R52:用 sendBeacon 或 fetch(失败就静默 — 不影响主流程)
  try {
    const body = JSON.stringify({
      eventType: evt.eventType,
      userId: userId,
      anonymousId: anonId,
      path: currentRoute,
      toolId: evt.toolId,
      toolCategory: evt.toolCategory,
      meta: evt.meta,
      durationMs: evt.durationMs,
    })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch (e) {
    // ignore
  }
}

/**
 * 启动埋点 — 在 main.ts 调一次
 */
export function startTracking(router: any) {
  // 首次 page_view
  currentRoute = router.currentRoute?.value?.path || '/'
  send({ eventType: 'page_view' })

  // 路由变化时埋点 + 计时
  router.afterEach((to: any, from: any) => {
    const now = Date.now()
    if (from.path && from.path !== to.path && lastNavAt > 0) {
      // 上一个页面停留时长(可选 meta)
      const dur = now - lastNavAt
      if (dur > 500) {
        // 简化:不上报 duration_ms,太多噪音
      }
    }
    currentRoute = to.path
    lastNavAt = now
    send({ eventType: 'page_view' })
  })
}

/**
 * 工具使用埋点(在任何工具 Tab 的处理函数成功后调一次)
 * toolId 例:'audio.compress' / 'image.bg-remove' / 'video.to-gif'
 */
export function trackToolUse(toolId: string, toolCategory: string, meta?: any, durationMs?: number) {
  send({ eventType: 'tool_use', toolId, toolCategory, meta, durationMs })
}

/**
 * 登录后调一次 — 关联 userId
 */
export function trackLogin(userIdValue: string, provider: string) {
  userId = userIdValue
  localStorage.setItem(USER_ID_KEY, userIdValue)
  send({ eventType: 'login', meta: { provider } })
}

/**
 * 付费埋点(微信支付回调后调)
 */
export function trackPayment(amountYuan: number, plan: string, orderId?: string) {
  send({ eventType: 'payment', meta: { amountYuan, plan, orderId } })
}

/**
 * 错误埋点(全局 try/catch)
 */
export function trackError(err: string | Error, path?: string) {
  send({
    eventType: 'error',
    meta: { message: err instanceof Error ? err.message : err, stack: err instanceof Error ? err.stack : undefined },
  })
}

export function getAnonymousId(): string {
  return anonId
}
