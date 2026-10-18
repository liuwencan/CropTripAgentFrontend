<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatLineRound, Setting, User, SwitchButton, DataAnalysis, Document } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'
import { useConversationStore } from '@/store/conversation'
import { appConfig } from '@/config'

const auth = useAuthStore()
const conversations = useConversationStore()
const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const isAdmin = computed(() => auth.isAdmin && appConfig.features.admin)

onMounted(async () => {
  if (route.query.denied) ElMessage.warning('当前账号没有管理员权限')
  await conversations.loadConversations()
})

async function signOut() {
  await ElMessageBox.confirm('确定退出当前账号吗？', '退出登录', { type: 'warning' })
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <el-container class="app-shell">
    <el-aside :width="collapsed ? '72px' : '232px'" class="app-sidebar">
      <div class="brand"><span class="brand-mark">行</span><span v-if="!collapsed">企业差旅助手</span></div>
      <el-menu :collapse="collapsed" :default-active="route.path" router class="app-menu">
        <el-menu-item index="/workspace"><el-icon><ChatLineRound /></el-icon><template #title>差旅工作台</template></el-menu-item>
        <template v-if="isAdmin">
          <el-divider v-if="!collapsed" content-position="left">管理</el-divider>
          <el-menu-item index="/admin/users"><el-icon><User /></el-icon><template #title>用户管理</template></el-menu-item>
          <el-menu-item index="/admin/config"><el-icon><Setting /></el-icon><template #title>系统配置</template></el-menu-item>
          <el-menu-item index="/admin/prompts"><el-icon><Document /></el-icon><template #title>Prompt 管理</template></el-menu-item>
        </template>
      </el-menu>
      <button class="collapse-button" @click="collapsed = !collapsed">{{ collapsed ? '展开' : '收起' }}</button>
    </el-aside>
    <el-container>
      <el-header class="app-header">
        <div><span class="header-kicker">TRAVEL OPERATIONS</span><strong>智能差旅工作台</strong></div>
        <el-dropdown trigger="click">
          <button class="user-trigger"><el-icon><User /></el-icon>{{ auth.user?.username }}<span class="role-tag">{{ auth.user?.role }}</span></button>
          <template #dropdown><el-dropdown-menu><el-dropdown-item @click="signOut"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item></el-dropdown-menu></template>
        </el-dropdown>
      </el-header>
      <el-main class="app-main"><RouterView /></el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-shell { min-height: 100vh; background: #f3f6f5; }
.app-sidebar { position: relative; display: flex; flex-direction: column; background: #102a27; color: #dcece8; transition: width .2s; overflow: hidden; }
.brand { display: flex; align-items: center; gap: 10px; height: 74px; padding: 0 20px; font-weight: 700; letter-spacing: .04em; white-space: nowrap; }
.brand-mark { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 8px; background: #62c5aa; color: #12332e; }
.app-menu { flex: 1; border-right: 0; background: transparent; }
.app-menu :deep(.el-menu-item), .app-menu :deep(.el-sub-menu__title) { color: #a7c4bd; }
.app-menu :deep(.el-menu-item.is-active) { color: #eafff8; background: #1e5048; }
.app-menu :deep(.el-menu-item:hover) { background: #173f39; }
.app-menu :deep(.el-divider) { border-color: #2b4d48; color: #75918b; margin: 16px 20px; width: calc(100% - 40px); }
.collapse-button { border: 0; border-top: 1px solid #2b4d48; padding: 14px; background: transparent; color: #91ada7; cursor: pointer; }
.app-header { display: flex; align-items: center; justify-content: space-between; height: 74px; padding: 0 28px; border-bottom: 1px solid #dfe9e6; background: #fff; }
.header-kicker { display: block; color: #6f8b86; font-size: 10px; letter-spacing: .16em; }
.app-header strong { display: block; margin-top: 4px; color: #173b38; }
.user-trigger { display: flex; align-items: center; gap: 8px; border: 0; background: transparent; color: #173b38; cursor: pointer; }
.role-tag { padding: 3px 7px; border-radius: 4px; background: #e4f3ee; color: #177361; font-size: 11px; }
.app-main { padding: 0; overflow: auto; }
@media (max-width: 720px) { .app-sidebar { width: 72px !important; } .brand { padding: 0 20px; } .app-header { padding: 0 14px; } .header-kicker { display: none; } }
</style>
