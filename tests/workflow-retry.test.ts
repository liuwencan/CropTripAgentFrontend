import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkflowStore } from '@/store/workflow'

describe('workflow recovery', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('retries one failed source and refreshes a workflow', async () => {
    const store = useWorkflowStore()
    const block = { workflowId: 'w1', status: 'partial' as const, sources: [{ id: 'flight', name: '机票', status: 'failure' as const, error: 'timeout' }, { id: 'hotel', name: '酒店', status: 'success' as const }] }
    store.upsert(block)
    await store.retrySource(block, 'flight')
    expect(block.sources?.every((source) => source.status === 'success')).toBe(true)
    store.refresh(block)
    expect(store.blocks.w1.status).toBe('loading')
  })
})
