<template>
  <!-- 🇨🇳 2026-08-31:M2 全局{{ t('login.submit') }}按钮 + 用户区(放在每个 nav 最右) -->
  <div class="global-user-area" :data-logged-in="auth.isLoggedIn ? 'true' : 'false'">
    <template v-if="auth.isLoggedIn">
      <!-- 🇨🇳 R57:头像 chip 改为可点击,跳 /account -->
      <router-link to="/account" class="g-user-chip" :title="auth.user?.email || auth.user?.phone || '个人中心'">
        <img v-if="auth.user?.avatar_url" :src="auth.user.avatar_url" class="g-avatar" />
        <span v-else class="g-avatar g-avatar-placeholder">{{ (auth.user?.name || auth.user?.email || auth.user?.phone || '?')[0].toUpperCase() }}</span>
        <span class="g-name">{{ gDisplayName }}</span>
      </router-link>
      <button class="btn btn-icon btn-secondary" @click="auth.logout()" title="退出{{ t('login.submit') }}" aria-label="退出{{ t('login.submit') }}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </template>
    <!-- 🇨🇳 2026-08-31 M3.9 R35:nav 内特殊背景用 .g-login-btn (蓝底白字,nav 黑色磨砂背景对比强) -->
    <button v-else class="g-login-btn" @click="showLogin = true">{{ t('login.submit') }}</button>

    <!-- 3 个独立弹框({{ t('login.submit') }}/注册/忘记密码)互相切换 -->
    <LoginModal :show="showLogin" @close="showLogin = false" @openRegister="openRegister" @openForgot="openForgot" @success="onSuccess" />
    <RegisterModal :show="showRegister" @close="showRegister = false" @openLogin="openLogin" @success="onRegisterSuccess" />
    <ForgotPasswordModal :show="showForgot" @close="showForgot = false" @openLogin="openLogin" @success="onForgotSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useAuthStore } from '@/stores/auth'
import LoginModal from './LoginModal.vue'
import RegisterModal from './RegisterModal.vue'
import ForgotPasswordModal from './ForgotPasswordModal.vue'

const auth = useAuthStore()
const showLogin = ref(false)
const showRegister = ref(false)
const showForgot = ref(false)

// 名字显示策略:有名字就显示名字,否则显示邮箱的 @ 前缀
const gDisplayName = computed(() => {
  const u = auth.user
  if (!u) return ''
  if (u.name) return u.name
  if (u.email) return u.email.split('@')[0]
  return '用户'
})

function openRegister() {
  showLogin.value = false
  showRegister.value = true
}
function openForgot() {
  showLogin.value = false
  showForgot.value = true
}
function openLogin() {
  showRegister.value = false
  showForgot.value = false
  showLogin.value = true
}
function onSuccess() {
  showLogin.value = false
}
function onRegisterSuccess() {
  showRegister.value = false
  showLogin.value = true
}
function onForgotSuccess() {
  showForgot.value = false
  showLogin.value = true
}

onMounted(async () => {
  // OAuth 回调回来后 token 已经在 localStorage,但 user 没拉
  if (auth.token && !auth.user) {
    await auth.fetchUser()
  }
})
</script>

<style scoped>
.global-user-area {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 4px;
}

/* 🇨🇳 2026-09-01 R37 需求3:移动端 margin-left 由绝对定位接管,避免双重偏移 */
@media (max-width: 720px) {
  .global-user-area {
    margin-left: 0;
  }
}

/* 已{{ t('login.submit') }}态:头像 + 名字合并成一个 chip(磨砂玻璃,跟 .btn-frost 同款) */
.g-user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.18);
  padding: 3px 10px 3px 3px;
  border-radius: 100px;
  cursor: pointer;
  max-width: 160px;
  color: var(--white);
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}

.g-user-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(100, 150, 255, 0.5);
}

.g-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.g-avatar-placeholder {
  background: linear-gradient(135deg, #4f7cf2, #6c5ce7);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  width: 22px;
  height: 22px;
}

.g-name {
  font-size: 12.5px;
  color: #ddd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 110px;
  font-weight: 500;
}

/* 未{{ t('login.submit') }}:{{ t('login.submit') }}按钮(跟 .btn-frost 同款:磨砂玻璃,系统级一致) */
.g-login-btn {
  padding: 7px 16px;
  border-radius: 100px;
  /* 🇨🇳 2026-08-31 M3.9 R35:nav 黑色磨砂背景下,用 #09f 蓝(M3 设计铁律不准用紫色,但蓝色是品牌色 OK) */
  background: #09f;
  border: 1px solid #09f;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.g-login-btn:hover {
  background: #0086e6;
  border-color: #0086e6;
  box-shadow: 0 0 0 3px rgba(0, 153, 255, 0.3);
}

/* 退出按钮:icon-only(跟 .btn-frost 同款,小一档) */
.g-icon-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #ccc;
  border-radius: 100px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.g-icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(0, 153, 255, 0.6);
  color: var(--white);
  box-shadow: 0 0 0 3px rgba(0, 153, 255, 0.18);
}

@media (max-width: 600px) {
  .g-user-chip { max-width: 100px; }
  .g-name { max-width: 60px; }
}
</style>