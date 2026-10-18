import { appConfig } from '@/config'
import { buildUrl, getToken, request, requestData } from './http'
import { readSseStream } from '@/utils/sse'
import { createIdempotencyKey } from '@/utils/id'
import type { Conversation, ConversationMessage, StreamEvent } from '@/types/conversation'
import type { PageResponse } from '@/types/api'

import { mockConversation, mockStream } from '@/mocks/fixtures'

export const conversationApi = {
  async list(): Promise<Conversation[]> {
    if (appConfig.enableMock) return [mockConversation]
    const page = await request<PageResponse<Conversation>>('/agent/conversations?pageNo=1&pageSize=100&status=ACTIVE')
    return page.data
  },
  async create(title: string): Promise<Conversation> {
    if (appConfig.enableMock) return { ...mockConversation, title }
    return requestData<Conversation>('/agent/conversations', { method: 'POST', body: JSON.stringify({ title }) })
  },
  async messages(conversationId: number): Promise<ConversationMessage[]> {
    if (appConfig.enableMock) return []
    const page = await request<PageResponse<ConversationMessage>>(`/agent/conversations/${conversationId}/messages?pageNo=1&pageSize=100`)
    return page.data
  },
  async *stream(conversationId: number, content: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    if (appConfig.enableMock) {
      const events = mockStream(content)
      for (const event of events) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        if (signal?.aborted) return
        yield event
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
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': createIdempotencyKey(), ...(getToken() ? { token: getToken() as string } : {}) },
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
    return { id: Date.now(), conversationId, role: 'user' as const, content }
  },
}
