import type { StreamEvent } from '@/types/conversation'

export function parseSseEvent(raw: string, fallbackSequence = 0): StreamEvent | null {
  const eventName = raw.match(/^event:\s*(.+)$/m)?.[1]?.trim()
  const data = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')
  if (!data) return null
  try {
    const payload = JSON.parse(data) as Record<string, unknown>
    if (typeof payload.type === 'string' && typeof payload.sequence === 'number') return payload as StreamEvent
    if (eventName === 'delta' && typeof payload.delta === 'string') {
      return { version: 1, type: 'message.delta', sequence: fallbackSequence, payload: { content: payload.delta } }
    }
    if (eventName === 'complete') {
      return { version: 1, type: 'message.done', sequence: fallbackSequence, payload }
    }
    if (eventName === 'error') {
      return { version: 1, type: 'error', sequence: fallbackSequence, payload: { message: typeof payload.message === 'string' ? payload.message : '流式响应失败' } }
    }
    return null
  } catch {
    return null
  }
}

export async function* readSseStream(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) throw new Error('流式响应为空')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sequence = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const chunks = buffer.split(/\r?\n\r?\n/)
      buffer = chunks.pop() ?? ''
      for (const chunk of chunks) {
        const event = parseSseEvent(chunk, sequence++)
        if (event) yield event
      }
      if (done) break
    }
    const finalEvent = parseSseEvent(buffer, sequence++)
    if (finalEvent) yield finalEvent
  } finally {
    reader.releaseLock()
  }
}
