import { describe, expect, it } from 'vitest'
import { parseSseEvent } from '@/utils/sse'

describe('parseSseEvent', () => {
  it('parses data lines and ignores comments', () => {
    expect(parseSseEvent(': keep-alive\ndata: {"version":1,"type":"message.delta","sequence":1,"payload":{"content":"hi"}}')).toMatchObject({ type: 'message.delta', sequence: 1 })
    expect(parseSseEvent('event: done\ndata: invalid')).toBeNull()
  })
  it('normalizes delta events when the event type is carried in the JSON data', () => {
    expect(parseSseEvent('data: {"type":"delta","delta":"正在查询"}')).toMatchObject({ type: 'message.delta', sequence: 0, payload: { content: '正在查询' } })
    expect(parseSseEvent('event: message\ndata: {"type":"delta","payload":{"content":"用户信息"},"sequence":8}')).toMatchObject({ type: 'message.delta', sequence: 8, payload: { content: '用户信息' } })
  })
  it('normalizes plain-text and empty named delta events', () => {
    expect(parseSseEvent('event:delta\ndata:已')).toMatchObject({ type: 'message.delta', payload: { content: '已' } })
    expect(parseSseEvent('event:delta\ndata:为您')).toMatchObject({ type: 'message.delta', payload: { content: '为您' } })
    expect(parseSseEvent('event:delta\ndata:')).toMatchObject({ type: 'message.delta', payload: { content: '' } })
  })
  it('normalizes complete with its conversation id', () => {
    expect(parseSseEvent('event:complete\ndata:{"conversationId":28}')).toMatchObject({ type: 'message.done', payload: { conversationId: 28 } })
    expect(parseSseEvent('data:{"type":"complete","conversationId":29}')).toMatchObject({ type: 'message.done', payload: { conversationId: 29 } })
    expect(parseSseEvent('data:{"type":"complete","sequence":6,"conversationId":30}')).toMatchObject({ type: 'message.done', sequence: 6, payload: { conversationId: 30 } })
  })
  it('normalizes the named ask event emitted by the agent pipeline', () => {
    const event = parseSseEvent('event: ask\ndata: {"conversationId":7,"delta":{"question":"出发城市是哪里？","ui_type":"select","options":["北京","上海"],"allow_other":true}}')
    expect(event).toMatchObject({ type: 'ask', sequence: 0, payload: { conversationId: 7, delta: { question: '出发城市是哪里？', ui_type: 'select', options: ['北京', '上海'], allow_other: true } } })
  })
  it('preserves the ask tool call id for resuming the paused conversation', () => {
    const event = parseSseEvent('event: ask\ndata: {"conversationId":7,"toolCallId":"ask-call-1","delta":{"question":"Which city?"}}')
    expect(event).toMatchObject({ type: 'ask', payload: { conversationId: 7, toolCallId: 'ask-call-1' } })
  })
  it('parses the direct ask payload with form fields', () => {
    const event = parseSseEvent('event: ask\ndata: {"fields":[{"name":"city","label":"查询城市","placeholder":"请输入城市名称，如：北京、上海","required":true,"type":"text"},{"name":"date","label":"查询日期","placeholder":"选择要查询的日期","type":"date"},{"name":"purpose","label":"查询目的","options":["出差行程规划","返程安排","日常了解","其他"],"type":"select"}],"question":"请问您想查询哪个城市的天气？是近期出差的行程安排需要吗？","ui_type":"form"}')
    expect(event).toMatchObject({ type: 'ask', payload: { delta: { ui_type: 'form', question: '请问您想查询哪个城市的天气？是近期出差的行程安排需要吗？', fields: [{ name: 'city', required: true }, { name: 'date', type: 'date' }, { name: 'purpose', options: ['出差行程规划', '返程安排', '日常了解', '其他'] }] } } })
  })
  it('parses the backend ask payload when the form is nested under input', () => {
    const event = parseSseEvent('event:ask\ndata:{"toolCallId":"call_b8c0e7d20bc24aa49ed351ee","input":{"fields":[{"label":"城市","name":"city","placeholder":"例如：北京、上海","required":true,"type":"text"},{"label":"查询日期","name":"date","placeholder":"例如：今天、明天或具体日期","type":"text"}],"question":"请问您想查询哪个城市的天气？是否是为出差行程做准备呢？","ui_type":"form"}}')
    expect(event).toMatchObject({ type: 'ask', payload: { toolCallId: 'call_b8c0e7d20bc24aa49ed351ee', delta: { ui_type: 'form', fields: [{ name: 'city', required: true }, { name: 'date', type: 'text' }] } } })
  })
  it('parses a JSON-string input from the ask tool', () => {
    const event = parseSseEvent('event:ask\ndata:{"toolCallId":"call-weather","input":"{\\"fields\\":[{\\"label\\":\\"城市\\",\\"name\\":\\"city\\",\\"required\\":true,\\"type\\":\\"text\\"}],\\"question\\":\\"请问城市？\\",\\"ui_type\\":\\"form\\"}"}')
    expect(event).toMatchObject({ type: 'ask', payload: { delta: { ui_type: 'form', fields: [{ name: 'city' }] } } })
  })
  it('normalizes typed ask events when the prompt is nested under payload', () => {
    const event = parseSseEvent('data: {"type":"ask","sequence":4,"payload":{"question":"请选择城市","ui_type":"select","options":["北京","上海"]}}')
    expect(event).toMatchObject({ type: 'ask', sequence: 0, payload: { delta: { question: '请选择城市', ui_type: 'select', options: ['北京', '上海'] } } })
  })
  it('recognizes a direct ask prompt without event metadata or tool id', () => {
    const event = parseSseEvent('data: "{\\"question\\":\\"请选择城市\\",\\"ui_type\\":\\"select\\",\\"options\\":[\\"北京\\",\\"上海\\"]}"')
    expect(event).toMatchObject({ type: 'ask', payload: { delta: { question: '请选择城市', ui_type: 'select' } } })
  })
  it('normalizes tool lifecycle events and keeps their tool call ids', () => {
    expect(parseSseEvent('event: tool_start\ndata: {"toolCallId":"call-1","agentName":"MasterAgent","toolName":"get_userinfo","input":"{}"}')).toMatchObject({ type: 'tool_start', payload: { toolCallId: 'call-1', toolName: 'get_userinfo' } })
    expect(parseSseEvent('event: tool_result\ndata: {"conversationId":25,"toolCallId":"call-1","toolResult":"\\\"用户信息：rel\\\""}')).toMatchObject({ type: 'tool_result', payload: { toolCallId: 'call-1', toolResult: '"用户信息：rel"' } })
    expect(parseSseEvent('event: tool_success\ndata: {"conversationId":25,"toolCallId":"call-1","phase":"completed","state":"success"}')).toMatchObject({ type: 'tool_success', payload: { toolCallId: 'call-1', state: 'success' } })
  })
})
