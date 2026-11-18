import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from '@/api/http'
import { getRequestBase, parseAddresses, resetRequestRouting, setRequestRouting } from '@/utils/requestRouting'

afterEach(() => {
  resetRequestRouting()
  vi.restoreAllMocks()
})

describe('request routing test tool', () => {
  it('parses, trims, deduplicates, and reports invalid machine addresses', () => {
    expect(parseAddresses(' https://one.test/\nhttps://two.test; https://one.test\nftp://bad')).toEqual({
      addresses: ['https://one.test', 'https://two.test'],
      invalid: ['ftp://bad'],
    })
  })

  it('rotates the machine used by each request when polling is enabled', async () => {
    setRequestRouting({ enabled: true, addresses: ['https://one.test', 'https://two.test'] })
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)

    await request('/health')
    await request('/health')
    await request('/health')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://one.test/health',
      'https://two.test/health',
      'https://one.test/health',
    ])
  })

  it('uses the configured fallback when polling is disabled', () => {
    setRequestRouting({ enabled: false, addresses: ['https://one.test'] })
    expect(getRequestBase('/api')).toBe('/api')
  })
})
