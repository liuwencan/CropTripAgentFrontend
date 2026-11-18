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

export type BookingType = 'FLIGHT' | 'HOTEL' | 'TRAIN' | 'TICKET' | 'CRUISE' | 'VACATION'

export interface BookingRecord {
  id: number
  bookingId: string
  conversationId?: string
  travelOrderId?: string
  bizType: BookingType
  platform?: string
  externalOrderNo?: string
  status: string
  externalStatus?: string
  paymentStatus?: string
  title?: string
  totalAmount?: number
  currency?: string
  contactName?: string
  contactPhone?: string
  startTime?: string
  endTime?: string
  detail?: string
  remark?: string
  bookedAt?: string
  createdAt?: string
  updatedAt?: string
}
