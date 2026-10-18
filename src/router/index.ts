import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { appConfig } from '@/config'
import { canEnterRoute } from './access'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
    { path: '/', component: () => import('@/layouts/AppLayout.vue').catch(() => import('@/views/ErrorView.vue')), children: [
      { path: '', redirect: '/workspace' },
      { path: 'workspace', name: 'workspace', component: () => import('@/views/WorkspaceView.vue') },
      { path: 'admin/users', name: 'admin-users', component: () => import('@/views/admin/UserManagementView.vue'), meta: { admin: true } },
      { path: 'admin/config', name: 'admin-config', component: () => import('@/views/admin/ConfigManagementView.vue'), meta: { admin: true } },
      { path: 'admin/prompts', name: 'admin-prompts', component: () => import('@/views/admin/PromptManagementView.vue'), meta: { admin: true } },
    ] },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
})

router.onError((error) => {
  if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(String(error))) router.push({ name: 'not-found' })
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.restore()
  return canEnterRoute(to, auth.isAuthenticated, auth.isAdmin, appConfig.features.admin)
})
