<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, ChatLineRound, Close, Document, Expand, Fold, Plus, Search, Setting, SwitchButton, User } from '@element-plus/icons-vue'
import TravelBrand from '@/components/TravelBrand.vue'
import { useAuthStore } from '@/store/auth'
import { useConversationStore } from '@/store/conversation'
import { appConfig } from '@/config'

const auth = useAuthStore()
const conversations = useConversationStore()
const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const mobileOpen = ref(false)
const searchOpen = ref(false)
const search = ref('')
const searchInput = ref<HTMLInputElement>()
const loadError = ref('')
const creating = ref(false)
const sidebar = ref<HTMLElement>()
let previousFocus: HTMLElement | null = null
const isAdmin = computed(() => auth.isAdmin && appConfig.features.admin)
const pageTitle = computed(() => ({ '/admin/users': '用户管理', '/admin/config': '系统配置', '/admin/prompts': 'Prompt 管理' }[route.path] || conversations.activeConversation?.title || '新的差旅对话'))
const adminLinks = [
  { path: '/admin/users', label: '用户管理', icon: User },
  { path: '/admin/config', label: '系统配置', icon: Setting },
  { path: '/admin/prompts', label: 'Prompt 管理', icon: Document },
]
const groups = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const week = today.getTime() - 6 * 86400000
  const buckets = [{ label: '今天', items: [] as typeof conversations.conversations }, { label: '近 7 天', items: [] as typeof conversations.conversations }, { label: '更早的对话', items: [] as typeof conversations.conversations }]
  for (const item of conversations.conversations) {
    if (!item.title.toLowerCase().includes(search.value.trim().toLowerCase())) continue
    const timestamp = new Date(item.updateTime || item.createTime || 0).getTime()
    buckets[timestamp >= today.getTime() ? 0 : timestamp >= week ? 1 : 2].items.push(item)
  }
  return buckets.filter((group) => group.items.length)
})

watch(() => route.path, () => { mobileOpen.value = false })
watch(mobileOpen, async (open) => {
  if (open) {
    previousFocus = document.activeElement as HTMLElement
    await nextTick()
    sidebar.value?.querySelector<HTMLButtonElement>('.mobile-close')?.focus()
  } else {
    await nextTick()
    previousFocus?.focus()
  }
})
function closeOnDesktop() { if (window.innerWidth > 720) mobileOpen.value = false }
function trapFocus(event: KeyboardEvent) {
  if (!mobileOpen.value || event.key !== 'Tab') return
  const nodes = [...(sidebar.value?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input, [tabindex="0"]') || [])].filter((node) => node.getClientRects().length > 0)
  const first = nodes[0]; const last = nodes.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
async function load() {
  loadError.value = ''
  try { await conversations.loadConversations() } catch { loadError.value = '会话加载失败，请重试' }
}
onMounted(() => {
  window.addEventListener('resize', closeOnDesktop)
  if (route.query.denied) ElMessage.warning('当前账号没有管理员权限')
  load()
})
onBeforeUnmount(() => window.removeEventListener('resize', closeOnDesktop))
async function newConversation() {
  if (conversations.sending || creating.value) return
  creating.value = true
  try {
    await conversations.createConversation()
    await router.push('/workspace')
    mobileOpen.value = false
  } catch { ElMessage.error('新建对话失败，请重试') } finally { creating.value = false }
}
async function selectConversation(id: number) {
  if (conversations.sending) return
  try {
    await conversations.selectConversation(id)
    await router.push('/workspace')
    mobileOpen.value = false
  } catch { ElMessage.error('加载对话失败，请重试') }
}
async function toggleSearch() {
  collapsed.value = false
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) { await nextTick(); searchInput.value?.focus() } else search.value = ''
}
async function signOut() {
  try { await ElMessageBox.confirm('确定退出当前账号吗？', '退出登录', { confirmButtonText: '退出登录', cancelButtonText: '取消' }) } catch { return }
  conversations.stop()
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': collapsed, 'mobile-sidebar-open': mobileOpen }" @keydown.esc="mobileOpen = false">
    <button v-if="mobileOpen" class="sidebar-backdrop" aria-label="关闭会话侧栏" @click="mobileOpen = false" />
    <aside id="conversation-sidebar" ref="sidebar" class="app-sidebar" :role="mobileOpen ? 'dialog' : undefined" :aria-modal="mobileOpen ? true : undefined" aria-label="会话与账号" @keydown="trapFocus">
      <div class="sidebar-brand-row">
        <RouterLink to="/workspace" class="brand-link" aria-label="企业差旅助手首页"><TravelBrand :compact="collapsed" /></RouterLink>
        <button class="icon-button sidebar-fold" :aria-label="collapsed ? '展开侧栏' : '收起侧栏'" :title="collapsed ? '展开侧栏' : '收起侧栏'" @click="collapsed = !collapsed"><el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon></button>
        <button class="icon-button mobile-close" aria-label="关闭会话侧栏" @click="mobileOpen = false"><el-icon><Close /></el-icon></button>
      </div>
      <div class="sidebar-actions">
        <button class="new-chat-button" :disabled="conversations.sending || creating" title="新建对话" @click="newConversation"><el-icon><Plus /></el-icon><span class="sidebar-label">{{ creating ? '正在新建…' : '新建对话' }}</span></button>
        <button class="icon-button search-button" aria-label="搜索会话" title="搜索会话" :aria-expanded="searchOpen" @click="toggleSearch"><el-icon><Search /></el-icon></button>
      </div>
      <div v-if="searchOpen && !collapsed" class="sidebar-search"><el-icon><Search /></el-icon><input ref="searchInput" v-model="search" aria-label="搜索历史会话" placeholder="搜索历史会话" /><button v-if="search" class="icon-button" aria-label="清空搜索" @click="search = ''"><el-icon><Close /></el-icon></button></div>
      <div class="sidebar-history" :class="{ 'history-hidden': collapsed }" aria-label="历史对话" :aria-busy="conversations.loading">
        <p v-if="loadError" class="sidebar-empty" role="alert">{{ loadError }}<button class="text-button" @click="load">重新加载</button></p>
        <p v-else-if="conversations.loading" class="sidebar-empty">正在加载会话…</p>
        <template v-else>
          <section v-for="group in groups" :key="group.label" class="history-group"><h2>{{ group.label }}</h2><button v-for="item in group.items" :key="item.id" class="conversation-item" :class="{ active: item.id === conversations.activeId && route.path === '/workspace' }" :aria-current="item.id === conversations.activeId && route.path === '/workspace' ? 'page' : undefined" :disabled="conversations.sending" :title="item.title" @click="selectConversation(item.id)"><el-icon><ChatLineRound /></el-icon><span>{{ item.title }}</span></button></section>
          <div v-if="!groups.length" class="sidebar-empty"><span>{{ search ? '没有找到相关会话' : '还没有历史对话' }}</span><small>{{ search ? '试试其他关键词' : '从一段新的差旅安排开始' }}</small></div>
        </template>
      </div>
      <div class="sidebar-bottom">
        <div class="internal-label sidebar-label"><span />企业内部工作空间</div>
        <el-dropdown trigger="click" placement="top-start" class="account-dropdown"><button class="account-button" aria-label="账号菜单"><span class="account-avatar">{{ auth.user?.username?.slice(0, 1).toUpperCase() || 'U' }}</span><span class="account-details sidebar-label"><strong>{{ auth.user?.username }}</strong><small>{{ auth.isAdmin ? '管理员' : '企业员工' }}</small></span><el-icon class="sidebar-label"><ArrowDown /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item @click="signOut"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </div>
    </aside>
    <div class="app-body" :inert="mobileOpen">
      <header class="app-header">
        <div class="header-context"><button class="icon-button mobile-toggle" aria-label="打开会话侧栏" aria-controls="conversation-sidebar" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen"><el-icon><Expand /></el-icon></button><RouterLink v-if="route.path.startsWith('/admin')" class="workspace-return" to="/workspace">差旅助手</RouterLink><span v-if="route.path.startsWith('/admin')" class="context-divider">/</span><span class="current-page-title">{{ pageTitle }}</span></div>
        <nav v-if="isAdmin" class="admin-nav" aria-label="管理员菜单"><RouterLink v-for="link in adminLinks" :key="link.path" :to="link.path" class="admin-nav-link"><el-icon><component :is="link.icon" /></el-icon>{{ link.label }}</RouterLink></nav>
        <el-dropdown v-if="isAdmin" trigger="click" class="admin-mobile"><button class="admin-menu-button">管理菜单<el-icon><ArrowDown /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="link in adminLinks" :key="link.path" @click="router.push(link.path)">{{ link.label }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </header>
      <main id="main-content" class="app-main"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.app-shell { display: grid; grid-template-columns: 256px minmax(0, 1fr); height: 100dvh; overflow: hidden; background: var(--surface); }
.app-shell.sidebar-collapsed { grid-template-columns: 76px minmax(0, 1fr); }
.app-sidebar { display: flex; min-width: 0; flex-direction: column; padding: 0 14px; background: var(--sidebar); border-right: 1px solid var(--line); }
.sidebar-brand-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 80px; flex-shrink: 0; }
.brand-link { text-decoration: none; color: inherit; }
.sidebar-fold { color: var(--text-muted); }
.sidebar-actions { display: flex; gap: 8px; margin: 4px 0 22px; }
.new-chat-button { display: flex; height: 42px; flex: 1; align-items: center; gap: 10px; padding: 0 15px; border: 1px solid #dce3f0; border-radius: 8px; background: #ebeff8; color: #3159b3; font-weight: 500; cursor: pointer; white-space: nowrap; }
.new-chat-button:hover { background: #e2e8f5; }
.new-chat-button .el-icon { font-size: 18px; }
.search-button { flex: 0 0 36px; align-self: center; }
.sidebar-search { display: flex; align-items: center; gap: 8px; padding: 0 9px; height: 38px; margin-bottom: 12px; border: 1px solid var(--line); border-radius: 6px; background: white; color: var(--text-muted); }
.sidebar-search input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; font-size: 13px; }
.sidebar-search:focus-within { border-color: var(--accent); }
.sidebar-search .icon-button { width: 24px; height: 26px; }
.sidebar-history { flex: 1; min-height: 0; overflow-y: auto; margin: 0 -5px; padding: 0 5px; }
.history-group { margin-bottom: 22px; }
.history-group h2 { margin: 0; padding: 0 10px 9px; color: var(--text-muted); font-size: 12px; font-weight: 400; }
.conversation-item { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 40px; padding: 10px; margin-bottom: 3px; border: 0; border-radius: 6px; background: transparent; color: #50596a; text-align: left; cursor: pointer; font-size: 13px; }
.conversation-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conversation-item .el-icon { flex-shrink: 0; color: #8a93a3; font-size: 15px; }
.conversation-item:hover { background: #eceef2; }
.conversation-item.active { background: #e7eaf0; color: var(--text); font-weight: 500; }
.sidebar-empty { display: flex; gap: 8px; flex-direction: column; padding: 12px 10px; color: var(--text-muted); font-size: 13px; line-height: 1.7; }
.sidebar-empty small { font-size: 12px; }
.sidebar-bottom { margin-top: auto; padding: 16px 0 12px; }
.internal-label { display: flex; align-items: center; gap: 7px; margin: 0 10px 16px; color: var(--text-muted); font-size: 11px; }
.internal-label > span { width: 5px; height: 5px; border-radius: 50%; background: #7d8b9e; }
.account-dropdown { width: 100%; }
.account-button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 8px; border: 0; border-radius: 7px; background: transparent; text-align: left; cursor: pointer; color: var(--text); }
.account-button:hover { background: #e9ecf1; }
.account-avatar { display: grid; flex: 0 0 32px; height: 32px; place-items: center; border: 1px solid #dce2ec; border-radius: 50%; background: #e9edf5; color: #586984; font-size: 13px; font-weight: 600; }
.account-details { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; }
.account-details strong { overflow: hidden; text-overflow: ellipsis; font-size: 13px; font-weight: 500; }
.account-details small { color: var(--text-muted); font-size: 11px; }
.app-body { display: flex; min-width: 0; min-height: 0; flex-direction: column; }
.app-header { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 20px; height: 68px; padding: 0 32px; }
.header-context { display: flex; align-items: center; gap: 14px; min-width: 0; color: var(--text); font-size: 14px; }
.current-page-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-return { flex-shrink: 0; color: var(--text-muted); text-decoration: none; }
.workspace-return:hover { color: var(--accent); }
.context-divider { color: #c3cad4; }
.admin-nav { display: flex; gap: 7px; flex-shrink: 0; }
.admin-nav-link { display: flex; align-items: center; gap: 7px; padding: 9px 11px; border-radius: 6px; color: #697386; text-decoration: none; font-size: 12px; }
.admin-nav-link .el-icon { font-size: 15px; }
.admin-nav-link:hover { background: var(--sidebar); color: var(--text); }
.admin-nav-link.router-link-active { background: var(--accent-soft); color: var(--accent); }
.app-main { min-height: 0; flex: 1; overflow: auto; }
.admin-mobile, .mobile-toggle, .mobile-close, .sidebar-backdrop { display: none; }
.admin-menu-button { display: flex; align-items: center; gap: 8px; padding: 8px; border: 0; background: transparent; color: var(--text-muted); white-space: nowrap; cursor: pointer; font-size: 12px; }
.sidebar-collapsed .sidebar-label, .history-hidden, .sidebar-collapsed .search-button { display: none; }
.sidebar-collapsed .sidebar-brand-row { flex-direction: column; justify-content: center; height: 104px; gap: 4px; }
.sidebar-collapsed .sidebar-actions { justify-content: center; }
.sidebar-collapsed .new-chat-button { padding: 0; justify-content: center; }
.sidebar-collapsed .account-button { padding: 7px; justify-content: center; }
@media (max-width: 1050px) { .app-header { padding: 0 22px; }.admin-nav-link { padding: 9px 7px; }.admin-nav { gap: 2px; } }
@media (max-width: 900px) { .admin-nav { display: none; }.admin-mobile { display: inline-flex; } }
@media (max-width: 720px) {
  .app-shell, .app-shell.sidebar-collapsed { grid-template-columns: minmax(0, 1fr); }
  .app-sidebar { display: none; }
  .mobile-sidebar-open .app-sidebar { display: flex; position: fixed; inset: 0 auto 0 0; z-index: 31; width: min(280px, calc(100vw - 48px)); box-shadow: 8px 0 30px #25304418; }
  .sidebar-backdrop { display: block; position: fixed; z-index: 30; inset: 0; border: 0; background: #25304455; }
  .sidebar-fold { display: none; }.mobile-close, .mobile-toggle { display: inline-grid; }
  .app-header { height: 60px; padding: 0 14px; gap: 8px; }.header-context { gap: 9px; font-size: 13px; }
  .sidebar-collapsed .sidebar-label { display: flex; }.sidebar-collapsed .sidebar-brand-row { flex-direction: row; height: 80px; justify-content: space-between; }
  .sidebar-collapsed .sidebar-history { display: block; }.sidebar-collapsed .search-button { display: inline-grid; }
  .sidebar-collapsed .new-chat-button { padding: 0 15px; justify-content: flex-start; }
  .sidebar-collapsed .account-button { justify-content: flex-start; }.workspace-return, .context-divider { display: none; }
}
</style>
