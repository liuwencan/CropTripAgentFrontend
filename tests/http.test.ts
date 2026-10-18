import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from '@/api/http'

afterEach(() => vi.restoreAllMocks())

describe('http client', () => {
  it('unwraps a successful response payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 })))
    await expect(request('/health')).resolves.toMatchObject({ success: true, data: { ok: true } })
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
