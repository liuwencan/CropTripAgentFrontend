import type { ApiResponse } from './api'

export interface User {
  id: number
  username: string
  role: string
  nickName?: string | null
  avatar?: string | null
  mustChangePassword?: boolean
  createTime?: string
  updateTime?: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  username: string
  password: string
}

export interface LoginData {
  tokenName: string
  tokenPrefix?: string
  tokenValue: string
  expiresIn: number
  user: User
}

export type LoginResponse = ApiResponse<LoginData>
