export type TripOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
export type TripApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface TripOrder {
  id: string
  userId: string
  destination: string
  departureCity: string
  departureDate: string
  returnDate: string
  purpose: string
  status: TripOrderStatus
  approvalId?: string
  createdAt?: string
  updatedAt?: string
}

export interface TripApprovalRecord {
  id: string
  userId: string
  title: string
  status: TripApprovalStatus
  approvalForm?: string
  remark?: string
  submitTime?: string
  updateTime?: string
  orderId?: string
}
