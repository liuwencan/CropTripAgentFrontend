import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/store/auth'
import { appConfig } from '@/config'

describe('auth store', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); appConfig.enableMock = true })
  it('logs in and keeps role information', async () => {
    const store = useAuthStore()
    await store.login({ username: 'admin', password: 'password' })
    expect(store.isAuthenticated).toBe(true)
    expect(store.isAdmin).toBe(true)
  })
  it('clears stale session when restoration has no token', async () => {
    localStorage.setItem('corp_trip_token', 'stale')
    appConfig.enableMock = false
    const store = useAuthStore()
    await store.restore()
    expect(store.user).toBeNull()
  })
})
