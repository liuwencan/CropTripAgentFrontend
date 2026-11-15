import { request, requestData } from './http'
import type { PageResponse } from '@/types/api'
import type { AgentTraceDetail, AgentTraceQuery, AgentTraceSpan } from '@/types/admin'

export const traceApi = {
  query(payload: AgentTraceQuery) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') params.set(key, String(value))
    }
    return request<PageResponse<AgentTraceSpan>>(`/business/agent-traces?${params.toString()}`)
  },
  detail(traceId: string) {
    return requestData<AgentTraceDetail>(`/business/agent-traces/trace/${encodeURIComponent(traceId)}`)
  },
}
