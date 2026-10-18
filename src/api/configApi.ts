import { request, requestData } from './http'
import type { PageResponse } from '@/types/api'
import type { ConfigEntry } from '@/types/admin'

export const configApi = {
  query(payload: { pageNo: number; pageSize: number; keyword?: string }) { return request<PageResponse<ConfigEntry>>('/config/query', { method: 'POST', body: JSON.stringify(payload) }) },
  save(payload: Partial<ConfigEntry>) { return requestData<ConfigEntry>('/config', { method: 'POST', body: JSON.stringify(payload) }) },
  update(id: number, payload: Partial<ConfigEntry>) { return requestData<ConfigEntry>(`/config/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) },
  remove(id: number) { return requestData(`/config/${id}`, { method: 'DELETE' }) },
  reload() { return requestData('/config/reload', { method: 'POST' }) },
}
