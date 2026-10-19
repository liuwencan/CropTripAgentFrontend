import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from '@/api/http'

afterEach(() => vi.restoreAllMocks())

describe('http client', () => {
  it('unwraps a successful response payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 })))
    await expect(request('/health')).resolves.toMatchObject({ success: true, data: { ok: true } })
  })
  it('sends the stored token as a Bearer Authorization header', async () => {
    localStorage.setItem('corp_trip_token', 'access-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await request('/secure')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token')
    expect(new Headers(init.headers).has('token')).toBe(false)
    localStorage.removeItem('corp_trip_token')
  })
  it('maps backend errors and broadcasts expiry', async () => {
    const listener = vi.fn()
    window.addEventListener('auth:expired', listener)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, message: '登录已过期', errorCode: 'AUTH_EXPIRED' }), { status: 401 })))
    await expect(request('/secure')).rejects.toMatchObject({ status: 401, errorCode: 'AUTH_EXPIRED' })
    expect(listener).toHaveBeenCalled()
    window.removeEventListener('auth:expired', listener)
  })
})
