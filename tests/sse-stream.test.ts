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
  it('reads plain-text delta frames from the backend stream', async () => {
    const stream = new Response('event:tool_start\ndata:{"toolCallId":"call-1","agentName":"MasterAgent","toolName":"get_userinfo","input":"{}"}\n\nevent:delta\ndata:已\n\nevent:delta\ndata:为您\n\nevent:delta\ndata:查询到\n\nevent:delta\ndata:\n\n')
    const events = []
    for await (const event of readSseStream(stream)) events.push(event)
    expect(events.filter((event) => event.type === 'message.delta').map((event) => event.type === 'message.delta' ? event.payload.content : '')).toEqual(['已', '为您', '查询到', ''])
  })
  it('reads the raw ask form frame used by the weather query flow', async () => {
    const stream = new Response('event:ask\ndata:{"fields":[{"label":"查询城市","name":"city","placeholder":"例如：北京、上海","required":true,"type":"text"},{"label":"查询日期","name":"date","type":"date"}],"question":"请问您想查询哪个城市的天气？如果是为了差旅行程，也可以告诉我出行日期，我可以为您查询相应日期的天气。","ui_type":"form"}\n\n')
    const events = []
    for await (const event of readSseStream(stream)) events.push(event)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'ask', payload: { delta: { ui_type: 'form', fields: [{ name: 'city' }, { name: 'date', type: 'date' }] } } })
  })
  it('reads the backend input-wrapped ask form frame', async () => {
    const stream = new Response('event:ask\ndata:{"toolCallId":"call-weather","input":{"fields":[{"label":"城市","name":"city","required":true,"type":"text"},{"label":"查询日期","name":"date","type":"text"}],"question":"请问您想查询哪个城市的天气？","ui_type":"form"}}\n\n')
    const events = []
    for await (const event of readSseStream(stream)) events.push(event)
    expect(events[0]).toMatchObject({ type: 'ask', payload: { toolCallId: 'call-weather', delta: { ui_type: 'form', fields: [{ name: 'city' }, { name: 'date' }] } } })
  })
  it('separates an ask frame when the backend uses a single newline between events', async () => {
    const stream = new Response('event:delta\ndata:{"delta":"我来查询天气"}\nevent:ask\ndata:{"toolCallId":"call-weather","input":{"fields":[{"label":"城市","name":"city","required":true,"type":"text"}],"question":"请问城市？","ui_type":"form"}}\n')
    const events = []
    for await (const event of readSseStream(stream)) events.push(event)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'message.delta', payload: { content: '我来查询天气' } })
    expect(events[1]).toMatchObject({ type: 'ask', payload: { delta: { ui_type: 'form' }, toolCallId: 'call-weather' } })
  })
})
