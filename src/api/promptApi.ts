import { request, requestData } from './http'
import type { PageResponse } from '@/types/api'
import type { PromptEntry, PromptVersion, PromptReleaseLog, PromptVersionCompare } from '@/types/admin'

export const promptApi = {
  query(payload: { pageNo: number; pageSize: number; keyword?: string }) { return request<PageResponse<PromptEntry>>('/system/prompt/query', { method: 'POST', body: JSON.stringify(payload) }) },
  versions(promptId: number) { return requestData<PromptVersion[]>(`/system/prompt/${promptId}/versions`) },
  publish(promptId: number, versionId: number, reason: string) { return requestData(`/system/prompt/${promptId}/versions/${versionId}/publish`, { method: 'POST', body: JSON.stringify({ reason }) }) },
  offline(promptId: number, reason: string) { return requestData(`/system/prompt/${promptId}/offline`, { method: 'POST', body: JSON.stringify({ reason }) }) },
  rollback(promptId: number, versionId: number, reason: string) { return requestData(`/system/prompt/${promptId}/rollback`, { method: 'POST', body: JSON.stringify({ reason, versionId }) }) },
  compare(promptId: number, leftVersionId: number, rightVersionId: number) { return requestData<PromptVersionCompare>(`/system/prompt/${promptId}/versions/compare?leftVersionId=${leftVersionId}&rightVersionId=${rightVersionId}`) },
  releaseLogs(promptId: number) { return requestData<PromptReleaseLog[]>(`/system/prompt/${promptId}/release-logs`) },
}
