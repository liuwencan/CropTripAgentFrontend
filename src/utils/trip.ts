import type { TripApprovalStatus, TripOrderStatus } from '@/types/trip'

export const tripOrderStatuses: { value: TripOrderStatus; label: string; type: 'info' | 'warning' | 'success' | 'danger' }[] = [
  { value: 'DRAFT', label: '草稿', type: 'info' },
  { value: 'SUBMITTED', label: '审批中', type: 'warning' },
  { value: 'APPROVED', label: '已通过', type: 'success' },
  { value: 'REJECTED', label: '已驳回', type: 'danger' },
  { value: 'COMPLETED', label: '已完成', type: 'success' },
  { value: 'CANCELLED', label: '已取消', type: 'info' },
]

export const tripApprovalStatuses: Record<TripApprovalStatus, { label: string; type: 'info' | 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: '待审批', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' },
  CANCELLED: { label: '已取消', type: 'info' },
}

export function orderStatus(status?: string) {
  return tripOrderStatuses.find((item) => item.value === status) || { label: status || '未知状态', type: 'info' as const }
}

export function formatTripTime(value?: string) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

export function parseApprovalForm(value?: string): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}
