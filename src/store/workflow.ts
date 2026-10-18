import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { confirmTravelAction } from '@/api/travelApi'
import { createIdempotencyKey } from '@/utils/id'
import type { ConfirmationAction, WorkflowBlock } from '@/types/workflow'

export const useWorkflowStore = defineStore('workflow', () => {
  const blocks = reactive<Record<string, WorkflowBlock>>({})
  const pendingKeys = reactive<Record<string, string>>({})

  function upsert(block: WorkflowBlock) { blocks[block.workflowId] = { ...blocks[block.workflowId], ...block } }

  async function confirm(action: ConfirmationAction) {
    if (action.status !== 'pending' || pendingKeys[action.id]) return
    const idempotencyKey = createIdempotencyKey()
    pendingKeys[action.id] = idempotencyKey
    action.status = 'processing'
    try {
      await confirmTravelAction(action.id, { idempotencyKey })
      action.idempotencyKey = idempotencyKey
      action.status = 'confirmed'
    } catch { action.status = 'failed' } finally { delete pendingKeys[action.id] }
  }

  function cancel(action: ConfirmationAction) { if (action.status === 'pending') action.status = 'cancelled' }

  async function retrySource(block: WorkflowBlock, sourceId: string) {
    const source = block.sources?.find((item) => item.id === sourceId)
    if (!source || source.status !== 'failure') return
    source.status = 'loading'
    await new Promise((resolve) => setTimeout(resolve, 10))
    source.status = 'success'
    source.error = undefined
    block.status = block.sources?.every((item) => item.status === 'success') ? 'success' : 'partial'
  }

  function refresh(block: WorkflowBlock) { upsert({ ...block, status: 'loading' }) }

  return { blocks, pendingKeys, upsert, confirm, cancel, retrySource, refresh }
})
