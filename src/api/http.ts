import { appConfig } from '@/config'
import { ApiError } from '@/utils/errors'

const TOKEN_KEY = 'corp_trip_token'
const TOKEN_NAME_KEY = 'corp_trip_token_name'
const AUTHORIZATION_HEADER = 'Authorization'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getAuthorizationHeader() {
  const token = getToken()?.replace(/^Bearer\s+/i, '').trim()
  return token ? `Bearer ${token}` : undefined
}

export function setToken(value: string, tokenName = 'token') {
  localStorage.setItem(TOKEN_KEY, value)
  localStorage.setItem(TOKEN_NAME_KEY, tokenName)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_NAME_KEY)
}

function buildUrl(path: string, base = appConfig.apiBaseUrl) {
  if (/^https?:\/\//.test(path)) return path
  return `${base}${path}`
}

export async function request<T>(path: string, init: RequestInit = {}, base?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  const authorization = getAuthorizationHeader()
  if (authorization) headers.set(AUTHORIZATION_HEADER, authorization)
  let response: Response
  try {
    response = await fetch(buildUrl(path, base), { ...init, headers })
  } catch (error) {
    throw new ApiError({ message: error instanceof Error ? error.message : '网络连接失败' })
  }
  const text = await response.text()
  let payload: any = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('auth:expired'))
    throw new ApiError({ status: response.status, message: payload?.message || `请求失败（${response.status}）`, errorCode: payload?.errorCode, details: payload })
  }
  if (payload && payload.success === false) throw new ApiError({ status: response.status, message: payload.message || '业务请求失败', errorCode: payload.errorCode, details: payload })
  return payload as T
}

export async function requestData<T>(path: string, init?: RequestInit, base?: string): Promise<T> {
  const payload = await request<{ data: T; success?: boolean; message?: string; errorCode?: string }>(path, init, base)
  return payload?.data as T
}

export { buildUrl }
