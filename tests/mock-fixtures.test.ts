import { describe, expect, it } from 'vitest'
import { mockStream } from '@/mocks/fixtures'

describe('mock fixtures', () => {
  it('uses the same versioned stream envelope as the real adapter', () => {
    const events = mockStream('上海到北京')
    expect(events.at(0)).toMatchObject({ version: 1, type: 'message.delta', sequence: 0 })
    expect(events.at(-1)).toMatchObject({ version: 1, type: 'done' })
  })
})
