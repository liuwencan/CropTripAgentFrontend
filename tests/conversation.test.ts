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
  it('streams ordered assistant content without duplicating user messages', async () => {
    const store = useConversationStore()
    await store.send('帮我规划上海到北京的行程')
    expect(store.messages.filter((message) => message.role === 'user')).toHaveLength(1)
    expect(store.messages.at(-1)?.content).toContain('差旅建议')
    expect(store.messages.at(-1)?.status).toBe('completed')
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
})
