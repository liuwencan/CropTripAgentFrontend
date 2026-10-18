import type { ApiErrorShape } from '@/types/api'

export class ApiError extends Error {
  status?: number
  errorCode?: string
  details?: unknown

  constructor(shape: ApiErrorShape) {
    super(shape.message)
    this.name = 'ApiError'
    this.status = shape.status
    this.errorCode = shape.errorCode
    this.details = shape.details
  }
}

export function getErrorMessage(error: unknown, fallback = '请求失败，请稍后重试') {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
