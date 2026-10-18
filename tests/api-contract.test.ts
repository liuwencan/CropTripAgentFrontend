import { describe, expect, it, vi } from 'vitest'
import { configApi } from '@/api/configApi'
import { promptApi } from '@/api/promptApi'
import { userApi } from '@/api/userApi'

describe('admin API contracts', () => {
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
})
