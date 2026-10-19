<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import TravelBrand from '@/components/TravelBrand.vue'
import { useAuthStore } from '@/store/auth'
import { getErrorMessage } from '@/utils/errors'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ username: '', password: '' })
const error = ref('')

async function submit() {
  if (auth.loading) return
  if (!form.username || !form.password) { error.value = '请输入账号和密码'; return }
  error.value = ''
  try { await auth.login(form); ElMessage.success('登录成功'); router.push(String(route.query.redirect || '/workspace')) } catch (err) { error.value = getErrorMessage(err, '登录失败，请检查账号信息') }
}
</script>

<template>
  <main class="login-page">
    <header class="login-header"><TravelBrand /><span class="login-space-label">企业内部工作空间</span></header>
    <div class="login-content">
      <section class="login-intro"><h1>专注工作，<br />差旅交给助手。</h1><p>从了解差旅标准，到安排下一次出行。<br />一个对话，把出差的事情理清楚。</p><div class="trip-preview" aria-hidden="true"><div class="preview-route"><span class="route-node" /><span class="route-line" /><svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="m6 16 20-9-7 20-4-9-9-2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg><span class="route-line" /><span class="route-node destination" /></div><div class="preview-labels"><span>出发有计划</span><span>抵达更从容</span></div></div><ul class="intro-capabilities"><li>差旅政策查询</li><li>行程方案规划</li><li>交通与住宿建议</li></ul></section>
      <section class="login-panel" aria-labelledby="login-title"><div class="login-card"><h2 id="login-title">登录差旅助手</h2><p class="login-description">使用企业账号，继续你的差旅安排。</p><el-form label-position="top" @submit.prevent="submit"><el-form-item label="企业账号"><el-input v-model="form.username" size="large" aria-label="企业账号" placeholder="请输入企业账号" :prefix-icon="User" autocomplete="username" /></el-form-item><el-form-item label="密码"><el-input v-model="form.password" size="large" type="password" aria-label="密码" show-password placeholder="请输入密码" :prefix-icon="Lock" autocomplete="current-password" /></el-form-item><el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="login-error" /><el-button native-type="submit" size="large" type="primary" :loading="auth.loading" class="login-button">登录</el-button></el-form><p class="account-help"><el-icon><Lock /></el-icon>账号由企业管理员统一分配，请联系管理员获取。</p></div></section>
    </div>
    <footer class="login-footer">企业差旅助手<span>仅供企业内部使用</span></footer>
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
.login-description { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.8; }
.login-card :deep(.el-form) { margin-top: 34px; }.login-card :deep(.el-form-item) { margin-bottom: 22px; }.login-card :deep(.el-input__wrapper) { min-height: 44px; font-size: 13px; }.login-card :deep(.el-form-item__label) { margin-bottom: 8px; padding: 0; font-size: 13px; }
.login-error { margin-bottom: 18px; }.login-button { width: 100%; margin-top: 6px; height: 44px; border-radius: 6px; }
.account-help { display: flex; align-items: flex-start; gap: 6px; margin-top: 22px; color: #8791a1; font-size: 11px; line-height: 1.8; }.account-help .el-icon { flex-shrink: 0; margin-top: 4px; }
.login-footer { display: flex; justify-content: center; gap: 18px; padding: 24px; color: #929aa8; font-size: 11px; }
.login-footer span { padding-left: 18px; border-left: 1px solid var(--line); }
@media (max-width: 900px) { .login-content { gap: 40px; }.login-panel { padding-left: 32px; }.login-intro h1 { font-size: 34px; }.intro-capabilities { gap: 12px; } }
@media (max-width: 720px) { .login-header { padding: 24px; }.login-space-label { font-size: 10px; }.login-content { display: block; width: 100%; margin: 20px auto 40px; padding: 0 24px; }.login-intro { display: none; }.login-panel { border: 0; padding: 48px 0; }.login-card h2 { font-size: 26px; }.login-footer { font-size: 10px; } }
</style>
