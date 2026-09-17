<template>
  <div class="cron-page">
    <header class="page-header">
      <h1>⏰ Cron 表达式解析器</h1>
      <p class="subtitle">输入 5 段 cron 表达式，自动展示未来 5 次执行时间</p>
    </header>

    <div class="cron-form">
      <div class="form-row">
        <label>Cron 表达式（5 段：分 时 日 月 周）</label>
        <div class="cron-input-wrap">
          <input
            v-for="(seg, i) in segments"
            :key="i"
            v-model="segments[i]"
            class="cron-segment"
            :placeholder="placeholders[i]"
            @input="parse"
          />
        </div>
        <div class="hint">
          <code>*</code> 任意 · <code>*/5</code> 每5 · <code>1,3,5</code> 列出 · <code>1-10</code> 范围
        </div>
        <div v-if="errorMsg" class="error-msg">⚠️ {{ errorMsg }}</div>
      </div>

      <div class="form-row">
        <label>说明（人话）</label>
        <div class="human-read">{{ humanReadable || '（请输入合法表达式）' }}</div>
      </div>

      <div v-if="nextRuns.length" class="form-row">
        <label>未来 5 次执行时间</label>
        <div class="next-runs">
          <div v-for="(run, i) in nextRuns" :key="i" class="run-item">
            <span class="run-num">#{{ i + 1 }}</span>
            <span class="run-time">{{ run }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="quick-examples">
      <h3>💡 常用表达式</h3>
      <div class="example-chips">
        <button v-for="ex in examples" :key="ex.label" class="chip" @click="applyExample(ex)">
          <span class="chip-label">{{ ex.label }}</span>
          <code class="chip-pattern">{{ ex.value }}</code>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const segments = ref(['0', '0', '*', '*', '*'])
const placeholders = ['分(0-59)', '时(0-23)', '日(1-31)', '月(1-12)', '周(0-6)']
const errorMsg = ref('')
const humanReadable = ref('')
const nextRuns = ref<string[]>([])

const examples = [
  { label: '每分钟', value: ['*', '*', '*', '*', '*'] },
  { label: '每5分钟', value: ['*/5', '*', '*', '*', '*'] },
  { label: '每小时整点', value: ['0', '*', '*', '*', '*'] },
  { label: '每天0点', value: ['0', '0', '*', '*', '*'] },
  { label: '每天8点', value: ['0', '8', '*', '*', '*'] },
  { label: '每周一8点', value: ['0', '8', '*', '*', '1'] },
  { label: '每月1号0点', value: ['0', '0', '1', '*', '*'] },
  { label: '工作日9点', value: ['0', '9', '*', '*', '1-5'] }
]

function applyExample(ex: { value: string[] }) {
  segments.value = [...ex.value]
  parse()
}

interface CronField {
  values: Set<number>
  raw: string
}

function expandField(raw: string, min: number, max: number): CronField {
  const trimmed = raw.trim()
  if (trimmed === '*') {
    const s = new Set<number>()
    for (let i = min; i <= max; i++) s.add(i)
    return { values: s, raw }
  }
  const out = new Set<number>()
  const parts = trimmed.split(',')
  for (const part of parts) {
    let stepStr = '1'
    const [rangePart, ...rest] = part.split('/')
    stepStr = rest[0] || '1'
    const step = Math.max(1, parseInt(stepStr, 10) || 1)
    let lo: number, hi: number
    if (rangePart === '*') {
      lo = min
      hi = max
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-').map(s => parseInt(s.trim(), 10))
      lo = a
      hi = b
    } else {
      const v = parseInt(rangePart.trim(), 10)
      if (Number.isNaN(v)) throw new Error(`字段「${raw}」含无效值`)
      lo = v
      hi = v
    }
    if (lo < min || hi > max || lo > hi) {
      throw new Error(`字段「${raw}」越界（${min}-${max}）`)
    }
    for (let v = lo; v <= hi; v += step) out.add(v)
  }
  return { values: out, raw }
}

function parse() {
  errorMsg.value = ''
  humanReadable.value = ''
  nextRuns.value = []
  try {
    const [minRaw, hourRaw, domRaw, monthRaw, dowRaw] = segments.value
    const min = expandField(minRaw || '*', 0, 59)
    const hour = expandField(hourRaw || '*', 0, 23)
    const dom = expandField(domRaw || '*', 1, 31)
    const month = expandField(monthRaw || '*', 1, 12)
    const dow = expandField(dowRaw || '*', 0, 6)
    humanReadable.value = describeSchedule(min, hour, dom, month, dow)
    nextRuns.value = computeNextRuns(min, hour, dom, month, dow, 5)
  } catch (e: any) {
    errorMsg.value = e?.message || String(e)
  }
}

function describeSchedule(min: CronField, hour: CronField, dom: CronField, month: CronField, dow: CronField): string {
  function describe(field: CronField, unit: string): string {
    if (field.values.size === 60 || field.values.size === 24 || field.values.size === 32 || field.values.size === 13 || field.values.size === 7) {
      return `每${unit}`
    }
    return `每个 ${[...field.values].sort((a, b) => a - b).join(',')} ${unit}`
  }
  return `${describe(min, '分钟')} · ${describe(hour, '小时')} · ${describe(dom, '日')} · ${describe(month, '月')} · ${describe(dow, '周')}`
}

function computeNextRuns(min: CronField, hour: CronField, dom: CronField, month: CronField, dow: CronField, count: number): string[] {
  const results: string[] = []
  // 从下一分钟开始扫描
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + 1)
  // 最长扫描 4 年（避免死循环）
  const deadline = new Date(d)
  deadline.setFullYear(deadline.getFullYear() + 4)
  while (results.length < count && d < deadline) {
    if (
      month.values.has(d.getMonth() + 1) &&
      dom.values.has(d.getDate()) &&
      dow.values.has(d.getDay()) &&
      hour.values.has(d.getHours()) &&
      min.values.has(d.getMinutes())
    ) {
      results.push(formatDateTime(d))
    }
    d.setMinutes(d.getMinutes() + 1)
  }
  return results
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} 周${weekdays[d.getDay()]}`
}

onMounted(parse)
</script>

<style scoped>
.cron-page { max-width: 900px; margin: 0 auto; padding: 24px; }
.page-header h1 { margin: 0 0 8px 0; font-size: 28px; }
.subtitle { margin: 0 0 24px 0; color: #666; }
.cron-form { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0; }
.form-row { margin-bottom: 18px; }
.form-row label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 8px; }
.cron-input-wrap { display: flex; gap: 6px; }
.cron-segment { width: 0; flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; text-align: center; font-family: monospace; font-size: 15px; outline: none; transition: border-color 0.2s; }
.cron-segment:focus { border-color: #2563eb; }
.hint { font-size: 12px; color: #666; margin-top: 8px; }
.hint code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-family: monospace; }
.human-read { padding: 10px 14px; background: #f0f9ff; border-left: 3px solid #2563eb; border-radius: 4px; font-size: 14px; }
.next-runs { background: #fafafa; border-radius: 6px; padding: 10px; }
.run-item { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px dashed #e0e0e0; }
.run-item:last-child { border-bottom: none; }
.run-num { background: #2563eb; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.run-time { font-family: monospace; font-size: 14px; }
.error-msg { color: #c00; font-size: 12px; margin-top: 4px; }
.quick-examples { margin-top: 24px; }
.quick-examples h3 { margin: 0 0 12px 0; }
.example-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: flex; flex-direction: column; align-items: flex-start; background: white; border: 1px solid #ddd; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.chip:hover { background: #f1f5f9; border-color: #94a3b8; }
.chip-pattern { font-family: monospace; font-size: 11px; color: #666; margin-top: 2px; }
</style>