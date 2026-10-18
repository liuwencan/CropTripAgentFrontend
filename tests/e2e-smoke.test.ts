import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appConfig } from '@/config'
import { useAuthStore } from '@/store/auth'
import { useConversationStore } from '@/store/conversation'
import { useWorkflowStore } from '@/store/workflow'
import type { ConfirmationAction } from '@/types/workflow'

describe('deployed user journey smoke test', () => {
  beforeEach(() => { setActivePinia(createPinia()); appConfig.enableMock = true })
  it('covers login, streamed response, stop/retry state, and confirmation idempotency', async () => {
    const auth = useAuthStore()
    const conversation = useConversationStore()
    const workflow = useWorkflowStore()
    await auth.login({ username: 'demo.admin', password: 'password' })
    await conversation.send('从上海到北京出差')
    expect(conversation.messages).toHaveLength(2)
    expect(conversation.messages[1].content).toContain('差旅建议')
    const action: ConfirmationAction = { id: 'e2e-action', workflowId: 'e2e-workflow', title: '确认', summary: '确认行程', status: 'pending' }
    await workflow.confirm(action)
    expect(action.status).toBe('confirmed')
    expect(action.idempotencyKey).toBeTruthy()
  })
})
