<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import TravelBrand from '@/components/TravelBrand.vue'
import { authApi } from '@/api/authApi'
import { useAuthStore } from '@/store/auth'
import { getErrorMessage } from '@/utils/errors'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const mode = ref<'login' | 'register'>('login')
const form = reactive({ username: '', password: '', confirmPassword: '' })
const error = ref('')
const registering = ref(false)
const busy = computed(() => auth.loading || registering.value)

function changeMode(nextMode: 'login' | 'register') {
  if (busy.value) return
  mode.value = nextMode
  error.value = ''
}

async function submit() {
  if (busy.value) return
  error.value = ''
  if (mode.value === 'login') {
    if (!form.username || !form.password) { error.value = '请输入账号和密码'; return }
    try {
      await auth.login({ username: form.username, password: form.password })
      ElMessage.success('登录成功')
      router.push(String(route.query.redirect || '/workspace'))
    } catch (err) {
      error.value = getErrorMessage(err, '登录失败，请检查账号信息')
    }
    return
  }

  const username = form.username.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,32}$/.test(username)) { error.value = '账号需为 3–32 位字母、数字或下划线'; return }
  if (form.password.length < 8 || form.password.length > 64 || new TextEncoder().encode(form.password).length > 72) { error.value = '密码需为 8–64 个字符，且 UTF-8 编码不超过 72 字节'; return }
  if (form.password !== form.confirmPassword) { error.value = '两次输入的密码不一致'; return }

  registering.value = true
  try {
    const user = await authApi.register({ username, password: form.password })
    form.username = user.username
    form.password = ''
    form.confirmPassword = ''
    mode.value = 'login'
    ElMessage.success('注册成功，请登录')
  } catch (err) {
    error.value = getErrorMessage(err, '注册失败，请稍后重试')
  } finally {
    registering.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <header class="login-header"><TravelBrand /><span class="login-space-label">企业内部工作空间</span></header>
    <div class="login-content">
      <section class="login-intro"><h1>专注工作，<br />差旅交给助手。</h1><p>从了解差旅标准，到安排下一次出行。<br />一个对话，把出差的事情理清楚。</p><div class="trip-preview" aria-hidden="true"><div class="preview-route"><span class="route-node" /><span class="route-line" /><svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="m6 16 20-9-7 20-4-9-9-2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg><span class="route-line" /><span class="route-node destination" /></div><div class="preview-labels"><span>出发有计划</span><span>抵达更从容</span></div></div><ul class="intro-capabilities"><li>差旅政策查询</li><li>行程方案规划</li><li>交通与住宿建议</li></ul></section>
      <section class="login-panel" aria-labelledby="login-title"><div class="login-card">
        <div class="auth-mode" role="group" aria-label="账号操作">
          <button type="button" :aria-pressed="mode === 'login'" :disabled="busy" :class="{ active: mode === 'login' }" @click="changeMode('login')">登录</button>
          <button type="button" :aria-pressed="mode === 'register'" :disabled="busy" :class="{ active: mode === 'register' }" @click="changeMode('register')">注册</button>
        </div>
        <h2 id="login-title">{{ mode === 'login' ? '登录途灵' : '创建企业账号' }}</h2>
        <p class="login-description">{{ mode === 'login' ? '使用企业账号，继续你的差旅安排。' : '注册后即可使用企业差旅工作空间。' }}</p>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="企业账号"><el-input v-model="form.username" size="large" aria-label="企业账号" placeholder="请输入企业账号" :prefix-icon="User" autocomplete="username" /></el-form-item>
          <el-form-item label="密码"><el-input v-model="form.password" size="large" type="password" aria-label="密码" show-password placeholder="请输入密码" :prefix-icon="Lock" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" /></el-form-item>
          <el-form-item v-if="mode === 'register'" label="确认密码"><el-input v-model="form.confirmPassword" size="large" type="password" aria-label="确认密码" show-password placeholder="请再次输入密码" :prefix-icon="Lock" autocomplete="new-password" @keyup.enter="submit" /></el-form-item>
          <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="login-error" />
          <el-button native-type="submit" size="large" type="primary" :loading="busy" class="login-button">{{ mode === 'login' ? '登录' : '注册' }}</el-button>
        </el-form>
      </div></section>
    </div>
    <footer class="login-footer">途灵<span>仅供企业内部使用</span></footer>
  </main>
</template>

<style scoped>
.login-page { display: flex; flex-direction: column; min-height: 100dvh; background: #fff; }
.login-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 32px 5vw; }
.login-space-label { color: var(--text-muted); font-size: 12px; }
.login-content { display: grid; grid-template-columns: 1fr 1fr; align-items: center; flex: 1; gap: clamp(48px, 8vw, 140px); width: min(1040px, 88vw); margin: 40px auto 70px; }
.login-intro { max-width: 460px; padding: 24px 0; }
.login-intro h1 { margin: 0 0 24px; color: var(--text); font-size: clamp(34px, 3.5vw, 48px); font-weight: 550; line-height: 1.45; letter-spacing: -.04em; }
.login-intro > p { margin: 0; color: #748094; font-size: 15px; line-height: 2; }
.trip-preview { max-width: 350px; margin-top: 52px; }
.preview-route { display: flex; align-items: center; gap: 14px; color: #6a87c3; }
.route-node { width: 9px; height: 9px; border: 2px solid #a0aec8; border-radius: 50%; }.destination { border-color: #315eca; }
.route-line { flex: 1; border-top: 1px dashed #cbd4e4; }
.preview-labels { display: flex; justify-content: space-between; margin-top: 15px; color: #7a8597; font-size: 11px; }
.intro-capabilities { display: flex; flex-wrap: wrap; gap: 20px; list-style: none; padding: 28px 0 0; margin: 30px 0 0; border-top: 1px solid var(--line); color: #687386; font-size: 12px; }
.login-panel { padding-left: 52px; border-left: 1px solid var(--line); }
.login-card { max-width: 360px; margin: 0 auto; }.login-card h2 { margin: 0 0 12px; color: var(--text); font-size: 25px; font-weight: 550; }
.auth-mode { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; margin-bottom: 28px; border: 1px solid var(--line); border-radius: 6px; background: #f7f8fa; }
.auth-mode button { min-height: 36px; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); font: inherit; cursor: pointer; }
.auth-mode button.active { background: #fff; color: var(--text); box-shadow: 0 1px 3px rgb(22 34 51 / 12%); }
.auth-mode button:disabled { cursor: not-allowed; opacity: .65; }
.login-description { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.8; }
.login-card :deep(.el-form) { margin-top: 34px; }.login-card :deep(.el-form-item) { margin-bottom: 22px; }.login-card :deep(.el-input__wrapper) { min-height: 44px; font-size: 13px; }.login-card :deep(.el-form-item__label) { margin-bottom: 8px; padding: 0; font-size: 13px; }
.login-error { margin-bottom: 18px; }.login-button { width: 100%; margin-top: 6px; height: 44px; border-radius: 6px; }
.login-footer { display: flex; justify-content: center; gap: 18px; padding: 24px; color: #929aa8; font-size: 11px; }
.login-footer span { padding-left: 18px; border-left: 1px solid var(--line); }
@media (max-width: 900px) { .login-content { gap: 40px; }.login-panel { padding-left: 32px; }.login-intro h1 { font-size: 34px; }.intro-capabilities { gap: 12px; } }
@media (max-width: 720px) { .login-header { padding: 24px; }.login-space-label { font-size: 10px; }.login-content { display: block; width: 100%; margin: 20px auto 40px; padding: 0 24px; }.login-intro { display: none; }.login-panel { border: 0; padding: 48px 0; }.login-card h2 { font-size: 26px; }.login-footer { font-size: 10px; } }
</style>
