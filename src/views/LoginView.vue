<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, Lock, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'
import { getErrorMessage } from '@/utils/errors'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ username: '', password: '' })
const error = ref('')

async function submit() {
  if (!form.username || !form.password) { error.value = '请输入账号和密码'; return }
  error.value = ''
  try { await auth.login(form); ElMessage.success('登录成功'); router.push(String(route.query.redirect || '/workspace')) } catch (err) { error.value = getErrorMessage(err, '登录失败，请检查账号信息') }
}
</script>

<template>
  <main class="login-page"><section class="login-aside"><div class="brand-mark">行</div><p class="eyebrow">CORPORATE TRAVEL OPERATIONS</p><h1>让每一次出差，<br /><em>都更从容。</em></h1><p class="aside-copy">从政策咨询到行程规划，集中处理企业差旅中的每个决策节点。</p><div class="aside-footer"><span class="dot" /> 安全连接 · 企业内部专属</div></section><section class="login-panel"><div class="login-card"><p class="eyebrow">WELCOME BACK</p><h2>登录差旅工作台</h2><p class="muted">使用企业账号继续你的差旅安排</p><el-form @submit.prevent="submit"><el-form-item label="账号"><el-input v-model="form.username" size="large" placeholder="请输入账号" :prefix-icon="User" autocomplete="username" /></el-form-item><el-form-item label="密码"><el-input v-model="form.password" size="large" type="password" show-password placeholder="请输入密码" :prefix-icon="Lock" autocomplete="current-password" @keyup.enter="submit" /></el-form-item><el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="login-error" /><el-button native-type="button" size="large" type="primary" :loading="auth.loading" class="login-button" @click="submit">进入工作台<el-icon><ArrowRight /></el-icon></el-button></el-form></div><footer>Enterprise Travel Assistant · Internal use only</footer></section></main>
</template>

<style scoped>
.login-page { display: grid; grid-template-columns: minmax(380px, .9fr) minmax(420px, 1.1fr); min-height: 100vh; background: #f6f8f7; }
.login-aside { display: flex; flex-direction: column; justify-content: center; padding: 10vw; background: #102a27; color: #e7f4ef; }
.brand-mark { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 12px; background: #72d0b4; color: #102a27; font-size: 22px; font-weight: 700; }
.eyebrow { color: #70b9a5; font-size: 11px; letter-spacing: .18em; }
.login-aside h1 { margin: 18px 0; font-size: clamp(36px, 4vw, 58px); line-height: 1.18; letter-spacing: -.02em; }
.login-aside h1 em { color: #72d0b4; font-style: normal; }
.aside-copy { max-width: 360px; color: #a5c4bb; line-height: 1.8; }
.aside-footer { margin-top: 80px; color: #82a79d; font-size: 12px; }.dot { display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; background: #72d0b4; }
.login-panel { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; }.login-card { width: min(420px, 100%); }.login-card h2 { margin: 12px 0 4px; color: #1e3e39; font-size: 30px; }.login-card :deep(.el-form) { margin-top: 32px; }.login-error { margin: -2px 0 18px; }.login-button { width: 100%; }.login-button :deep(.el-icon) { margin-left: 8px; }.login-panel footer { position: fixed; bottom: 28px; color: #98a6a2; font-size: 11px; }
@media (max-width: 760px) { .login-page { display: block; }.login-aside { min-height: 260px; padding: 42px 28px 28px; }.login-aside h1 { font-size: 38px; }.aside-footer { margin-top: 24px; }.login-panel { min-height: calc(100vh - 260px); padding: 34px 24px 70px; }.login-panel footer { position: static; margin-top: 40px; } }
</style>
