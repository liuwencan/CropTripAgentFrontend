import { createIdempotencyKey } from '@/utils/id'

export async function confirmTravelAction(actionId: string, payload: Record<string, unknown>) {
  return { actionId, idempotencyKey: createIdempotencyKey(), payload, status: 'confirmed' as const }
}
