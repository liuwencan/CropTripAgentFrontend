import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { watch } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AgentProgressTimeline from '@/components/AgentProgressTimeline.vue'
import IntentProgressTimeline from '@/components/IntentProgressTimeline.vue'
import ConversationMessage from '@/components/ConversationMessage.vue'
import { conversationApi } from '@/api/conversationApi'
import { appConfig } from '@/config'
import { useConversationStore } from '@/store/conversation'
import type { AgentProgressMetadata, StreamEvent, ToolCall } from '@/types/conversation'

const timestamp = 1793505600000
const metadata = { agentId: 'master-1', agentName: '主智能体', tooldesc: '获取用户信息', toolCallId: 'call-1', toolName: 'get_userinfo', input: { scope: 'current' }, timestamp }
type ToolPayload = AgentProgressMetadata & { toolCallId: string; toolName: string; input: unknown; output?: string }
const start = (overrides: Partial<ToolPayload> = {}, sequence = 0): StreamEvent => ({ version: 1, type: 'tool_start', sequence, payload: { ...metadata, status: 'running', ...overrides } })
const result = (overrides: Partial<ToolPayload> = {}, sequence = 1): StreamEvent => ({ version: 1, type: 'tool_result', sequence, payload: { ...metadata, output: '查询结果', status: 'completed', timestamp: timestamp + 1500, ...overrides } })

async function sendEvents(events: StreamEvent[]) {
  vi.spyOn(conversationApi, 'stream').mockImplementation(async function* () { yield* events })
  const store = useConversationStore()
  store.activeId = 25
  await store.send('查询用户信息')
  return store
}

beforeEach(() => { setActivePinia(createPinia()); appConfig.enableMock = true })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Hook progress lifecycle', () => {
  it('consumes actual Hook JSON over SSE and completes without a tool_success event', async () => {
    appConfig.enableMock = false
    const payloads = [
      { type: 'tool_start', payload: { ...metadata, eventId: 'event-start', eventType: 'tool_start', status: 'running', output: null, messageId: null } },
      { type: 'tool_result', payload: { ...metadata, eventId: 'event-result', eventType: 'tool_result', status: 'completed', output: '用户信息已返回', timestamp: timestamp + 1500, messageId: null } },
      { type: 'complete', payload: { conversationId: 25 } },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(payloads.map(({ type, payload }) => `event:${type}\ndata:${JSON.stringify(payload)}\n\n`).join(''))))
    const store = useConversationStore()
    store.activeId = 25
    await store.send('查询用户信息')
    expect(store.messages.at(-1)).toMatchObject({ status: 'completed', toolCalls: [{ ...metadata, result: '用户信息已返回', status: 'completed', completedAt: timestamp + 1500 }] })
  })

  it('isolates identical call IDs from different agent instances with reverse result arrival', async () => {
    const store = await sendEvents([
      start(), start({ agentId: 'master-2', timestamp: timestamp + 10 }, 1),
      result({ agentId: 'master-2', output: '实例二' }, 2), result({ output: '实例一' }, 3),
    ])
    expect(store.messages.at(-1)?.toolCalls).toMatchObject([
      { agentId: 'master-1', toolCallId: 'call-1', result: '实例一', status: 'completed' },
      { agentId: 'master-2', toolCallId: 'call-1', result: '实例二', status: 'completed' },
    ])
  })

  it('isolates parallel calls to the same tool and restores standalone result metadata', async () => {
    const store = await sendEvents([start(), start({ toolCallId: 'call-2' }, 1), result({ toolCallId: 'call-2', output: '结果二' }, 2), result({ output: '结果一' }, 3), result({ toolCallId: 'call-3', output: '' }, 4)])
    expect(store.messages.at(-1)?.toolCalls).toMatchObject([
      { toolCallId: 'call-1', result: '结果一' }, { toolCallId: 'call-2', result: '结果二' },
      { toolCallId: 'call-3', agentId: 'master-1', agentName: '主智能体', toolName: 'get_userinfo', tooldesc: '获取用户信息', input: { scope: 'current' }, result: '', status: 'completed' },
    ])
  })

  it('does not reset a completed tool when its start arrives late', async () => {
    const store = await sendEvents([result(), start({}, 2)])
    expect(store.messages.at(-1)?.toolCalls).toMatchObject([{ timestamp, completedAt: timestamp + 1500, result: '查询结果', status: 'completed' }])
  })

  it('keeps suspended tools suspended even when the SSE stream completes', async () => {
    const store = await sendEvents([start(), result({ status: 'suspended', output: '需要用户补充城市' }), { version: 1, type: 'done', sequence: 2 }])
    expect(store.messages.at(-1)?.toolCalls?.[0]).toMatchObject({ status: 'suspended', result: '需要用户补充城市' })
  })

  it('marks active calls suspended when the ask form pauses the stream', async () => {
    const store = await sendEvents([start({ toolName: 'ask_user' }), { version: 1, type: 'ask', sequence: 1, payload: { conversationId: 25, toolCallId: 'call-1', delta: { question: '请选择城市' } } }])
    expect(store.messages.at(-1)).toMatchObject({ status: 'awaiting-input', toolCalls: [{ status: 'suspended' }] })
  })

  it('does not leave running indicators after EOF or a stream error followed by done', async () => {
    let store = await sendEvents([start()])
    expect(store.messages.at(-1)?.toolCalls?.[0]?.status).toBe('interrupted')
    setActivePinia(createPinia())
    store = await sendEvents([start(), { version: 1, type: 'error', sequence: 1, payload: { message: '连接失败' } }, { version: 1, type: 'done', sequence: 2 }])
    expect(store.messages.at(-1)).toMatchObject({ status: 'failed', error: '连接失败', toolCalls: [{ status: 'failed' }] })
  })

  it('renders tool_error output as a failed call', async () => {
    const completed = result({ output: '工具服务不可用' })
    const store = await sendEvents([start(), { ...completed, type: 'tool_error' } as StreamEvent])
    expect(store.messages.at(-1)?.toolCalls?.[0]).toMatchObject({ status: 'failed', result: '工具服务不可用' })
  })

  it('streams reactive tool updates and stops active calls on cancellation', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* () { yield start(); yield result(); yield start({ toolCallId: 'call-2' }, 2); await gate })
    const store = useConversationStore()
    const updates: string[] = []
    const stop = watch(() => store.messages.at(-1)?.toolCalls?.[0]?.status, (status) => { if (status) updates.push(status) }, { flush: 'sync' })
    const pending = store.send('查询')
    await vi.waitFor(() => expect(store.messages.at(-1)?.toolCalls).toHaveLength(2))
    expect(updates).toContain('completed')
    store.stop(); release(); await pending
    expect(store.messages.at(-1)).toMatchObject({ status: 'cancelled', toolCalls: [{ status: 'completed' }, { status: 'cancelled' }] })
    stop()
  })

  it('deduplicates event IDs while preserving repeated incremental thinking and whitespace', async () => {
    const thought = (eventId: string, output: string, sequence: number): StreamEvent => ({ version: 1, type: 'thinking', sequence, payload: { eventId, agentId: 'master-1', agentName: '主智能体', messageId: 'msg-1', timestamp, status: 'running', output } })
    const store = await sendEvents([thought('t1', '好', 0), thought('t1', '好', 1), thought('t2', ' ', 2), thought('t3', '好', 3), start({ eventId: 's1' }, 4), start({ eventId: 's1' }, 5), result({}, 6)])
    expect(store.messages.at(-1)?.agentOutputs).toMatchObject([{ content: '好 好', messageId: 'msg-1', status: 'completed' }])
    expect(store.messages.at(-1)?.agentOutputs).toHaveLength(1)
    expect(store.messages.at(-1)?.toolCalls).toHaveLength(1)
    expect(store.messages.at(-1)?.content).toBe('')
  })

  it('keeps thinking segments separate across agents, message IDs and tool calls', async () => {
    const thought = (sequence: number, messageId = 'msg-1', agentId = 'master-1'): StreamEvent => ({ version: 1, type: 'thinking', sequence, payload: { agentId, agentName: '智能体', messageId, timestamp: timestamp + sequence, output: `输出${sequence}` } })
    const store = await sendEvents([thought(0), thought(1, 'msg-2'), thought(2, 'msg-2', 'master-2'), start({}, 3), thought(4, 'msg-2', 'master-2'), result({}, 5)])
    expect(store.messages.at(-1)?.agentOutputs?.map((output) => output.content)).toEqual(['输出0', '输出1', '输出2', '输出4'])
  })
})

const stubs = { 'el-icon': { template: '<span><slot /></span>' }, 'el-button': true }
const tool = (overrides: Partial<ToolCall> = {}): ToolCall => ({ ...metadata, sequence: 0, result: '用户信息已返回', status: 'completed', completedAt: timestamp + 1500, ...overrides })

describe('tool timeline presentation', () => {
  it('orders tool calls by timestamp and renders a flat combined tool label', () => {
    const wrapper = mount(AgentProgressTimeline, { props: { tools: [
      tool({ toolCallId: 'last', timestamp: timestamp + 40 }),
      tool({ toolCallId: 'first', timestamp }),
      tool({ toolCallId: 'middle', agentId: 'general-1', agentName: '通用信息智能体', timestamp: timestamp + 20 }),
    ] }, global: { stubs } })
    expect(wrapper.findAll('.agent-heading > strong').map((node) => node.text())).toEqual(['主智能体-获取用户信息', '通用信息智能体-获取用户信息', '主智能体-获取用户信息'])
    expect(wrapper.findAll('.agent-activity')).toHaveLength(3)
    expect(wrapper.find('.agent-activities').exists()).toBe(false)
    expect(wrapper.findAll('.agent-toggle')).toHaveLength(0)
  })

  it('uses sequence as a timestamp tie breaker and ignores thinking output', () => {
    const wrapper = mount(AgentProgressTimeline, { props: { tools: [tool({ agentId: 'master-2', sequence: 2 })], outputs: [{ id: 'thought', agentId: 'master-1', agentName: '主智能体', content: '先分析需求', timestamp, sequence: 1, status: 'completed' }] }, global: { stubs } })
    expect(wrapper.findAll('.agent-step')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('先分析需求')
  })

  it('toggles the whole timeline and auto-collapses when execution ends', async () => {
    const wrapper = mount(AgentProgressTimeline, { props: { status: 'streaming', tools: [tool()] }, global: { stubs } })
    const toggle = wrapper.get('.timeline-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.agent-timeline').exists()).toBe(true)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.agent-timeline').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await wrapper.setProps({ status: 'completed' })
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.agent-timeline').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('colors the execution marker red while running and green when complete', async () => {
    const wrapper = mount(AgentProgressTimeline, { props: { status: 'streaming', tools: [tool({ status: 'running' })] }, global: { stubs } })
    expect(wrapper.get('.timeline-marker').classes()).toContain('is-running')

    await wrapper.setProps({ status: 'completed', tools: [tool({ status: 'completed' })] })
    expect(wrapper.get('.timeline-marker').classes()).toContain('is-done')
  })

  it('stays expanded while waiting for user input', () => {
    const wrapper = mount(AgentProgressTimeline, { props: { status: 'awaiting-input', tools: [tool({ status: 'suspended' })] }, global: { stubs } })
    expect(wrapper.get('.timeline-toggle').attributes('aria-expanded')).toBe('true')
  })

  it('shows Chinese agent/tool labels, parameters, output, timestamps and duration', async () => {
    const wrapper = mount(AgentProgressTimeline, { props: { tools: [tool({ agentName: 'MasterAgent', tooldesc: null })] }, global: { stubs } })
    expect(wrapper.text()).toContain('主智能体-获取用户信息')
    expect(wrapper.text()).toContain('执行完成')
    expect(wrapper.text()).not.toContain('执行成功')
    expect(wrapper.text()).toContain('1.5 秒')
    expect(wrapper.findAll('time').every((node) => Boolean(node.attributes('datetime')))).toBe(true)
    expect(wrapper.get('.tool-input summary').text()).toBe('调用参数')
    expect(wrapper.get('.tool-input pre').text()).toContain('"scope": "current"')
    expect(wrapper.get('.tool-output summary').text()).toBe('执行结果')
    expect(wrapper.get('.tool-output').attributes('open')).toBeUndefined()
    expect(wrapper.get('.tool-output pre').text()).toBe('用户信息已返回')
    await wrapper.get('.tool-output summary').trigger('click')
    expect(wrapper.get('.tool-output').attributes('open')).toBeDefined()
    await wrapper.setProps({ tools: [tool({ status: 'suspended' })] })
    expect(wrapper.text()).toContain('已挂起')
    expect(wrapper.text()).not.toContain('执行完成')
  })

  it.each(['running', 'failed', 'cancelled', 'interrupted'] as const)('shows the %s state without inventing a result', (status) => {
    const wrapper = mount(AgentProgressTimeline, { props: { tools: [tool({ status, result: undefined })] }, global: { stubs } })
    expect(wrapper.get('.agent-activity').classes()).toContain(`is-${status}`)
    expect(wrapper.find('.tool-output').exists()).toBe(false)
    expect(wrapper.get('.result-placeholder').text().length).toBeGreaterThan(0)
  })

  it.each(['', null, 0, false])('keeps explicit empty or falsy tool output %j visible', (value) => {
    const wrapper = mount(AgentProgressTimeline, { props: { tools: [tool({ result: value })] }, global: { stubs } })
    expect(wrapper.get('.tool-output pre').text()).toBe(value === '' || value === null ? '无文本输出' : String(value))
  })

  it('renders tool output as plain text and keeps the final assistant answer after the timeline', async () => {
    const wrapper = mount(ConversationMessage, { props: { message: { id: 1, conversationId: 25, role: 'assistant', content: '最终回复', status: 'completed', toolCalls: [tool({ result: '<script>alert(1)</script>' })] } }, global: { stubs } })
    expect(wrapper.get('.timeline-toggle').attributes('aria-expanded')).toBe('false')
    await wrapper.get('.timeline-toggle').trigger('click')
    expect(wrapper.get('.tool-output pre').text()).toBe('<script>alert(1)</script>')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.get('.assistant-progress').find('.agent-progress').exists()).toBe(true)
    expect(wrapper.get('.message-bubble').text()).toBe('最终回复')
  })

  it('connects the intent and execution markers when both timelines are present', () => {
    const wrapper = mount(ConversationMessage, { props: { message: {
      id: 1,
      conversationId: 25,
      role: 'assistant',
      content: '',
      status: 'streaming',
      intentEvents: [{ version: 1, type: 'intent_start', sequence: 0, payload: { traceId: 'trace-1' } }],
      toolCalls: [tool({ status: 'running', result: undefined })],
    } }, global: { stubs } })
    expect(wrapper.find('.progress-connector').exists()).toBe(true)
    expect(wrapper.get('.intent-progress').classes()).toContain('has-tool-connector')
    expect(wrapper.get('.intent-pulse').classes()).toContain('is-running')
    expect(wrapper.get('.timeline-marker').classes()).toContain('is-running')
  })
})

describe('intent recognition timeline presentation', () => {
  it('merges stage updates and renders the recognition summary', () => {
    const wrapper = mount(IntentProgressTimeline, { props: { events: [
      { version: 1, type: 'intent_start', sequence: 0, payload: { traceId: 'trace-1' } },
      { version: 1, type: 'intent_progress', sequence: 1, payload: { traceId: 'trace-1', stage: 'rule_matching', status: 'started', message: '开始规则匹配', pass: 'original' } },
      { version: 1, type: 'intent_progress', sequence: 2, payload: { traceId: 'trace-1', stage: 'rule_matching', status: 'completed', message: '规则匹配完成', pass: 'original', level: 'L1' } },
      { version: 1, type: 'intent_progress', sequence: 3, payload: { traceId: 'trace-1', stage: 'question_rewrite', status: 'completed', message: '问题改写完成', rewrittenQuestion: '帮我预订下周一从上海到北京的机票' } },
      { version: 1, type: 'recognition_result', sequence: 4, payload: { traceId: 'trace-1', stage: 'recognition_result', status: 'completed', message: '意图识别完成', level: 'L1', intents: ['BOOK_TRAVEL'], isMultiIntent: false } },
    ] }, global: { stubs } })
    expect(wrapper.findAll('.intent-step')).toHaveLength(4)
    expect(wrapper.text()).toContain('规则匹配')
    expect(wrapper.text()).toContain('L1')
    expect(wrapper.text()).toContain('BOOK_TRAVEL')
    expect(wrapper.text()).toContain('单一意图')
    expect(wrapper.text()).toContain('改写后问题')
    expect(wrapper.text()).toContain('帮我预订下周一从上海到北京的机票')
    expect(wrapper.text()).toContain('意图识别完成')
    expect(wrapper.get('.intent-pulse').classes()).toContain('is-done')
  })

  it('marks ongoing intent recognition red and completed intent recognition green', () => {
    const wrapper = mount(IntentProgressTimeline, { props: { events: [
      { version: 1, type: 'intent_start', sequence: 0, payload: { traceId: 'trace-1' } },
      { version: 1, type: 'intent_progress', sequence: 1, payload: { traceId: 'trace-1', stage: 'rule_matching', status: 'running', message: '正在匹配规则' } },
    ] }, global: { stubs } })
    expect(wrapper.get('.intent-pulse').classes()).not.toContain('is-done')

    return wrapper.setProps({ events: [
      { version: 1, type: 'intent_start', sequence: 0, payload: { traceId: 'trace-1' } },
      { version: 1, type: 'recognition_result', sequence: 1, payload: { traceId: 'trace-1', stage: 'recognition_result', status: 'completed', message: '识别完成' } },
    ] }).then(() => expect(wrapper.get('.intent-pulse').classes()).toContain('is-done'))
  })

  it('auto-collapses after intent_end and allows manual expansion', async () => {
    const wrapper = mount(IntentProgressTimeline, { props: { events: [
      { version: 1, type: 'intent_start', sequence: 0, payload: { traceId: 'trace-1' } },
      { version: 1, type: 'intent_progress', sequence: 1, payload: { traceId: 'trace-1', stage: 'structure_analysis', status: 'completed', message: '结构分析完成' } },
      { version: 1, type: 'intent_end', sequence: 2, payload: { traceId: 'trace-1' } },
    ] }, global: { stubs } })

    expect(wrapper.get('.intent-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.intent-steps').exists()).toBe(false)

    await wrapper.get('.intent-toggle').trigger('click')
    expect(wrapper.get('.intent-toggle').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.intent-steps').exists()).toBe(true)

    await wrapper.get('.intent-toggle').trigger('click')
    expect(wrapper.get('.intent-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.intent-steps').exists()).toBe(false)
  })
})
