<!--
  🇨🇳 R56 2026-09-11:3 个独立弹框(登录/注册/忘记密码)
  - 弹框之间互相切换(关闭一个,打开另一个)
  - 参照 GitHub / 阿里云 / 微信 PC 的标准流程
-->
<template>
  <div class="avatar-menu">
    <!-- 已登录:头像链接到个人中心 -->
    <router-link v-if="auth.isLoggedIn" to="/account" class="av-avatar-link" title="个人中心">
      <span class="av-avatar">{{ avatarInitial }}</span>
    </router-link>

    <!-- 未登录:登录按钮 + 3 个弹框 -->
    <template v-else>
      <button class="av-login-btn" @click="showLogin = true">登录</button>

      <LoginModal :show="showLogin" @close="showLogin = false" @openRegister="openRegister" @openForgot="openForgot" @success="onSuccess" />
      <RegisterModal :show="showRegister" @close="showRegister = false" @openLogin="openLogin" @success="onRegisterSuccess" />
      <ForgotPasswordModal :show="showForgot" @close="showForgot = false" @openLogin="openLogin" @success="onForgotSuccess" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import LoginModal from './LoginModal.vue'
import RegisterModal from './RegisterModal.vue'
import ForgotPasswordModal from './ForgotPasswordModal.vue'

const auth = useAuthStore()

const showLogin = ref(false)
const showRegister = ref(false)
const showForgot = ref(false)

const avatarInitial = computed(() => {
  const name = auth.user?.name || auth.user?.email || ''
  return name[0]?.toUpperCase() || '?'
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
</script>

<style scoped>
.avatar-menu {
  display: inline-flex;
  align-items: center;
}

.av-login-btn {
  background: linear-gradient(135deg, #4a8eff, #6cf);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}

.av-login-btn:hover {
  filter: brightness(1.1);
}

.av-avatar-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.av-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a8eff, #6cf);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s;
}

.av-avatar:hover {
  transform: scale(1.1);
}
</style>