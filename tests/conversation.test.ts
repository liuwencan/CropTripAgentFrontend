import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appConfig } from '@/config'
import { useConversationStore } from '@/store/conversation'

describe('conversation store', () => {
  beforeEach(() => { setActivePinia(createPinia()); appConfig.enableMock = true })
  it('streams ordered assistant content without duplicating user messages', async () => {
    const store = useConversationStore()
    await store.send('帮我规划上海到北京的行程')
    expect(store.messages.filter((message) => message.role === 'user')).toHaveLength(1)
    expect(store.messages.at(-1)?.content).toContain('差旅建议')
    expect(store.messages.at(-1)?.status).toBe('completed')
  })
})
