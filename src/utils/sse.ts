import type { AskUserPrompt, StreamEvent, ToolResultEventPayload, ToolStartEventPayload, ToolSuccessEventPayload } from '@/types/conversation'

function extractDelta(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  for (const key of ['delta', 'content', 'text']) {
    const text = extractDelta(record[key])
    if (text !== undefined) return text
  }
  return undefined
}

function isAskPrompt(value: unknown): value is AskUserPrompt {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (
    typeof (value as Record<string, unknown>).question === 'string' ||
    typeof (value as Record<string, unknown>).ui_type === 'string' ||
    Array.isArray((value as Record<string, unknown>).fields)
  ))
}

function parseObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

export function parseSseEvent(raw: string, fallbackSequence = 0): StreamEvent | null {
  const eventName = raw.match(/^event:\s*(.+)$/m)?.[1]?.trim()
  const dataLines = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
  if (!dataLines.length) return null
  const data = dataLines.join('\n')
  let parsed: unknown
  try {
    parsed = JSON.parse(data) as unknown
  } catch {
    if (eventName === 'delta') {
      return { version: 1, type: 'message.delta', sequence: fallbackSequence, payload: { content: data } }
    }
    return null
  }
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) as unknown } catch { return null }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const payload = parsed as Record<string, unknown>
  try {
    const deltaContent = [payload.delta, payload.content, payload.text, payload.payload, payload.data]
      .map(extractDelta)
      .find((content) => content !== undefined)
    if ((eventName === 'delta' || payload.type === 'delta' || payload.type === 'message.delta') && deltaContent !== undefined) {
      return {
        version: 1,
        type: 'message.delta',
        sequence: typeof payload.sequence === 'number' ? payload.sequence : fallbackSequence,
        payload: { content: deltaContent },
      }
    }
    if (eventName === 'complete' || payload.type === 'complete') {
      return { version: 1, type: 'message.done', sequence: typeof payload.sequence === 'number' ? payload.sequence : fallbackSequence, payload }
    }
    const typedAsk = payload.type === 'ask' || payload.event === 'ask' || eventName === 'ask' || isAskPrompt(payload)
    const askData = parseObject(payload.input) ?? parseObject(payload.delta) ?? parseObject(payload.data) ?? parseObject(payload.payload) ?? payload
    if (typedAsk && isAskPrompt(askData)) {
      return {
        version: 1,
        type: 'ask',
        sequence: fallbackSequence,
        payload: {
          ...(typeof payload.conversationId === 'number' ? { conversationId: payload.conversationId } : {}),
          ...(typeof payload.toolCallId === 'string' ? { toolCallId: payload.toolCallId } : typeof (askData as unknown as Record<string, unknown>).toolCallId === 'string' ? { toolCallId: (askData as unknown as Record<string, unknown>).toolCallId as string } : {}),
          delta: askData as AskUserPrompt,
        },
      }
    }
    if (typeof payload.type === 'string' && typeof payload.sequence === 'number') return payload as StreamEvent
    if (eventName === 'tool_start' && typeof payload.toolCallId === 'string' && typeof payload.toolName === 'string') {
      return {
        version: 1,
        type: 'tool_start',
        sequence: fallbackSequence,
        payload: payload as unknown as ToolStartEventPayload,
      }
    }
    if (eventName === 'tool_result' && typeof payload.toolCallId === 'string') {
      return {
        version: 1,
        type: 'tool_result',
        sequence: fallbackSequence,
        payload: payload as unknown as ToolResultEventPayload,
      }
    }
    if (eventName === 'tool_success' && typeof payload.toolCallId === 'string') {
      return {
        version: 1,
        type: 'tool_success',
        sequence: fallbackSequence,
        payload: payload as unknown as ToolSuccessEventPayload,
      }
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
  let streamDone = false
  const readFrames = (value: string) => value
    // Accept standard SSE blank-line separators and the single-newline
    // separators emitted by some gateway/proxy implementations.
    .split(/\r?\n(?:\r?\n|(?=event\s*:))/)
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const chunks = readFrames(buffer)
      buffer = chunks.pop() ?? ''
      for (const chunk of chunks) {
        const event = parseSseEvent(chunk, sequence++)
        if (event) yield event
      }
      if (done) {
        streamDone = true
        break
      }
    }
    const finalEvent = parseSseEvent(buffer, sequence++)
    if (finalEvent) yield finalEvent
  } finally {
    if (!streamDone) {
      try { await reader.cancel() } catch { /* The consumer may already have closed the response. */ }
    }
    reader.releaseLock()
  }
}
