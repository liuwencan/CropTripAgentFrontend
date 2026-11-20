import { requestData } from './http'
import type { ProfileOptions, ProfileOptionsResponse, ProfilePayload, UserProfile } from '@/types/profile'

export const profileApi = {
  get() { return requestData<UserProfile>('/user/profile') },
  async options(): Promise<ProfileOptions> {
    const options = await requestData<ProfileOptionsResponse>('/user/profile/options')
    // 后端字段白名单也使用 { code, label } 选项，同时兼容字符串列表。
    return { ...options, editableFields: options.editableFields.map((field) => typeof field === 'string' ? field : field.code) }
  },
  create(payload: ProfilePayload) {
    return requestData<UserProfile>('/user/profile', { method: 'POST', body: JSON.stringify(payload) })
  },
  update(payload: ProfilePayload) {
    return requestData<UserProfile>('/user/profile', { method: 'PUT', body: JSON.stringify(payload) })
  },
  clear() { return requestData<unknown>('/user/profile', { method: 'DELETE' }) },
}
