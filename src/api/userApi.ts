import { request, requestData } from './http'
import type { PageResponse } from '@/types/api'
import type { User } from '@/types/auth'
import type { UserQuery } from '@/types/admin'

export const userApi = {
  query(payload: UserQuery) {
    return request<PageResponse<User>>('/system/user/query', { method: 'POST', body: JSON.stringify(payload) })
  },
  resetPassword(id: number, reason: string) {
    return requestData(`/system/user/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ reason }) })
  },
}
