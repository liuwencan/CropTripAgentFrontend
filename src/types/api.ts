export interface ApiResponse<T> {
  success: boolean
  message?: string
  errorCode?: string
  data: T
}

export interface PageResponse<T> {
  success: boolean
  message?: string
  errorCode?: string
  data: T[]
  pageNo: number
  pageSize: number
  totalCount: number
  totalPage: number
}

export interface ApiErrorShape {
  message: string
  status?: number
  errorCode?: string
  details?: unknown
}
