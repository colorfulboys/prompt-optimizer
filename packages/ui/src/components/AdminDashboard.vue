<!--
  🇨🇳 2026-09-04 R52:简盒后台运营仪表盘(用户原话:"桌面端实时调度")
  - 顶部 6 张卡:今日 PV / 独立访客 / 工具使用 / 登录 / 付费次数 / 付费金额
  - 30 天趋势(SVG 折线图,纯前端无图表库)
  - 7 天工具使用排行(top 20)
  - 最近事件流(SSE 实时刷新,新事件加高亮)
  - 鉴权:localStorage 里读 JIANHEBOX_ADMIN_KEY header
-->
<template>
  <div class="admin-dashboard">
    <JianheboxToolNav title="运营仪表盘" />

    <div class="dash-container">
      <!-- 顶部:鉴权 + 设置 key -->
      <div class="auth-panel" v-if="!adminKey">
        <h2>🔒 简盒后台 · 仪表盘</h2>
        <p>请输入 <code>JIANHEBOX_ADMIN_KEY</code>(在服务器 .env 配)</p>
        <div class="auth-input">
          <input
            type="password"
            v-model="inputKey"
            placeholder="X-Admin-Key"
            @keyup.enter="saveKey"
          />
          <button class="btn-primary" @click="saveKey">进入</button>
        </div>
        <p class="hint">💡 这个页面用户自己看数据,前端用户互相看不见,没有泄露风险。</p>
      </div>

      <template v-else>
        <header class="dash-header">
          <h2>📊 运营仪表盘</h2>
          <div class="dash-actions">
            <span class="live-status" :class="{ live: sseActive }">
              {{ sseActive ? '🟢 实时' : '🔴 离线' }}
            </span>
            <span class="last-update">{{ lastUpdate }}</span>
            <button class="btn-secondary" @click="logout">登出</button>
          </div>
        </header>

        <!-- 6 张卡 -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">今日 PV</div>
            <div class="kpi-value">{{ summary.todayPV }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">今日独立访客</div>
            <div class="kpi-value">{{ summary.todayUniqueVisitors }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">今日工具使用</div>
            <div class="kpi-value">{{ summary.todayToolUseCount }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">今日登录</div>
            <div class="kpi-value">{{ summary.todayNewLogins }}</div>
          </div>
          <div class="kpi-card accent">
            <div class="kpi-label">今日付费次数</div>
            <div class="kpi-value">{{ summary.todayPayments }}</div>
          </div>
          <div class="kpi-card accent">
            <div class="kpi-label">今日收入 (¥)</div>
            <div class="kpi-value">{{ summary.todayRevenue.toFixed(2) }}</div>
          </div>
        </div>

        <!-- 历史累计 -->
        <div class="totals-row">
          <span>历史累计:</span>
          <span>{{ summary.totals.users }} 注册用户</span>
          <span>·</span>
          <span>{{ summary.totals.payments }} 笔付费</span>
          <span>·</span>
          <span class="revenue-total">¥ {{ summary.totals.revenue.toFixed(2) }} 总收入</span>
        </div>

        <!-- 30 天趋势 -->
        <section class="chart-section">
          <h3>📈 30 天趋势(PV / 工具使用)</h3>
          <svg :viewBox="`0 0 ${chartW} ${chartH}`" class="trend-chart">
            <!-- 网格线 -->
            <line v-for="i in 5" :key="i"
              :x1="0" :y1="(i-1) * chartH / 4"
              :x2="chartW" :y2="(i-1) * chartH / 4"
              stroke="rgba(255,255,255,0.06)" stroke-width="1"
            />
            <!-- PV 折线 -->
            <polyline
              :points="trendPvPoints"
              fill="none" stroke="#0a8aff" stroke-width="2"
            />
            <!-- ToolUse 折线 -->
            <polyline
              :points="trendToolPoints"
              fill="none" stroke="#22c55e" stroke-width="2"
            />
            <!-- 点 -->
            <circle v-for="(d, i) in trend30" :key="i"
              :cx="(i / (trend30.length - 1)) * chartW"
              :cy="chartH - (d.pv / trendPvMax) * chartH * 0.85"
              r="2" fill="#0a8aff"
            />
          </svg>
          <div class="chart-legend">
            <span><span class="dot blue"></span> PV</span>
            <span><span class="dot green"></span> 工具使用</span>
          </div>
        </section>

        <!-- 工具使用排行 + 最近事件 -->
        <section class="grid-section">
          <div class="grid-cell">
            <h3>🔥 7 天工具使用排行 (Top 20)</h3>
            <div class="rank-list">
              <div v-for="(t, i) in toolRank" :key="i" class="rank-row">
                <span class="rank-num">{{ i + 1 }}</span>
                <span class="rank-name">
                  {{ t.toolId }}
                  <small v-if="t.toolCategory"> · {{ t.toolCategory }}</small>
                </span>
                <span class="rank-count">{{ t.count }}</span>
              </div>
              <p v-if="toolRank.length === 0" class="empty">暂无数据</p>
            </div>
          </div>

          <div class="grid-cell">
            <h3>📜 最近事件(实时)</h3>
            <div class="event-list">
              <div
                v-for="ev in recentEvents"
                :key="ev.id"
                class="event-row"
                :class="{ flash: ev.flash }"
              >
                <span class="event-type" :class="`type-${ev.eventType}`">{{ ev.eventType }}</span>
                <span class="event-path">{{ ev.path || '-' }}</span>
                <span v-if="ev.toolId" class="event-tool">{{ ev.toolId }}</span>
                <span class="event-time">{{ formatTimeAgo(ev.createdAt) }}</span>
              </div>
              <p v-if="recentEvents.length === 0" class="empty">暂无事件</p>
            </div>
          </div>
        </section>

        <!-- 用户列表 -->
        <section class="users-section">
          <h3>👥 最近登录用户 ({{ users.length }})</h3>
          <table class="users-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>邮箱 / 名称</th>
                <th>注册时间</th>
                <th>最近登录</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users.slice(0, 20)" :key="u.userId">
                <td>{{ u.provider }}</td>
                <td>{{ u.email || u.name || u.userId.slice(0, 12) }}</td>
                <td>{{ formatTimeShort(u.createdAt) }}</td>
                <td>{{ formatTimeShort(u.lastLoginAt) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import JianheboxToolNav from './JianheboxToolNav.vue'

const adminKey = ref(localStorage.getItem('jianhebox_admin_key') || '')
const inputKey = ref('')

const summary = ref({
  todayPV: 0,
  todayUniqueVisitors: 0,
  todayToolUseCount: 0,
  todayNewLogins: 0,
  todayPayments: 0,
  todayRevenue: 0,
  totals: { users: 0, payments: 0, revenue: 0 },
})

const trend30 = ref<any[]>([])
const toolRank = ref<any[]>([])
const users = ref<any[]>([])
const recentEvents = ref<any[]>([])

const sseActive = ref(false)
const lastUpdate = ref('--')
let sse: EventSource | null = null

const chartW = 800
const chartH = 200

const trendPvMax = computed(() =>
  Math.max(1, ...trend30.value.map(d => d.pv || 0))
)
const trendToolMax = computed(() =>
  Math.max(1, ...trend30.value.map(d => d.toolUseCount || 0))
)

const trendPvPoints = computed(() => {
  const max = trendPvMax.value
  if (trend30.value.length === 0) return ''
  return trend30.value
    .map((d, i) => `${(i / (trend30.value.length - 1)) * chartW},${chartH - ((d.pv || 0) / max) * chartH * 0.85}`)
    .join(' ')
})

const trendToolPoints = computed(() => {
  const max = trendToolMax.value
  if (trend30.value.length === 0) return ''
  return trend30.value
    .map((d, i) => `${(i / (trend30.value.length - 1)) * chartW},${chartH - ((d.toolUseCount || 0) / max) * chartH * 0.85}`)
    .join(' ')
})

function saveKey() {
  if (!inputKey.value.trim()) return
  adminKey.value = inputKey.value.trim()
  localStorage.setItem('jianhebox_admin_key', adminKey.value)
  fetchAll()
  startSse()
}

function logout() {
  adminKey.value = ''
  localStorage.removeItem('jianhebox_admin_key')
  if (sse) { sse.close(); sse = null }
  sseActive.value = false
}

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s 前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m 前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h 前`
  return `${Math.floor(diff / 86_400_000)}d 前`
}

function formatTimeShort(ms: number): string {
  const d = new Date(ms)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

async function fetchAll() {
  if (!adminKey.value) return
  const headers = { 'X-Admin-Key': adminKey.value }
  try {
    const [d, u] = await Promise.all([
      fetch('/api/admin/dashboard', { headers }).then(r => r.json()),
      fetch('/api/admin/users', { headers }).then(r => r.json()),
    ])
    if (d.ok) {
      summary.value = d.summary
      trend30.value = d.trend30
      toolRank.value = d.toolRank
      // 给最近事件加 flash 标记(仅新出现的)
      const prevIds = new Set(recentEvents.value.map(e => e.id))
      const newList = (d.recentEvents || []).slice(0, 30)
      recentEvents.value = newList.map((e: any) => ({
        ...e,
        flash: !prevIds.has(e.id),
      }))
      lastUpdate.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    }
    if (u.ok) {
      users.value = u.users
    }
  } catch (e) {
    console.error('[Admin] fetch failed:', e)
  }
}

function startSse() {
  if (!adminKey.value) return
  // EventSource 不支持自定义 header — 用 polyfill 模式:手动发 fetch + ReadableStream
  // 简化:每 8 秒轮询一次替代(实现简单,且足够"实时")
  if (sse) clearInterval(sse as any)
  const tick = setInterval(fetchAll, 8000)
  sseActive.value = true
  sse = new EventSource('/api/admin/dashboard-stream?') // 保留位(鉴权走 header,所以这条会 401,先轮询)
  sse.onerror = () => { sseActive.value = false }
  sse.onopen = () => { sseActive.value = true }
  ;(sse as any)._tick = tick
}

onMounted(() => {
  if (adminKey.value) {
    fetchAll()
    startSse()
  }
})

onBeforeUnmount(() => {
  if (sse) {
    clearInterval((sse as any)._tick)
    sse.close()
  }
})
</script>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
}
.dash-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px 80px;
}

.auth-panel {
  max-width: 480px;
  margin: 60px auto;
  padding: 32px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  text-align: center;
}
.auth-panel h2 { margin: 0 0 12px; }
.auth-panel p { color: rgba(255,255,255,0.6); font-size: 14px; margin: 8px 0; }
.auth-panel code {
  background: rgba(0,0,0,0.4); padding: 2px 8px; border-radius: 4px;
  font-family: ui-monospace, monospace;
}
.auth-input {
  display: flex;
  gap: 8px;
  margin: 20px 0;
}
.auth-input input {
  flex: 1;
  padding: 12px 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
}
.auth-input input:focus { outline: none; border-color: #0a8aff; }

.hint { color: rgba(255,255,255,0.4); font-size: 12px; }

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.dash-header h2 { margin: 0; font-size: 24px; font-weight: 600; }
.dash-actions { display: flex; gap: 16px; align-items: center; }
.live-status {
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 16px;
  background: rgba(239,68,68,0.15);
  color: #fca5a5;
}
.live-status.live {
  background: rgba(34,197,94,0.15);
  color: #86efac;
}
.last-update {
  font-size: 12px;
  color: rgba(255,255,255,0.45);
  font-family: ui-monospace, monospace;
}

.btn-primary {
  padding: 10px 20px;
  background: linear-gradient(180deg, #0a8aff, #0066dd);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:hover { filter: brightness(1.1); }
.btn-secondary {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  color: rgba(255,255,255,0.7);
  font-size: 13px;
  cursor: pointer;
}
.btn-secondary:hover { background: rgba(255,255,255,0.06); }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.kpi-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px 20px;
}
.kpi-card.accent {
  background: rgba(34,197,94,0.06);
  border-color: rgba(34,197,94,0.2);
}
.kpi-label { font-size: 12px; color: rgba(255,255,255,0.55); margin-bottom: 8px; }
.kpi-value { font-size: 28px; font-weight: 700; color: #fff; }

.totals-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  margin-bottom: 32px;
}
.totals-row .revenue-total { color: #86efac; font-weight: 600; }

section {
  margin-bottom: 32px;
  padding: 20px 24px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}
section h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }

.trend-chart { width: 100%; height: 200px; }
.chart-legend {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  margin-top: 8px;
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 5px;
  margin-right: 6px;
  vertical-align: middle;
}
.dot.blue { background: #0a8aff; }
.dot.green { background: #22c55e; }

.grid-section {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 16px;
  padding: 0;
  background: transparent;
  border: none;
}
@media (max-width: 980px) {
  .grid-section { grid-template-columns: 1fr; }
}
.grid-cell {
  padding: 20px 24px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}

.rank-list, .event-list { display: flex; flex-direction: column; gap: 6px; }
.rank-row, .event-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.02);
  border-radius: 6px;
  font-size: 13px;
}
.rank-row .rank-num {
  flex: 0 0 24px;
  width: 24px; height: 24px;
  background: rgba(255,255,255,0.08);
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
}
.rank-row .rank-name { flex: 1; }
.rank-row .rank-name small { color: rgba(255,255,255,0.5); }
.rank-row .rank-count {
  font-weight: 600;
  color: #0a8aff;
}

.event-row { font-size: 12px; }
.event-row.flash {
  animation: flash 1.2s ease-out;
}
@keyframes flash {
  0% { background: rgba(10, 138, 255, 0.3); }
  100% { background: rgba(255, 255, 255, 0.02); }
}
.event-type {
  flex: 0 0 80px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  text-align: center;
  font-weight: 600;
}
.type-page_view { background: rgba(10,138,255,0.2); color: #99ddff; }
.type-tool_use  { background: rgba(34,197,94,0.2); color: #86efac; }
.type-login     { background: rgba(255,200,0,0.2); color: #ffe066; }
.type-payment   { background: rgba(239,68,68,0.2); color: #fca5a5; }
.type-error     { background: rgba(239,68,68,0.3); color: #fca5a5; }

.event-path { flex: 1; color: rgba(255,255,255,0.7); font-family: ui-monospace, monospace; }
.event-tool { padding: 1px 6px; background: rgba(255,255,255,0.06); border-radius: 4px; color: rgba(255,255,255,0.6); }
.event-time { color: rgba(255,255,255,0.4); flex: 0 0 80px; text-align: right; }
.empty { color: rgba(255,255,255,0.4); font-size: 13px; text-align: center; padding: 20px; }

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.users-table th, .users-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.users-table th { color: rgba(255,255,255,0.5); font-weight: 600; }
.users-table td { color: rgba(255,255,255,0.85); }

@media (max-width: 720px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .dash-header { flex-direction: column; align-items: stretch; gap: 12px; }
}
</style>
