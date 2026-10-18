import type { ApiResponse } from './api'

export interface User {
  id: number
  username: string
  role: string
  mustChangePassword?: boolean
  createTime?: string
  updateTime?: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginData {
  tokenName: string
  tokenValue: string
  expiresIn: number
  user: User
}

export type LoginResponse = ApiResponse<LoginData>
