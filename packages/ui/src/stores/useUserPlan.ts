/**
 * 🇨🇳 2026-09-02 R47.5:用户付费方案 Pinia Store
 *
 * 管理:
 *   - 订阅计划(Plus/Pro/Studio/free)
 *   - 充值余额(分钟)
 *   - 转写续费次数(只能续 1 次)
 *   - 试用/正式期 flag
 *
 * Sprint 1.5:全部 mock,Sprint 5 接真支付
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type PlanId = 'free' | 'plus' | 'pro' | 'studio'

interface PlanConfig {
  id: PlanId
  name: string
  transcribeMinPerMonth: number  // -1 = 不限
  vocalSeparateMinPerMonth: number
}

const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  free: { id: 'free', name: '免费', transcribeMinPerMonth: 30, vocalSeparateMinPerMonth: 0 },
  plus: { id: 'plus', name: 'Plus', transcribeMinPerMonth: 60, vocalSeparateMinPerMonth: 60 },
  pro: { id: 'pro', name: 'Pro', transcribeMinPerMonth: 60, vocalSeparateMinPerMonth: 200 },
  studio: { id: 'studio', name: 'Studio', transcribeMinPerMonth: -1, vocalSeparateMinPerMonth: 600 },
}

const STORAGE_KEY = 'jianhebox_user_plan'

interface PersistedState {
  plan: PlanId
  transcribeRenewed: boolean  // 是否已续 30 分钟(只能 1 次)
  topupBalanceMin: number     // 充值余额(分钟)
  vocalSeparateTrialMin: number  // 人声分离测试额度(0-60)
  vocalSeparateTrialUsed: boolean  // 是否已用过测试额度
  isTrialPeriod: boolean
}

function loadPersisted(): PersistedState {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return {
    plan: 'free',
    transcribeRenewed: false,
    topupBalanceMin: 0,
    vocalSeparateTrialMin: 60,
    vocalSeparateTrialUsed: false,
    isTrialPeriod: true,
  }
}

function savePersisted(state: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useUserPlanStore = defineStore('userPlan', () => {
  // 🇨🇳 状态(从 localStorage 恢复)
  const plan = ref<PlanId>(loadPersisted().plan)
  const transcribeRenewed = ref<boolean>(loadPersisted().transcribeRenewed)
  const topupBalanceMin = ref<number>(loadPersisted().topupBalanceMin)
  const vocalSeparateTrialMin = ref<number>(loadPersisted().vocalSeparateTrialMin)
  const vocalSeparateTrialUsed = ref<boolean>(loadPersisted().vocalSeparateTrialUsed)
  const isTrialPeriod = ref<boolean>(loadPersisted().isTrialPeriod)

  // 🇨🇳 持久化副作用
  function persist() {
    savePersisted({
      plan: plan.value,
      transcribeRenewed: transcribeRenewed.value,
      topupBalanceMin: topupBalanceMin.value,
      vocalSeparateTrialMin: vocalSeparateTrialMin.value,
      vocalSeparateTrialUsed: vocalSeparateTrialUsed.value,
      isTrialPeriod: isTrialPeriod.value,
    })
  }

  // 🇨🇳 转写:本月总配额(订阅用户 = 套餐配额,免费用户 = 30 + 续30)
  const transcribeQuotaMin = computed(() => {
    const cfg = PLAN_CONFIGS[plan.value]
    let q = cfg.transcribeMinPerMonth
    if (plan.value === 'free') {
      q = 30
      if (transcribeRenewed.value) q += 30  // 已续:60
    }
    return q
  })

  // 🇨🇳 9-3 R49.4:转写:已用秒数(本地累加,Sprint 5 接服务器真扣)
  const transcribeUsedSec = ref<number>(0)
  const transcribeUsedMin = computed(() => Math.floor(transcribeUsedSec.value / 60))

  // 🇨🇳 转写:剩余
  const transcribeRemainingMin = computed(() => {
    return Math.max(0, transcribeQuotaMin.value - transcribeUsedMin.value)
  })

  // 🇨🇳 人声分离:套餐月配额
  const vocalSeparateQuotaMin = computed(() => {
    if (isTrialPeriod.value && !vocalSeparateTrialUsed.value) {
      // 🇨🇳 试用期未用过:60 分钟测试额度(只在订阅用户上叠加,免费用户走试用)
      return Math.max(60, PLAN_CONFIGS[plan.value].vocalSeparateMinPerMonth)
    }
    return PLAN_CONFIGS[plan.value].vocalSeparateMinPerMonth
  })

  // 🇨🇳 是否需要付费弹窗(人声分离)
  const needPaywallForVocal = computed(() => {
    // 🇨🇳 试用期:已用过测试额度 且 不是付费用户
    if (isTrialPeriod.value && vocalSeparateTrialUsed.value && plan.value === 'free') {
      return true
    }
    return false
  })

  // 🇨🇳 是否需要付费弹窗(转写超限)
  const needPaywallForTranscribe = computed(() => {
    return transcribeRemainingMin.value === 0 && !isTrialPeriod.value
  })

  // 🇨🇳 Actions

  /** 🇨🇳 mock 订阅(试用期间也用,只是不真扣钱) */
  function mockSubscribe(targetPlan: PlanId) {
    plan.value = targetPlan
    persist()
  }

  /** 🇨🇳 mock 充值(试用期间也用) */
  function mockTopup(minutes: number) {
    topupBalanceMin.value += minutes
    persist()
  }

  /** 🇨🇳 续 30 分钟(只能 1 次) */
  function renewTranscribe() {
    if (transcribeRenewed.value) return false
    transcribeRenewed.value = true
    persist()
    return true
  }

  /** 🇨🇳 用人声分离测试额度(一次性) */
  function consumeVocalTrial(): boolean {
    if (vocalSeparateTrialUsed.value) return false
    vocalSeparateTrialUsed.value = true
    persist()
    return true
  }

  /** 🇨🇳 9-3 R49.4:本地累加转写秒数(Sprint 5 接服务器真扣) */
  function consumeTranscribe(sec: number): void {
    if (sec <= 0) return
    transcribeUsedSec.value += sec
  }

  /** 🇨🇳 重置(Sprint 调试用) */
  function reset() {
    plan.value = 'free'
    transcribeRenewed.value = false
    topupBalanceMin.value = 0
    vocalSeparateTrialMin.value = 60
    vocalSeparateTrialUsed.value = false
    isTrialPeriod.value = true
    persist()
  }

  return {
    // 状态
    plan,
    transcribeRenewed,
    topupBalanceMin,
    vocalSeparateTrialMin,
    vocalSeparateTrialUsed,
    isTrialPeriod,
    transcribeUsedSec,
    // 计算属性
    transcribeQuotaMin,
    transcribeUsedMin,
    transcribeRemainingMin,
    vocalSeparateQuotaMin,
    needPaywallForVocal,
    needPaywallForTranscribe,
    // actions
    mockSubscribe,
    mockTopup,
    renewTranscribe,
    consumeVocalTrial,
    consumeTranscribe,
    reset,
  }
})