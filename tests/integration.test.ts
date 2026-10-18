import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appConfig } from '@/config'
import { useAuthStore } from '@/store/auth'
import { useConversationStore } from '@/store/conversation'
import { useWorkflowStore } from '@/store/workflow'

describe('employee integration flow', () => {
  beforeEach(() => { setActivePinia(createPinia()); appConfig.enableMock = true })
  it('logs in, streams Markdown, and accepts a workflow event', async () => {
    const auth = useAuthStore()
    const conversations = useConversationStore()
    const workflow = useWorkflowStore()
    await auth.login({ username: 'employee', password: 'password' })
    await conversations.send('查询北京差旅标准')
    expect(auth.isAuthenticated).toBe(true)
    expect(conversations.messages.at(-1)?.content).toContain('差旅建议')
    expect(conversations.workflowEvents.some((event) => event.type === 'workflow.update')).toBe(true)
    workflow.upsert({ workflowId: 'demo-trip', status: 'success', policy: { id: 'p', title: '政策', compliant: true, explanation: '通过', status: 'success' } })
    expect(workflow.blocks['demo-trip'].policy?.compliant).toBe(true)
  })
})
