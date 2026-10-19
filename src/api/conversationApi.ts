import { appConfig } from '@/config'
import { buildUrl, getAuthorizationHeader, request, requestData } from './http'
import { readSseStream } from '@/utils/sse'
import { createIdempotencyKey } from '@/utils/id'
import type { Conversation, ConversationMessage, StreamEvent } from '@/types/conversation'
import type { PageResponse } from '@/types/api'

import { mockConversation, mockStream } from '@/mocks/fixtures'

const mockConversations: Conversation[] = [{ ...mockConversation, messageCount: 0 }]
const mockMessages = new Map<number, ConversationMessage[]>()
let mockConversationId = mockConversation.id

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
    if (appConfig.enableMock) return (mockMessages.get(conversationId) || []).map((message) => ({ ...message }))
    const page = await request<PageResponse<ConversationMessage>>(`/agent/conversations/${conversationId}/messages?pageNo=1&pageSize=100`)
    return page.data
  },
  async *stream(conversationId: number, content: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    if (appConfig.enableMock) {
      const events = mockStream(content)
      let response = ''
      try {
        for (const event of events) {
          await new Promise((resolve) => setTimeout(resolve, 120))
          if (signal?.aborted) return
          if (event.type === 'message.delta') response += event.payload.content
          yield event
        }
      } finally {
        const history = mockMessages.get(conversationId) || []
        history.push({ id: Date.now() + 1, conversationId, role: 'assistant', content: response, status: signal?.aborted ? 'cancelled' : 'completed' })
        mockMessages.set(conversationId, history)
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
        body: JSON.stringify({ conversationId, question: content }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`流式请求失败（${response.status}）`)
      yield* readSseStream(response)
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  },
  async sendMessage(conversationId: number, content: string) {
    // The backend persists the user message when /chat/chat opens the SSE stream.
    const message = { id: Date.now(), conversationId, role: 'user' as const, content }
    if (appConfig.enableMock) {
      const history = mockMessages.get(conversationId) || []
      history.push(message)
      mockMessages.set(conversationId, history)
    }
    return message
  },
}
