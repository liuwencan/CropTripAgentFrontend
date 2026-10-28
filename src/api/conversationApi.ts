import { appConfig } from '@/config'
import { buildUrl, getAuthorizationHeader, request, requestData } from './http'
import { readSseStream } from '@/utils/sse'
import { createIdempotencyKey } from '@/utils/id'
import type { AskUserPrompt, Conversation, ConversationMessage, StreamEvent } from '@/types/conversation'
import type { PageResponse } from '@/types/api'

import { mockConversation, mockStream } from '@/mocks/fixtures'

const mockConversations: Conversation[] = [{ ...mockConversation, messageCount: 0 }]
const mockMessages = new Map<number, ConversationMessage[]>()
let mockConversationId = mockConversation.id

function normalizeMessageRole(message: ConversationMessage): ConversationMessage {
  const raw = message as ConversationMessage & Record<string, unknown>
  const roleValue = raw.role ?? raw.senderRole ?? raw.messageRole ?? raw.senderType ?? raw.messageType
  const role = typeof roleValue === 'string' ? roleValue.toLowerCase() : ''
  if (['user', 'human', 'customer', 'employee'].includes(role)) return { ...message, role: 'user' }
  if (['assistant', 'ai', 'agent', 'bot'].includes(role)) return { ...message, role: 'assistant' }
  if (role === 'tool') return normalizeToolMessage(message)
  if (role === 'system') return { ...message, role: 'system' }
  return message
}

function parseObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

function isAskPrompt(value: unknown): value is AskUserPrompt {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (
    typeof (value as Record<string, unknown>).question === 'string' ||
    typeof (value as Record<string, unknown>).ui_type === 'string' ||
    Array.isArray((value as Record<string, unknown>).fields)
  ))
}

function normalizeToolMessage(message: ConversationMessage): ConversationMessage {
  const envelope = parseObject(message.content)
  const input = parseObject(envelope?.input)
  if (!input || !isAskPrompt(input)) return { ...message, role: 'assistant' }
  return {
    ...message,
    role: 'assistant',
    content: '',
    status: 'awaiting-input',
    askStatus: 'pending',
    askToolCallId: typeof envelope?.toolCallId === 'string' ? envelope.toolCallId : undefined,
    ask: input,
  }
}

export const conversationApi = {
  async list(): Promise<Conversation[]> {
    if (appConfig.enableMock) return [...mockConversations]
    const page = await request<PageResponse<Conversation>>('/agent/conversations?pageNo=1&pageSize=100&status=ACTIVE')
    return page.data
  },
  async create(title: string): Promise<Conversation> {
    if (appConfig.enableMock) {
      const conversation = { ...mockConversation, id: ++mockConversationId, title, messageCount: 0, createTime: new Date().toISOString() }
      mockConversations.unshift(conversation)
      mockMessages.set(conversation.id, [])
      return conversation
    }
    return requestData<Conversation>('/agent/conversations', { method: 'POST', body: JSON.stringify({ title }) })
  },
  async messages(conversationId: number): Promise<ConversationMessage[]> {
    if (appConfig.enableMock) return (mockMessages.get(conversationId) || []).map((message) => normalizeMessageRole({ ...message }))
    const page = await request<PageResponse<ConversationMessage>>(`/agent/conversations/${conversationId}/messages?pageNo=1&pageSize=100`)
    return page.data.map(normalizeMessageRole)
  },
  async *stream(conversationId: number | null, content: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    if (appConfig.enableMock) {
      const resolvedConversationId = conversationId ?? ++mockConversationId
      if (conversationId === null) {
        const conversation = { ...mockConversation, id: resolvedConversationId, title: content.trim().slice(0, 24), messageCount: 0, createTime: new Date().toISOString() }
        mockConversations.unshift(conversation)
        mockMessages.set(resolvedConversationId, [])
      }
      const events = content.includes('天气') ? [
        { version: 1, type: 'message.delta' as const, sequence: 0, payload: { content: '为了查询天气，请补充以下信息：' } },
        { version: 1, type: 'ask' as const, sequence: 1, payload: {
          conversationId: resolvedConversationId,
          toolCallId: `mock-ask-${resolvedConversationId}`,
          delta: {
            question: '请问您想查询哪个城市的天气？是近期出差的行程安排需要吗？',
            ui_type: 'form',
            fields: [
              { name: 'city', label: '查询城市', placeholder: '请输入城市名称，如：北京、上海', required: true, type: 'text' as const },
              { name: 'date', label: '查询日期', placeholder: '选择要查询的日期', type: 'date' as const },
              { name: 'purpose', label: '查询目的', options: ['出差行程规划', '返程安排', '日常了解', '其他'], type: 'select' as const },
            ],
          },
        } },
      ] satisfies StreamEvent[] : mockStream(content).map((event) => event.type === 'message.done' || event.type === 'done' ? { ...event, payload: { conversationId: resolvedConversationId } } : event)
      let response = ''
      try {
        for (const event of events) {
          await new Promise((resolve) => setTimeout(resolve, 120))
          if (signal?.aborted) return
          if (event.type === 'message.delta') response += event.payload.content
          yield event
        }
      } finally {
        const history = mockMessages.get(resolvedConversationId) || []
        history.push({ id: Date.now() + 1, conversationId: resolvedConversationId, role: 'assistant', content: response, status: signal?.aborted ? 'cancelled' : 'completed' })
        mockMessages.set(resolvedConversationId, history)
      }
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetch(buildUrl('/chat/chat', appConfig.streamBaseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': createIdempotencyKey(),
          ...(getAuthorizationHeader() ? { Authorization: getAuthorizationHeader() } : {}),
        },
        body: JSON.stringify({ ...(conversationId === null ? {} : { conversationId }), question: content }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`流式请求失败（${response.status}）`)
      yield* readSseStream(response)
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  },
  async *resume(conversationId: number, toolCallId: string, answer: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    if (appConfig.enableMock) {
      const events: StreamEvent[] = [
        { version: 1, type: 'message.delta', sequence: 0, payload: { content: `已记录：${answer}` } },
        { version: 1, type: 'message.done', sequence: 1 },
        { version: 1, type: 'done', sequence: 2 },
      ]
      let responseText = ''
      for (const event of events) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        if (signal?.aborted) return
        if (event.type === 'message.delta') responseText += event.payload.content
        yield event
      }
      const history = mockMessages.get(conversationId) || []
      history.push({ id: Date.now() + 1, conversationId, role: 'assistant', content: responseText, status: 'completed' })
      mockMessages.set(conversationId, history)
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetch(buildUrl('/chat/resume', appConfig.streamBaseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': createIdempotencyKey(),
          ...(getAuthorizationHeader() ? { Authorization: getAuthorizationHeader() } : {}),
        },
        body: JSON.stringify({ conversationId, toolCallId, answer }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Resume request failed (${response.status})`)
      yield* readSseStream(response)
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  },
  async sendMessage(conversationId: number | null, content: string) {
    // The backend persists the user message when /chat/chat opens the SSE stream.
    const message = { id: Date.now(), conversationId: conversationId ?? 0, role: 'user' as const, content }
    if (appConfig.enableMock) {
      if (conversationId !== null) {
        const history = mockMessages.get(conversationId) || []
        history.push(message)
        mockMessages.set(conversationId, history)
      }
    }
    return message
  },
}
