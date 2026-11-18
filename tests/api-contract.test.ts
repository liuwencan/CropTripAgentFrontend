import { describe, expect, it, vi } from 'vitest'
import { authApi } from '@/api/authApi'
import { configApi } from '@/api/configApi'
import { promptApi } from '@/api/promptApi'
import { userApi } from '@/api/userApi'
import { tripApi } from '@/api/tripApi'
import { appConfig } from '@/config'

describe('API contracts', () => {
  it('registers an account with the public auth endpoint and only supported fields', async () => {
    const originalMock = appConfig.enableMock
    appConfig.enableMock = false
    const user = { id: 8, username: 'alice_1', role: 'USER', mustChangePassword: false }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: user }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      await expect(authApi.register({ username: 'alice_1', password: 'password123' })).resolves.toEqual(user)
      expect(fetchMock.mock.calls[0][0]).toBe('/auth/register')
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ username: 'alice_1', password: 'password123' })
    } finally {
      appConfig.enableMock = originalMock
    }
  })

  it('uses documented query payloads and response page fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [{ id: 1, username: 'alice', role: 'USER' }], pageNo: 1, pageSize: 10, totalCount: 1, totalPage: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await userApi.query({ pageNo: 1, pageSize: 10, keyword: 'alice', role: 'USER' })
    expect(result.totalCount).toBe(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ keyword: 'alice', role: 'USER' })
  })
  it('maps config and prompt query endpoints', async () => {
    const page = () => new Response(JSON.stringify({ success: true, data: [], pageNo: 1, pageSize: 10, totalCount: 0, totalPage: 0 }), { status: 200 })
    const fetchMock = vi.fn().mockResolvedValueOnce(page()).mockResolvedValueOnce(page())
    vi.stubGlobal('fetch', fetchMock)
    await configApi.query({ pageNo: 1, pageSize: 10 })
    await promptApi.query({ pageNo: 1, pageSize: 10 })
    expect(fetchMock.mock.calls[0][0]).toContain('/config/query')
    expect(fetchMock.mock.calls[1][0]).toContain('/system/prompt/query')
  })
  it('maps administrative mutations and Prompt lifecycle endpoints', async () => {
    const response = () => new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
    const fetchMock = vi.fn().mockImplementation(async () => response())
    vi.stubGlobal('fetch', fetchMock)
    await userApi.resetPassword(1, '员工申请')
    await configApi.save({ configKey: 'trip.limit', configValue: '500' })
    await configApi.update(2, { configValue: '600' })
    await configApi.remove(2)
    await configApi.reload()
    await promptApi.publish(3, 4, '优化政策说明')
    await promptApi.offline(3, '暂时停用')
    await promptApi.rollback(3, 2, '恢复稳定版本')
    await promptApi.compare(3, 1, 2)
    await promptApi.releaseLogs(3)
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls).toEqual(expect.arrayContaining(['/system/user/1/reset-password', '/config', '/config/2', '/config/2', '/config/reload', '/system/prompt/3/versions/4/publish', '/system/prompt/3/offline', '/system/prompt/3/rollback', '/system/prompt/3/versions/compare?leftVersionId=1&rightVersionId=2', '/system/prompt/3/release-logs']))
  })
  it('cancels a trip order through its documented endpoint', async () => {
    const updated = { id: 'trip-1', status: 'CANCELLED' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: updated }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(tripApi.cancelOrder('trip/1')).resolves.toEqual(updated)
    expect(fetchMock.mock.calls[0][0]).toBe('/trip/orders/trip%2F1/cancel')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
  })
})
