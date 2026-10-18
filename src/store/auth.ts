import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api/authApi'
import { clearToken, getToken, setToken } from '@/api/http'
import type { LoginPayload, User } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const isAuthenticated = computed(() => Boolean(user.value && getToken()))
  const isAdmin = computed(() => user.value?.role?.toUpperCase() === 'ADMIN')

  async function login(payload: LoginPayload) {
    loading.value = true
    try {
      const result = await authApi.login(payload)
      setToken(result.tokenValue, result.tokenName)
      user.value = result.user
      return result.user
    } finally {
      loading.value = false
    }
  }

  async function restore() {
    if (initialized.value) return user.value
    initialized.value = true
    if (!getToken()) return null
    try {
      user.value = await authApi.me()
      return user.value
    } catch {
      clearToken()
      user.value = null
      return null
    }
  }

  async function logout() {
    try { await authApi.logout() } finally { clearToken(); user.value = null }
  }

  function clearSession() {
    clearToken()
    user.value = null
  }

  return { user, loading, initialized, isAuthenticated, isAdmin, login, restore, logout, clearSession }
})
