import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkflowStore } from '@/store/workflow'
import type { ConfirmationAction } from '@/types/workflow'

describe('workflow store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('generates one idempotency key for a confirmation', async () => {
    const store = useWorkflowStore()
    const action: ConfirmationAction = { id: 'booking-1', workflowId: 'workflow-1', title: '预订机票', summary: '上海到北京', status: 'pending' }
    await store.confirm(action)
    expect(action.status).toBe('confirmed')
    expect(action.idempotencyKey).toBeTruthy()
  })
  it('does not submit a duplicate confirmation while pending', async () => {
    const store = useWorkflowStore()
    const action: ConfirmationAction = { id: 'booking-2', workflowId: 'workflow-1', title: '预订酒店', summary: '北京酒店', status: 'pending' }
    await Promise.all([store.confirm(action), store.confirm(action)])
    expect(action.status).toBe('confirmed')
    expect(Object.keys(store.pendingKeys)).toHaveLength(0)
  })
})
