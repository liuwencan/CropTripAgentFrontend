import { request, requestData } from './http'
import type { PageResponse } from '@/types/api'
import type { ProviderApiKey } from '@/types/admin'

export interface ProviderApiKeyPayload {
  providerCode: string
  apiKey: string
  status: 'ACTIVE' | 'INACTIVE' | 'REVOKED'
  remark?: string
}

export const providerApiKeyApi = {
  query(payload: { pageNo: number; pageSize: number; providerCode?: string; status?: string }) {
    const params = new URLSearchParams({ pageNo: String(payload.pageNo), pageSize: String(payload.pageSize) })
    if (payload.providerCode) params.set('providerCode', payload.providerCode)
    if (payload.status) params.set('status', payload.status)
    return request<PageResponse<ProviderApiKey>>(`/provider-api-keys?${params.toString()}`)
  },
  get(id: number) { return requestData<ProviderApiKey>(`/provider-api-keys/${id}`) },
  create(payload: ProviderApiKeyPayload) { return requestData<ProviderApiKey>('/provider-api-keys', { method: 'POST', body: JSON.stringify(payload) }) },
  update(id: number, payload: ProviderApiKeyPayload) { return requestData<ProviderApiKey>(`/provider-api-keys/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) },
  remove(id: number) { return requestData(`/provider-api-keys/${id}`, { method: 'DELETE' }) },
}
