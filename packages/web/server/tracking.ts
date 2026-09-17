/**
 * 🇨🇳 2026-09-04 R52:简盒后台埋点 + 仪表盘数据层
 *
 * 用户原话:"桌面端有个实时调度,可以查看每日被浏览了多少次,
 *   用了什么功能,订阅,付费多少"
 *
 * 设计:
 *   - tracking_events:全量事件流(PV / 工具使用 / 登录 / 付费)
 *   - 仪表盘查询用 SQL 聚合(今日/30天趋势/最近事件)
 *   - SSE 实时推送新增事件(桌面端秒级刷新)
 *   - 鉴权:JIANHEBOX_ADMIN_KEY header(同 R49.9 debug 端点的鉴权模式)
 */
import type { Hono } from 'hono'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// 🇨🇳 R52:DB 路径策略
//   - Linux(生产):/var/lib/jianhebox/tracking.db(可被覆盖)
//   - Mac(开发):${TMPDIR}/jianhebox-tracking.db 或 ~/jianhebox-tracking.db
// 自动 mkdir 父目录,保证 dev/prod 都不会 fail
function resolveDbPath(): string {
  const envPath = process.env.VITE_TRACKING_DB_PATH
  if (envPath) return envPath
  const platform = process.platform
  if (platform === 'darwin' || platform === 'win32') {
    // 开发机 fallback:用 tmpdir
    const base = process.env.TMPDIR || os.tmpdir() || '/tmp'
    const dir = path.join(base, 'jianhebox-tracking')
    fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, 'tracking.db')
  }
  // Linux 生产
  const dir = '/var/lib/jianhebox'
  try { fs.mkdirSync(dir, { recursive: true }) } catch (e) { /* 已经存在或无权限 */ }
  return path.join(dir, 'tracking.db')
}

const TRACKING_DB_PATH = resolveDbPath()
console.log('[TRACK] 数据库路径:', TRACKING_DB_PATH)

const db = new Database(TRACKING_DB_PATH)
db.pragma('journal_mode = WAL')

// ============================================================
// 表结构
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS tracking_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,           -- 'page_view' | 'tool_use' | 'login' | 'payment' | 'error'
    user_id TEXT,                       -- 关联 users.user_id(可空,匿名 PV)
    anonymous_id TEXT,                  -- 浏览器持久化的 nanoid(匿名聚合)
    path TEXT,                          -- 当前路由
    tool_id TEXT,                       -- 工具页里的 Tab 转写/剪辑/压缩 等
    tool_category TEXT,                 -- audio / video / image / qr / fcpxml
    meta TEXT,                          -- JSON,业务数据(金额/工具结果码等)
    ip TEXT,
    user_agent TEXT,
    duration_ms INTEGER,                -- 操作耗时(可空)
    created_at INTEGER NOT NULL         -- ms timestamp
  );

  CREATE INDEX IF NOT EXISTS idx_event_type ON tracking_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_created_at ON tracking_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_tool_id ON tracking_events(tool_id);
  CREATE INDEX IF NOT EXISTS idx_user_id ON tracking_events(user_id);
`)

// ============================================================
// 写入
// ============================================================
export interface TrackEvent {
  eventType: 'page_view' | 'tool_use' | 'login' | 'payment' | 'error'
  userId?: string
  anonymousId?: string
  path?: string
  toolId?: string
  toolCategory?: string
  meta?: Record<string, any>
  durationMs?: number
}

const insertStmt = db.prepare(`
  INSERT INTO tracking_events
    (event_type, user_id, anonymous_id, path, tool_id, tool_category, meta, ip, user_agent, duration_ms, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

export function trackEvent(evt: TrackEvent, c?: any): void {
  try {
    const ip = c ? (
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown'
    ) : 'server'
    const ua = c ? (c.req.header('user-agent') || '') : ''
    insertStmt.run(
      evt.eventType,
      evt.userId || null,
      evt.anonymousId || null,
      evt.path || null,
      evt.toolId || null,
      evt.toolCategory || null,
      evt.meta ? JSON.stringify(evt.meta) : null,
      ip,
      ua,
      evt.durationMs || null,
      Date.now()
    )
    notifySubscribers(evt)
  } catch (e) {
    console.error('[TRACK] track failed:', e)
  }
}

// ============================================================
// 仪表盘查询(SQL 聚合)
// ============================================================

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export interface DashboardSummary {
  todayPV: number              // 今日 page_view 数
  todayUniqueVisitors: number  // 今日独立访客(按 anonymous_id 去重)
  todayToolUseCount: number    // 今日工具使用次数(转写/剪辑/压缩 等按钮被点)
  todayNewLogins: number       // 今日 login 事件数
  todayPayments: number        // 今日 payment 事件数
  todayRevenue: number         // 今日 payment 金额总和(元)
  totals: {
    users: number              // 历史总注册用户数
    payments: number           // 历史总付费次数
    revenue: number            // 历史累计收入
  }
}

export function getDashboardSummary(): DashboardSummary {
  const todayStart = startOfDay(Date.now())
  const todayEnd = todayStart + 24 * 60 * 60 * 1000

  const pvRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM tracking_events
    WHERE event_type='page_view' AND created_at >= ? AND created_at < ?
  `).get(todayStart, todayEnd) as { cnt: number }

  const uvRow = db.prepare(`
    SELECT COUNT(DISTINCT anonymous_id) as cnt FROM tracking_events
    WHERE event_type='page_view' AND created_at >= ? AND created_at < ? AND anonymous_id IS NOT NULL
  `).get(todayStart, todayEnd) as { cnt: number }

  const toolRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM tracking_events
    WHERE event_type='tool_use' AND created_at >= ? AND created_at < ?
  `).get(todayStart, todayEnd) as { cnt: number }

  const loginRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM tracking_events
    WHERE event_type='login' AND created_at >= ? AND created_at < ?
  `).get(todayStart, todayEnd) as { cnt: number }

  const payToday = db.prepare(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(CAST(json_extract(meta, '$.amountYuan') AS REAL)), 0) as rev
    FROM tracking_events
    WHERE event_type='payment' AND created_at >= ? AND created_at < ?
  `).get(todayStart, todayEnd) as { cnt: number, rev: number }

  // 🇨🇳 R52:历史累计(users 表来自 kv.db,跨 DB 安全做法:分别查,合并返回)
  // 这里只用 tracking_events 拿总付费数,用户数由 /api/admin/users 接口单独拿
  const trackingTotalsRow = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tracking_events WHERE event_type='payment') as payments,
      COALESCE((SELECT SUM(CAST(json_extract(meta, '$.amountYuan') AS REAL)) FROM tracking_events WHERE event_type='payment'), 0) as revenue
  `).get() as { payments: number, revenue: number }

  return {
    todayPV: pvRow.cnt,
    todayUniqueVisitors: uvRow.cnt,
    todayToolUseCount: toolRow.cnt,
    todayNewLogins: loginRow.cnt,
    todayPayments: payToday.cnt,
    todayRevenue: payToday.rev,
    totals: {
      users: 0,  // 🇨🇳 users 来源不在 tracking.db,前端显示用 /api/admin/users
      payments: trackingTotalsRow.payments,
      revenue: trackingTotalsRow.revenue,
    },
  }
}

export interface DailyStat {
  date: string         // YYYY-MM-DD
  pv: number
  toolUseCount: number
  logins: number
  payments: number
  revenue: number
}

export function getDailyTrend(days = 30): DailyStat[] {
  const endMs = Date.now()
  const startMs = endMs - days * 24 * 60 * 60 * 1000
  const rows = db.prepare(`
    SELECT
      date(created_at / 1000, 'unixepoch', '+8 hours') as d,
      SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) as pv,
      SUM(CASE WHEN event_type='tool_use' THEN 1 ELSE 0 END) as toolUseCount,
      SUM(CASE WHEN event_type='login' THEN 1 ELSE 0 END) as logins,
      SUM(CASE WHEN event_type='payment' THEN 1 ELSE 0 END) as payments,
      COALESCE(SUM(CASE WHEN event_type='payment' THEN CAST(json_extract(meta, '$.amountYuan') AS REAL) ELSE 0 END), 0) as revenue
    FROM tracking_events
    WHERE created_at >= ?
    GROUP BY d
    ORDER BY d ASC
  `).all(startMs) as any[]

  // 补全缺失日期
  const map = new Map<string, DailyStat>()
  for (const r of rows) {
    map.set(r.d, {
      date: r.d,
      pv: r.pv || 0,
      toolUseCount: r.toolUseCount || 0,
      logins: r.logins || 0,
      payments: r.payments || 0,
      revenue: r.revenue || 0,
    })
  }
  const out: DailyStat[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endMs - i * 24 * 60 * 60 * 1000)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const key = `${yyyy}-${mm}-${dd}`
    out.push(map.get(key) || { date: key, pv: 0, toolUseCount: 0, logins: 0, payments: 0, revenue: 0 })
  }
  return out
}

export interface ToolStat {
  toolId: string
  toolCategory?: string
  count: number
}

export function getToolRankings(days = 7, limit = 20): ToolStat[] {
  const startMs = Date.now() - days * 24 * 60 * 60 * 1000
  return db.prepare(`
    SELECT
      tool_id,
      tool_category,
      COUNT(*) as cnt
    FROM tracking_events
    WHERE event_type='tool_use' AND created_at >= ? AND tool_id IS NOT NULL
    GROUP BY tool_id
    ORDER BY cnt DESC
    LIMIT ?
  `).all(startMs, limit) as any[]
}

export interface RecentEvent {
  id: number
  eventType: string
  userId?: string
  anonymousId?: string
  path?: string
  toolId?: string
  meta?: any
  ip?: string
  createdAt: number
}

export function getRecentEvents(limit = 100): RecentEvent[] {
  const rows = db.prepare(`
    SELECT id, event_type, user_id, anonymous_id, path, tool_id, meta, ip, created_at
    FROM tracking_events
    ORDER BY id DESC
    LIMIT ?
  `).all(limit) as any[]
  return rows.map(r => ({
    id: r.id,
    eventType: r.event_type,
    userId: r.user_id,
    anonymousId: r.anonymous_id,
    path: r.path,
    toolId: r.tool_id,
    meta: r.meta ? JSON.parse(r.meta) : null,
    ip: r.ip,
    createdAt: r.created_at,
  }))
}

// ============================================================
// SSE 订阅(R52:实时推送新增事件)
// ============================================================
type Subscriber = (evt: TrackEvent) => void
const subscribers = new Set<Subscriber>()

function notifySubscribers(evt: TrackEvent): void {
  for (const s of subscribers) {
    try { s(evt) } catch (e) { /* ignore */ }
  }
}

export function registerTrackingRoutes(app: Hono) {
  // ============================================================
  // 埋点上报(无鉴权 — 公开)
  // ============================================================
  app.post('/api/track', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}))
      const evt: TrackEvent = {
        eventType: body.eventType || 'page_view',
        userId: body.userId,
        anonymousId: body.anonymousId,
        path: body.path,
        toolId: body.toolId,
        toolCategory: body.toolCategory,
        meta: body.meta,
        durationMs: typeof body.durationMs === 'number' ? body.durationMs : undefined,
      }
      if (!['page_view', 'tool_use', 'login', 'payment', 'error'].includes(evt.eventType)) {
        return c.json({ ok: false, error: 'invalid eventType' }, 400)
      }
      trackEvent(evt, c)
      return c.json({ ok: true })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  // ============================================================
  // 仪表盘鉴权(同 R49.9 模式:env key + header)
  // ============================================================
  function requireAdminKey(c: any): boolean {
    const adminKey = process.env.JIANHEBOX_ADMIN_KEY
    if (!adminKey) return false  // 未配置 = 默认拒绝
    const provided = c.req.header('x-admin-key') || ''
    return provided === adminKey
  }

  // ============================================================
  // 仪表盘 JSON
  // ============================================================
  app.get('/api/admin/dashboard', async (c) => {
    if (!requireAdminKey(c)) return c.json({ ok: false, error: 'unauthorized' }, 401)
    try {
      const summary = getDashboardSummary()
      const trend30 = getDailyTrend(30)
      const toolRank = getToolRankings(7, 20)
      const recentEvents = getRecentEvents(50)
      return c.json({
        ok: true,
        summary,
        trend30,
        toolRank,
        recentEvents,
        serverTime: Date.now(),
      })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  // ============================================================
  // SSE 实时推送
  // ============================================================
  app.get('/api/admin/dashboard-stream', async (c) => {
    if (!requireAdminKey(c)) return c.text('unauthorized', 401)
    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')
    c.header('X-Accel-Buffering', 'no')

    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder()
        const sub: Subscriber = () => {
          try {
            controller.enqueue(enc.encode(`event: ping\ndata: ${Date.now()}\n\n`))
          } catch (e) {
            subscribers.delete(sub)
          }
        }
        subscribers.add(sub)

        // 立即推一份当前 summary
        const initial = JSON.stringify({
          ts: Date.now(),
          summary: getDashboardSummary(),
        })
        controller.enqueue(enc.encode(`event: initial\ndata: ${initial}\n\n`))

        // 每 5 秒主动 ping(让前端知道连接活着)
        const ping = setInterval(() => {
          try {
            controller.enqueue(enc.encode(`event: ping\ndata: ${Date.now()}\n\n`))
          } catch (e) {
            clearInterval(ping)
            subscribers.delete(sub)
          }
        }, 5000)

        // SSR cleanup — Hono streaming 自动处理
        ;(c as any)._cleanup = () => {
          clearInterval(ping)
          subscribers.delete(sub)
        }
      },
    })
    return c.body(stream as any)
  })

  // ============================================================
  // 用户列表(读 users 表 — 复用 kv.db 路径)
  // 🇨🇳 R52 fix:不连 tracking.db(没有 users 表),改连 kv.db
  // ============================================================
  app.get('/api/admin/users', async (c) => {
    if (!requireAdminKey(c)) return c.json({ ok: false, error: 'unauthorized' }, 401)
    try {
      const KV_DB_PATH = process.env.VITE_AUTH_KV_PATH || '/var/lib/jianhebox/kv.db'
      if (!fs.existsSync(KV_DB_PATH)) {
        return c.json({ ok: true, users: [] })
      }
      const kvDb = new Database(KV_DB_PATH, { readonly: true })
      const rows = kvDb.prepare(`
        SELECT user_id, provider, email, name, avatar_url, created_at, last_login_at
        FROM users
        ORDER BY last_login_at DESC
        LIMIT 200
      `).all() as any[]
      kvDb.close()
      const users = rows.map(r => ({
        userId: r.user_id,
        provider: r.provider,
        email: r.email,
        name: r.name,
        avatarUrl: r.avatar_url,
        createdAt: r.created_at,
        lastLoginAt: r.last_login_at,
      }))
      return c.json({ ok: true, users })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })
}

// 服务端主动记录(在 api.ts 关键 endpoint 后调用)
export function trackPageView(c: any, path: string, anonymousId?: string, userId?: string): void {
  trackEvent({ eventType: 'page_view', path, anonymousId, userId }, c)
}
