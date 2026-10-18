import { describe, expect, it } from 'vitest'
import { readSseStream } from '@/utils/sse'

describe('readSseStream', () => {
  it('reads events split across chunks and preserves multiline data', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"version":1,"type":"message.delta","sequence":1,"payload":{"content":"a"}}\n\n'))
        controller.enqueue(encoder.encode('data: {"version":1,"type":"done","sequence":2,"payload":{}}\n\n'))
        controller.close()
      },
    })
    const events = []
    for await (const event of readSseStream(new Response(stream))) events.push(event)
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe('message.delta')
    expect(events[1].type).toBe('done')
  })
})
