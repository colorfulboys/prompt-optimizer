<!--
  🇨🇳 R47:付费演示弹窗(Sprint 1.5 完整版)
  Sprint 1: 占位 — 显示套餐预览,点击都显示"暂未开通"
-->
<template>
  <div class="paywall-overlay" @click.self="$emit('close')">
    <div class="paywall-dialog">
      <button class="close-btn" @click="$emit('close')">×</button>

      <header class="paywall-header">
        <h2>💎 简盒付费方案</h2>
        <p>选购套餐,微信扫码支付 · 自动到账</p>
      </header>

      <div class="paywall-body">
        <!-- 订阅 -->
        <section class="plan-section">
          <h3>订阅(每月自动续费)</h3>
          <div class="plan-grid">
            <div v-for="plan in subscriptionPlans" :key="plan.id" class="plan-card">
              <h4>{{plan.name}}</h4>
              <div class="plan-price">¥<span>{{plan.price}}</span><small>/月</small></div>
              <ul class="plan-features">
                <li v-for="f in plan.features" :key="f">{{f}}</li>
              </ul>
              <button class="plan-btn" @click="onSubscribe(plan)">{{plan.cta}}</button>
            </div>
          </div>
        </section>

        <!-- 充值 -->
        <section class="plan-section">
          <h3>充值(一次购买,余额永久有效)</h3>
          <div class="plan-grid">
            <div v-for="pack in topupPlans" :key="pack.id" class="plan-card">
              <h4>{{pack.name}}</h4>
              <div class="plan-price">¥<span>{{pack.price}}</span></div>
              <div class="plan-meta">{{pack.minutes}} 分钟 · ¥{{pack.perMin}}/分</div>
              <ul class="plan-features">
                <li v-for="f in pack.features" :key="f">{{f}}</li>
              </ul>
              <button class="plan-btn" @click="onTopup(pack)">{{pack.cta}}</button>
            </div>
          </div>
        </section>

        <!-- 支付方式 -->
        <section class="pay-section">
          <h3>支付方式(正式开通后可用)</h3>
          <div class="pay-methods">
            <button class="pay-method" @click="onPay('wechat')">💬 微信支付</button>
            <button class="pay-method" @click="onPay('alipay')">🅰️ 支付宝</button>
            <button class="pay-method" @click="onPay('card')">💳 信用卡</button>
            <button class="pay-method" @click="onPay('paypal')">🌍 PayPal</button>
          </div>
        </section>
      </div>

      <footer class="paywall-footer">
        ⚠️ 现在是试用期,所有功能免费试用 · 正式开通后将自动启用付费
      </footer>
    </div>

    <!-- 🇨🇳 R57:微信扫码支付弹窗 -->
    <div v-if="showQrcode" class="paywall-overlay" @click.self="closeQrcode">
      <div class="qrcode-dialog">
        <button class="close-btn" @click="closeQrcode">×</button>

        <h2>💬 微信扫码支付</h2>
        <div class="qrcode-plan">{{ payPlanName }} · ¥{{ payAmount }}</div>

        <div v-if="payStatus === 'creating'" class="qrcode-loading">
          <div class="spinner"></div>
          <p>正在创建订单...</p>
        </div>

        <div v-else-if="payStatus === 'waiting'" class="qrcode-content">
          <!-- 真模式:显示微信返回的二维码 -->
          <div class="qrcode-img-wrap">
            <img v-if="payOrderId" :src="`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent('weixin://wxpay/bizpayurl?pr=' + payOrderId)}`" alt="支付二维码" class="qrcode-img" />
            <p class="qrcode-tip">用微信扫一扫完成支付</p>
            <p class="qrcode-order">订单号:{{ payOrderId }}</p>
          </div>
          <div class="qrcode-status">
            <div class="spinner"></div>
            <p>等待支付...</p>
            <button class="mock-confirm-btn" @click="mockConfirmPay">✅ 模拟确认(开发用)</button>
          </div>
        </div>

        <div v-else-if="payStatus === 'paid'" class="qrcode-paid">
          <div class="success-icon">✓</div>
          <h3>支付成功!</h3>
          <p>已自动到账,3 秒后关闭...</p>
        </div>

        <div v-else-if="payStatus === 'expired'" class="qrcode-expired">
          <h3>订单已过期</h3>
          <p>请重新选择套餐下单</p>
          <button class="plan-btn" @click="closeQrcode">关闭</button>
        </div>

        <div v-else-if="payStatus === 'error'" class="qrcode-error">
          <h3>出错了</h3>
          <p>{{ payErrorMsg }}</p>
          <button class="plan-btn" @click="closeQrcode">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserPlanStore } from '@/stores/useUserPlan'
const userPlan = useUserPlanStore()

const props = defineProps<{
  mode?: 'transcribe' | 'vocal'  // 🇨🇳 触发源,影响文案
}>()
const emit = defineEmits<{
  close: []
  subscribed: [planId: string]   // 🇨🇳 用户点了订阅
  topuped: [minutes: number]      // 🇨🇳 用户点了充值
}>()

const subscriptionPlans = [
  { id: 'plus', name: 'Plus 月度', price: 29, cta: '选择 Plus',
    features: ['转写 60 分钟/月', '人声分离 60 分钟/月', '浏览器端全免费'] },
  { id: 'pro', name: 'Pro 月度', price: 69, cta: '选择 Pro ⭐',
    features: ['转写 60 分钟/月', '人声分离 200 分钟/月', '浏览器端全免费', '优先处理队列'] },
  { id: 'studio', name: 'Studio 月度', price: 129, cta: '选择 Studio',
    features: ['转写不限', '人声分离 600 分钟/月', '浏览器端全免费', '优先队列', '早期新功能'] },
]
const topupPlans = [
  { id: 'mini', name: '体验包', price: 9, minutes: 60, perMin: '0.15', cta: '选择体验包',
    features: ['通用(转写/分离)', '永久有效'] },
  { id: 'value', name: '划算包', price: 49, minutes: 400, perMin: '0.12', cta: '选择划算包 ⭐',
    features: ['通用(转写/分离)', '永久有效'] },
  { id: 'bulk', name: '大量包', price: 199, minutes: 2000, perMin: '0.10', cta: '选择大量包',
    features: ['通用(转写/分离)', '永久有效'] },
]

function onSubscribe(plan: any) {
  // 🇨🇳 R57:真支付流程 → 调 /api/pay/create-order
  startPay(plan.id, plan.name, plan.price)
}
function onTopup(pack: any) {
  // 🇨🇳 R57:真支付流程
  startPay(pack.id, pack.name, pack.price)
}

/** 🇨🇳 R57:启动支付流程(调后端 + 展示二维码) */
const showQrcode = ref(false)
const payOrderId = ref('')
const payPlanName = ref('')
const payAmount = ref(0)
const payStatus = ref<'creating' | 'waiting' | 'paid' | 'expired' | 'error'>('creating')
const payErrorMsg = ref('')
const payPollTimer = ref<any>(null)

async function startPay(planId: string, planName: string, priceYuan: number) {
  showQrcode.value = true
  payPlanName.value = planName
  payAmount.value = priceYuan
  payStatus.value = 'creating'
  payErrorMsg.value = ''
  payOrderId.value = ''

  // 拿 token
  const token = localStorage.getItem('jianhebox_auth_token')
  if (!token) {
    payStatus.value = 'error'
    payErrorMsg.value = '请先登录'
    return
  }

  try {
    // 1. 创建订单
    const r = await fetch('/api/pay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ planId }),
    })
    const data = await r.json()
    if (!data.ok) {
      payStatus.value = 'error'
      payErrorMsg.value = data.error || '订单创建失败'
      return
    }
    payOrderId.value = data.orderId
    payStatus.value = 'waiting'

    // 2. 启动轮询(每 3 秒查一次)
    if (payPollTimer.value) clearInterval(payPollTimer.value)
    payPollTimer.value = setInterval(async () => {
      try {
        const sr = await fetch(`/api/pay/order-status?orderId=${data.orderId}&token=${token}`)
        const sd = await sr.json()
        if (sd.ok && sd.status === 'paid') {
          payStatus.value = 'paid'
          clearInterval(payPollTimer.value)
          payPollTimer.value = null
          // 通知上层
          if (data.planId?.includes && false) {} // noop
          emit('subscribed', planId)
          // 3 秒后自动关闭
          setTimeout(() => {
            showQrcode.value = false
          }, 3000)
        } else if (sd.ok && sd.status === 'expired') {
          payStatus.value = 'expired'
          clearInterval(payPollTimer.value)
          payPollTimer.value = null
        }
      } catch {
        // 网络失败重试
      }
    }, 3000)
  } catch (e) {
    payStatus.value = 'error'
    payErrorMsg.value = '网络错误: ' + (e as Error).message
  }
}

/** 🇨🇳 R57:模拟确认(dev 用,VITE_PAY_MOCK=1 时启用) */
async function mockConfirmPay() {
  if (!payOrderId.value) return
  const token = localStorage.getItem('jianhebox_auth_token')
  try {
    const r = await fetch('/api/pay/mock-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: payOrderId.value }),
    })
    const data = await r.json()
    if (data.ok) {
      payStatus.value = 'paid'
      if (payPollTimer.value) clearInterval(payPollTimer.value)
      setTimeout(() => {
        showQrcode.value = false
        location.reload()  // 刷新用户中心
      }, 2000)
    }
  } catch (e) {
    payErrorMsg.value = 'Mock 确认失败: ' + (e as Error).message
  }
}

function closeQrcode() {
  showQrcode.value = false
  if (payPollTimer.value) {
    clearInterval(payPollTimer.value)
    payPollTimer.value = null
  }
}

function onPay(method: string) {
  const name = { wechat: '微信支付', alipay: '支付宝', card: '信用卡', paypal: 'PayPal' }[method]
  alert(`${name} — 简盒 v1 暂时只支持微信支付(Native 扫码),请选套餐走微信支付流程`)
}
</script>

<style scoped>
.paywall-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.paywall-dialog {
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  width: 100%;
  max-width: 960px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  color: #ffffff;
}
.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: rgba(255,255,255,0.08);
  border: none;
  border-radius: 50%;
  color: #ffffff;
  font-size: 20px;
  cursor: pointer;
  z-index: 1;
}
.paywall-header {
  padding: 32px 32px 16px;
  text-align: center;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.paywall-header h2 { font-size: 24px; margin: 0 0 8px; }
.paywall-header p { color: rgba(255,255,255,0.6); margin: 0; font-size: 14px; }

.paywall-body { padding: 24px 32px; }
.plan-section { margin-bottom: 32px; }
.plan-section h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5); margin: 0 0 16px; }

.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.plan-card {
  padding: 20px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  text-align: center;
}
.plan-card h4 { font-size: 16px; margin: 0 0 8px; }
.plan-price { font-size: 14px; margin-bottom: 8px; color: rgba(255,255,255,0.6); }
.plan-price span { font-size: 36px; font-weight: 700; color: #ffffff; }
.plan-price small { font-size: 14px; }
.plan-meta { font-size: 13px; color: rgba(255,255,255,0.55); margin-bottom: 12px; }
.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  text-align: left;
}
.plan-features li { padding: 4px 0; }
.plan-features li::before { content: '✓ '; color: #00cc88; }

.plan-btn {
  width: 100%;
  padding: 10px;
  background: rgba(0,153,255,0.18);
  border: 1px solid rgba(0,153,255,0.4);
  border-radius: 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.plan-btn:hover { background: rgba(0,153,255,0.3); }

.pay-section h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5); margin: 0 0 16px; }
.pay-methods { display: flex; gap: 12px; flex-wrap: wrap; }
.pay-method {
  flex: 1;
  min-width: 120px;
  padding: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}
.pay-method:hover { background: rgba(255,255,255,0.08); }

.paywall-footer {
  padding: 16px 32px 24px;
  text-align: center;
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  border-top: 1px solid rgba(255,255,255,0.08);
}
/* 🇨🇳 R57:扫码支付弹窗 */
.qrcode-dialog {
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  width: 100%;
  max-width: 480px;
  padding: 32px;
  position: relative;
  color: #fff;
  text-align: center;
}
.qrcode-dialog h2 {
  margin: 0 0 8px;
  font-size: 24px;
}
.qrcode-plan {
  color: #4ec9b0;
  font-size: 18px;
  margin-bottom: 24px;
}
.qrcode-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.qrcode-img-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.qrcode-img {
  width: 240px;
  height: 240px;
  border-radius: 8px;
  background: #fff;
  padding: 12px;
}
.qrcode-tip {
  margin: 12px 0 4px;
  color: #aaa;
  font-size: 14px;
}
.qrcode-order {
  margin: 0;
  color: #666;
  font-size: 12px;
  font-family: monospace;
}
.qrcode-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #aaa;
  margin-top: 8px;
}
.mock-confirm-btn {
  margin-top: 8px;
  padding: 6px 14px;
  background: rgba(255, 200, 0, 0.15);
  border: 1px solid rgba(255, 200, 0, 0.4);
  border-radius: 6px;
  color: #ffc800;
  cursor: pointer;
  font-size: 13px;
}
.qrcode-loading, .qrcode-paid, .qrcode-expired, .qrcode-error {
  padding: 40px 0;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #4ec9b0;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #4ec9b0;
  color: #1a1a1a;
  font-size: 40px;
  line-height: 64px;
  margin: 0 auto 16px;
}
</style>