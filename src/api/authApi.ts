import { appConfig } from '@/config'
import { requestData } from './http'
import type { LoginData, LoginPayload, RegisterPayload, User } from '@/types/auth'
import { mockUser } from '@/mocks/fixtures'

export const authApi = {
  async login(payload: LoginPayload): Promise<LoginData> {
    if (appConfig.enableMock) return { ...mockUser, tokenValue: `mock-${payload.username}`, user: { ...mockUser.user, username: payload.username, role: payload.username.toLowerCase().includes('admin') ? 'ADMIN' : 'USER' } }
    return requestData<LoginData>('/auth/login', { method: 'POST', body: JSON.stringify(payload) })
  },
  async register(payload: RegisterPayload): Promise<User> {
    if (appConfig.enableMock) return { id: 2, username: payload.username.trim().toLowerCase(), role: 'USER', mustChangePassword: false }
    return requestData<User>('/auth/register', { method: 'POST', body: JSON.stringify(payload) })
  },
  async me(): Promise<User> {
    if (appConfig.enableMock) return { id: 1, username: 'demo.admin', role: 'ADMIN', mustChangePassword: false }
    return requestData<User>('/auth/me')
  },
  async logout() {
    if (!appConfig.enableMock) await requestData('/auth/logout', { method: 'POST' })
  },
}
