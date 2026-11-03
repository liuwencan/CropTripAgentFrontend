import { request, requestData } from './http'
import type { PageResponse } from '@/types/api'
import type { TripApprovalRecord, TripOrder, TripOrderStatus } from '@/types/trip'

export interface TripOrderQuery {
  pageNo: number
  pageSize: number
  status?: TripOrderStatus | ''
  destination?: string
  departureCity?: string
  departureDate?: string
  returnDate?: string
}

function queryString(query: object) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query as Record<string, string | number | undefined>)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

export const tripApi = {
  orders(query: TripOrderQuery) {
    return request<PageResponse<TripOrder>>(`/trip/orders?${queryString(query)}`)
  },
  approvalRecords(query: { pageNo: number; pageSize: number; status?: string; orderId?: string }) {
    return request<PageResponse<TripApprovalRecord>>(`/trip/approval-records?${queryString(query)}`)
  },
  pendingApprovals(query: { pageNo: number; pageSize: number }) {
    return request<PageResponse<TripApprovalRecord>>(`/admin/trip/approval-records/pending?${queryString(query)}`)
  },
  decide(id: string, decision: 'APPROVED' | 'REJECTED', remark: string) {
    return requestData<TripApprovalRecord>(`/admin/trip/approval-records/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, remark }),
    })
  },
}
