import { describe, expect, it } from 'vitest'
import { parseSseEvent } from '@/utils/sse'

describe('parseSseEvent', () => {
  it('parses data lines and ignores comments', () => {
    expect(parseSseEvent(': keep-alive\ndata: {"version":1,"type":"message.delta","sequence":1,"payload":{"content":"hi"}}')).toMatchObject({ type: 'message.delta', sequence: 1 })
    expect(parseSseEvent('event: done\ndata: invalid')).toBeNull()
  })
})
