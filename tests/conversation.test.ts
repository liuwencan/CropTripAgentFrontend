import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watch } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { appConfig } from '@/config'
import { useConversationStore } from '@/store/conversation'
import { conversationApi } from '@/api/conversationApi'
import type { StreamEvent } from '@/types/conversation'

afterEach(() => vi.restoreAllMocks())

describe('conversation store', () => {
  beforeEach(() => { setActivePinia(createPinia()); appConfig.enableMock = true })
  it('posts all required clarification fields to the resume stream', async () => {
    appConfig.enableMock = false
    const fetchMock = vi.fn().mockResolvedValue(new Response('event: delta\ndata: {"delta":"continued"}\n\nevent: complete\ndata: {}\n\n', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const events: StreamEvent[] = []
    for await (const event of conversationApi.resume(12, 'ask-call-1', 'Shanghai')) events.push(event)
    expect(fetchMock.mock.calls[0][0]).toContain('/chat/resume')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ conversationId: 12, toolCallId: 'ask-call-1', answer: 'Shanghai' })
    expect(events[0]).toMatchObject({ type: 'message.delta', payload: { content: 'continued' } })
    appConfig.enableMock = true
  })
  it('starts a new chat stream without calling the conversation creation endpoint', async () => {
    appConfig.enableMock = false
    const fetchMock = vi.fn().mockResolvedValue(new Response('event: complete\ndata: {"conversationId":88}\n\n', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    for await (const _event of conversationApi.stream(null, 'Plan trip')) { /* consume */ }
    expect(fetchMock.mock.calls[0][0]).toContain('/chat/chat')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ question: 'Plan trip' })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/agent/conversations'))).toBe(false)
    appConfig.enableMock = true
  })
  it('streams ordered assistant content without duplicating user messages', async () => {
    const store = useConversationStore()
    await store.send('帮我规划上海到北京的行程')
    expect(store.messages.filter((message) => message.role === 'user')).toHaveLength(1)
    expect(store.messages.at(-1)?.content).toContain('差旅建议')
    expect(store.messages.at(-1)?.status).toBe('completed')
  })
  it('defers backend conversation creation until the first message', async () => {
    const create = vi.spyOn(conversationApi, 'create')
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      yield { version: 1, type: 'done', sequence: 0, payload: { conversationId: 88 } }
    })
    const store = useConversationStore()

    store.createConversation()
    expect(create).not.toHaveBeenCalled()
    expect(store.activeId).toBeNull()
    expect(store.messages).toEqual([])

    await store.send('Plan trip')
    expect(create).not.toHaveBeenCalled()
    expect(store.activeId).toBe(88)
  })
  it('normalizes uppercase history roles so user messages stay on the right after refresh', async () => {
    appConfig.enableMock = false
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
      { id: 1, conversationId: 28, role: 'USER', content: '我的问题' },
      { id: 2, conversationId: 28, role: 'ASSISTANT', content: '助手回复' },
    ], pageNo: 1, pageSize: 100, totalCount: 2, totalPage: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const history = await conversationApi.messages(28)
    expect(history.map((message) => message.role)).toEqual(['user', 'assistant'])
    appConfig.enableMock = true
  })
  it('replays TOOL history messages as pending ask forms', async () => {
    appConfig.enableMock = false
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
      { id: 218, conversationId: 137, role: 'USER', content: '你好' },
      { id: 219, conversationId: 137, role: 'TOOL', content: JSON.stringify({
        toolCallId: 'call-form-1',
        input: { question: '请补充出行信息', ui_type: 'form', fields: [{ name: 'origin', label: '出发城市', type: 'text', required: true }] },
      }) },
    ], pageNo: 1, pageSize: 100, totalCount: 2, totalPage: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const history = await conversationApi.messages(137)
    expect(history).toHaveLength(2)
    expect(history[1]).toMatchObject({
      role: 'assistant',
      content: '',
      status: 'awaiting-input',
      askStatus: 'pending',
      askToolCallId: 'call-form-1',
      ask: { ui_type: 'form', fields: [{ name: 'origin', label: '出发城市' }] },
    })
    appConfig.enableMock = true
  })
  it('does not resume an ask when the required tool call id is missing', async () => {
    const store = useConversationStore()
    const message = {
      id: 9, conversationId: 12, role: 'assistant' as const, content: '',
      status: 'awaiting-input' as const, askStatus: 'pending' as const,
      ask: { question: '请补充信息', ui_type: 'form' },
    }
    store.messages.push(message)
    const sendMessage = vi.spyOn(conversationApi, 'sendMessage')
    await expect(store.answerAsk(message, 'Shanghai')).rejects.toThrow('缺少工具调用标识')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(message.askStatus).toBe('pending')
  })
  it('uses the active conversation when an ask message still has the placeholder id', async () => {
    const store = useConversationStore()
    store.activeId = 137
    const message = {
      id: 219, conversationId: 0, role: 'assistant' as const, content: '',
      status: 'awaiting-input' as const, askStatus: 'pending' as const,
      askToolCallId: 'call-form-1', ask: { question: '请补充信息', ui_type: 'form' },
    }
    store.messages.push(message)
    let resumedConversationId: number | undefined
    vi.spyOn(conversationApi, 'resume').mockImplementation(async function* (conversationId): AsyncGenerator<StreamEvent> {
      resumedConversationId = conversationId
      yield { version: 1, type: 'done', sequence: 0 }
    })

    await store.answerAsk(message, '上海')

    expect(resumedConversationId).toBe(137)
    expect(store.messages.at(-1)?.conversationId).toBe(137)
  })
  it('updates reactive content before completion and keeps the stopped state', async () => {
    let resume!: () => void
    const gate = new Promise<void>((resolve) => { resume = resolve })
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (_id, _content, signal): AsyncGenerator<StreamEvent> {
      yield { version: 1, type: 'message.delta', sequence: 0, payload: { content: '正在查询差标' } }
      await gate
      if (signal?.aborted) return
      yield { version: 1, type: 'message.done', sequence: 1 }
    })
    const store = useConversationStore()
    const updates: string[] = []
    const stopWatch = watch(() => store.messages.at(-1)?.content, (content) => { if (content) updates.push(content) }, { flush: 'sync' })
    const pending = store.send('查询差标')
    await vi.waitFor(() => expect(updates).toContain('正在查询差标'))
    expect(store.sending).toBe(true)
    expect(store.messages.at(-1)?.status).toBe('streaming')
    store.stop(); resume(); await pending
    expect(store.messages.at(-1)?.status).toBe('cancelled')
    expect(store.sending).toBe(false)
    stopWatch()
  })
  it('does not duplicate cumulative SSE content frames', async () => {
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      yield { version: 1, type: 'message.delta', sequence: 0, payload: { content: '你好！很高兴为您服务😊' } }
      yield { version: 1, type: 'message.delta', sequence: 1, payload: { content: '你好！很高兴为您服务😊\n\n我可以帮您查询天气信息，方便差旅出行安排。' } }
      yield { version: 1, type: 'message.delta', sequence: 2, payload: { content: '我可以帮您查询天气信息，方便差旅出行安排。请问您想查询哪个城市、哪一天的天气呢？' } }
      yield { version: 1, type: 'message.done', sequence: 3 }
    })
    const store = useConversationStore()
    await store.send('查询天气')
    expect(store.messages.at(-1)?.content).toBe('你好！很高兴为您服务😊\n\n我可以帮您查询天气信息，方便差旅出行安排。请问您想查询哪个城市、哪一天的天气呢？')
  })
  it('still appends ordinary non-overlapping delta fragments', async () => {
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      yield { version: 1, type: 'message.delta', sequence: 0, payload: { content: '你好，' } }
      yield { version: 1, type: 'message.delta', sequence: 1, payload: { content: '正在为你查询。' } }
      yield { version: 1, type: 'done', sequence: 2 }
    })
    const store = useConversationStore()
    await store.send('查询天气')
    expect(store.messages.at(-1)?.content).toBe('你好，正在为你查询。')
  })
  it('clears workflow events on switching and creating conversations', async () => {
    const store = useConversationStore()
    vi.spyOn(conversationApi, 'messages').mockResolvedValue([])
    store.workflowEvents.push({ version: 1, type: 'workflow.update', sequence: 0, payload: { workflowId: 'previous-trip', status: 'success' } })
    await store.selectConversation(9)
    expect(store.workflowEvents).toEqual([])
    store.workflowEvents.push({ version: 1, type: 'workflow.update', sequence: 1, payload: { workflowId: 'another-trip', status: 'success' } })
    await store.createConversation()
    expect(store.workflowEvents).toEqual([])
    expect(store.messages).toEqual([])
  })
  it('renders the ask event on its assistant message and releases the composer', async () => {
    let turn = 0
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      if (turn++ === 0) {
        yield { version: 1, type: 'ask', sequence: 0, payload: { conversationId: 1, delta: { question: '请选择出发城市', ui_type: 'select', options: ['北京', '上海'] } } }
        return
      }
      yield { version: 1, type: 'message.delta', sequence: 0, payload: { content: '已记录：上海' } }
      yield { version: 1, type: 'done', sequence: 1 }
    })
    const store = useConversationStore()
    await store.send('帮我规划出差')
    const assistant = store.messages.at(-1)
    expect(store.sending).toBe(false)
    expect(assistant).toMatchObject({ status: 'awaiting-input', askStatus: 'pending', ask: { question: '请选择出发城市', ui_type: 'select', options: ['北京', '上海'] } })
    assistant!.askToolCallId = 'ask-call-1'
    await store.answerAsk(assistant!, '上海')
    expect(assistant?.askStatus).toBe('submitted')
    expect(store.messages.some((message) => message.role === 'user' && message.content === '上海')).toBe(true)
    expect(store.messages.at(-1)?.content).toContain('已记录：上海')
  })
  it('keeps the ask form visible when the SSE iterator closes after ask', async () => {
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (_id, _content, signal): AsyncGenerator<StreamEvent> {
      yield { version: 1, type: 'ask', sequence: 0, payload: { delta: { question: '请问您想查询哪个城市的天气？', ui_type: 'form', fields: [{ name: 'city', label: '查询城市', required: true, type: 'text' }] } } }
      if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
    })
    const store = useConversationStore()
    await store.send('帮我查询天气')
    expect(store.messages.at(-1)).toMatchObject({ status: 'awaiting-input', askStatus: 'pending', ask: { ui_type: 'form', fields: [{ name: 'city' }] } })
  })
  it('keeps an input-wrapped ask event in awaiting-input state', async () => {
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      yield { version: 1, type: 'ask', sequence: 0, payload: { toolCallId: 'call-weather', delta: { question: '请问您想查询哪个城市的天气？', ui_type: 'form', fields: [{ name: 'city', label: '城市', required: true, type: 'text' }] } } }
    })
    const store = useConversationStore()
    await store.send('查询天气')
    expect(store.messages.at(-1)).toMatchObject({ status: 'awaiting-input', askStatus: 'pending', askToolCallId: 'call-weather', ask: { ui_type: 'form', fields: [{ name: 'city' }] } })
  })
  it('renders the exact input-wrapped raw ask response through the chat stream', async () => {
    appConfig.enableMock = false
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('event:ask\ndata:{"toolCallId":"call_b8c0e7d20bc24aa49ed351ee","input":{"fields":[{"label":"城市","name":"city","placeholder":"例如：北京、上海","required":true,"type":"text"},{"label":"查询日期","name":"date","placeholder":"例如：今天、明天或具体日期","type":"text"}],"question":"请问您想查询哪个城市的天气？是否是为出差行程做准备呢？","ui_type":"form"}}\n\n', { status: 200 })))
    const store = useConversationStore()
    store.activeId = 1
    await store.send('你好，我想查询一下天气情况')
    expect(store.messages.at(-1)).toMatchObject({
      status: 'awaiting-input',
      askStatus: 'pending',
      askToolCallId: 'call_b8c0e7d20bc24aa49ed351ee',
      ask: { ui_type: 'form', fields: [{ name: 'city', label: '城市' }, { name: 'date', label: '查询日期' }] },
    })
    appConfig.enableMock = true
  })
  it('renders tool lifecycle events on the active assistant message', async () => {
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      yield { version: 1, type: 'tool_start', sequence: 0, payload: { toolCallId: 'call-1', agentName: 'MasterAgent', toolName: 'get_userinfo', input: '{}' } }
      yield { version: 1, type: 'tool_result', sequence: 1, payload: { conversationId: 25, toolCallId: 'call-1', toolResult: '"用户信息：rel"' } }
      yield { version: 1, type: 'tool_success', sequence: 2, payload: { conversationId: 25, toolCallId: 'call-1', phase: 'completed', state: 'success' } }
      yield { version: 1, type: 'message.delta', sequence: 3, payload: { content: '已完成' } }
      yield { version: 1, type: 'done', sequence: 4 }
    })
    const store = useConversationStore()
    await store.send('查询用户信息')
    expect(store.messages.at(-1)).toMatchObject({ content: '已完成', toolCalls: [{ toolCallId: 'call-1', toolName: 'get_userinfo', result: '"用户信息：rel"', status: 'success' }] })
  })
  it('completes only when the complete event belongs to the streamed conversation', async () => {
    vi.spyOn(conversationApi, 'stream').mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      yield { version: 1, type: 'message.delta', sequence: 0, payload: { content: '结果' } }
      yield { version: 1, type: 'message.done', sequence: 1, payload: { conversationId: 999 } }
      yield { version: 1, type: 'message.done', sequence: 2, payload: { conversationId: 1 } }
    })
    const store = useConversationStore()
    await store.send('查询')
    expect(store.messages.at(-1)?.status).toBe('completed')
  })
})
