import type { AgentPlan, AskUserPrompt, BookingResult, IntentProgressPayload, RecommendedQuestionsPayload, StreamEvent, ThinkingEventPayload, ToolResultEventPayload, ToolStartEventPayload, ToolSuccessEventPayload } from '@/types/conversation'

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
  const sequence = fallbackSequence
  if (eventName === 'intent_start' || eventName === 'intent_end') {
    let traceId = data.trim().replace(/^"|"$/g, '')
    try {
      const lifecycle = JSON.parse(data) as unknown
      if (typeof lifecycle === 'string') traceId = lifecycle
      else if (lifecycle && typeof lifecycle === 'object' && !Array.isArray(lifecycle) && typeof (lifecycle as Record<string, unknown>).traceId === 'string') traceId = (lifecycle as Record<string, string>).traceId
    } catch { /* The documented lifecycle payload is a raw trace id. */ }
    if (traceId) return { version: 1, type: eventName, sequence, payload: { traceId } }
  }
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
    if (eventName === 'intent_start' || eventName === 'intent_end') {
      return { version: 1, type: eventName, sequence, payload: { traceId: parsed } }
    }
    try { parsed = JSON.parse(parsed) as unknown } catch { return null }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const payload = parsed as Record<string, unknown>
  try {
    const bookingPayload = parseObject(payload.payload) ?? parseObject(payload.data) ?? payload
    const recommendationPayload = parseObject(payload.payload) ?? parseObject(payload.data) ?? payload
    if (eventName?.toLowerCase() === 'recommend_questions' || String(payload.eventType ?? '').toLowerCase() === 'recommend_questions' || payload.type === 'recommend_questions' || recommendationPayload.format === 'recommend_questions.v1') {
      const questionValues = recommendationPayload.question ?? recommendationPayload.questions
      const questions = (Array.isArray(questionValues) ? questionValues : typeof questionValues === 'string' ? [questionValues] : [])
        .filter((question): question is string => typeof question === 'string' && question.trim().length > 0)
        .map((question) => question.trim())
      if (!questions.length) return null
      const recommendedQuestions: RecommendedQuestionsPayload = {
        questions: [...new Set(questions)],
        ...(typeof recommendationPayload.count === 'number' ? { count: recommendationPayload.count } : {}),
        ...(typeof recommendationPayload.format === 'string' ? { format: recommendationPayload.format } : {}),
      }
      return { version: 1, type: 'recommend_questions', sequence: typeof payload.sequence === 'number' ? payload.sequence : fallbackSequence, payload: recommendedQuestions }
    }
    if (eventName === 'booking_result' || payload.type === 'booking_result' || bookingPayload.type === 'booking_result') {
      const result: BookingResult = {
        type: 'booking_result',
        ...(typeof bookingPayload.bizType === 'string' ? { bizType: bookingPayload.bizType } : {}),
        ...(typeof bookingPayload.bizTypeLabel === 'string' ? { bizTypeLabel: bookingPayload.bizTypeLabel } : {}),
        ...(typeof bookingPayload.orderId === 'string' ? { orderId: bookingPayload.orderId } : {}),
        ...(typeof bookingPayload.title === 'string' ? { title: bookingPayload.title } : {}),
        ...(typeof bookingPayload.amount === 'string' || typeof bookingPayload.amount === 'number' ? { amount: String(bookingPayload.amount) } : {}),
        ...(typeof bookingPayload.currency === 'string' ? { currency: bookingPayload.currency } : {}),
        ...(typeof bookingPayload.payUrl === 'string' ? { payUrl: bookingPayload.payUrl } : {}),
        ...(typeof bookingPayload.statusLabel === 'string' ? { statusLabel: bookingPayload.statusLabel } : {}),
      }
      return { version: 1, type: 'booking_result', sequence: typeof payload.sequence === 'number' ? payload.sequence : fallbackSequence, payload: result }
    }
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
    const nestedPayload = parseObject(payload.payload)
    const nestedData = parseObject(payload.data)
    const askData = parseObject(payload.input)
      ?? parseObject(payload.delta)
      ?? nestedData
      ?? parseObject(nestedPayload?.input)
      ?? parseObject(nestedPayload?.delta)
      ?? parseObject(nestedPayload?.data)
      ?? nestedPayload
      ?? payload
    if (typedAsk && isAskPrompt(askData)) {
      const metadata = [payload, nestedPayload, nestedData, askData]
      const conversationId = metadata.find((item) => typeof item?.conversationId === 'number')?.conversationId
      const toolCallId = metadata.find((item) => typeof item?.toolCallId === 'string')?.toolCallId
      return {
        version: 1,
        type: 'ask',
        sequence: fallbackSequence,
        payload: {
          ...(typeof conversationId === 'number' ? { conversationId } : {}),
          ...(typeof toolCallId === 'string' ? { toolCallId } : {}),
          delta: askData as AskUserPrompt,
        },
      }
    }
    const progressData = parseObject(payload.data)
    const progress = parseObject(payload.payload) ?? progressData ?? payload
    const progressType = eventName === 'tool_start' || eventName === 'tool_result' || eventName === 'tool_error' || eventName === 'thinking' || eventName === 'tool_success'
      ? eventName : payload.eventType ?? payload.type ?? progress.eventType ?? progress.type
    const eventSequence = typeof payload.sequence === 'number' ? payload.sequence : fallbackSequence
    const intentType = eventName === 'intent_progress' || eventName === 'recognition_result'
      ? eventName : progressType === 'intent_progress' || progressType === 'recognition_result' ? progressType : undefined
    if (intentType) {
      const traceId = [progress.traceId, payload.traceId].find((value): value is string => typeof value === 'string')
      const stage = typeof progress.stage === 'string' ? progress.stage : intentType === 'recognition_result' ? 'recognition_result' : undefined
      if (traceId && stage) {
        const intentPayload: IntentProgressPayload = {
          traceId,
          stage,
          status: typeof progress.status === 'string' ? progress.status : intentType === 'recognition_result' ? 'completed' : 'started',
          message: typeof progress.message === 'string' ? progress.message : stage,
          ...(typeof progress.pass === 'string' ? { pass: progress.pass } : {}),
          ...(typeof progress.level === 'string' ? { level: progress.level } : {}),
          ...(typeof progress.rewrittenQuestion === 'string' ? { rewrittenQuestion: progress.rewrittenQuestion } : {}),
          ...(Array.isArray(progress.intents) ? { intents: progress.intents.filter((intent): intent is string => typeof intent === 'string') } : {}),
          ...(typeof progress.isMultiIntent === 'boolean' ? { isMultiIntent: progress.isMultiIntent } : {}),
        }
        return { version: 1, type: intentType, sequence: eventSequence, payload: intentPayload }
      }
    }
    if ((eventName === 'plan_update' || payload.type === 'plan_update' || payload.eventType === 'plan_update' || progress.type === 'plan_update')
      && typeof progress.agentName === 'string' && typeof progress.planName === 'string' && Array.isArray(progress.tasks)) {
      const { type: _type, eventType: _eventType, ...plan } = progress
      return { version: 1, type: 'plan_update', sequence: eventSequence, payload: plan as unknown as AgentPlan }
    }
    if (progressType === 'tool_start' && typeof progress.toolCallId === 'string' && typeof progress.toolName === 'string') {
      return {
        version: 1,
        type: 'tool_start',
        sequence: eventSequence,
        payload: progress as unknown as ToolStartEventPayload,
      }
    }
    if ((progressType === 'tool_result' || progressType === 'tool_error') && typeof progress.toolCallId === 'string') {
      return {
        version: 1,
        type: progressType,
        sequence: eventSequence,
        payload: progress as unknown as ToolResultEventPayload,
      }
    }
    if (progressType === 'thinking' && typeof progress.output === 'string') {
      return { version: 1, type: 'thinking', sequence: eventSequence, payload: progress as unknown as ThinkingEventPayload }
    }
    if (progressType === 'tool_success' && typeof progress.toolCallId === 'string') {
      return {
        version: 1,
        type: 'tool_success',
        sequence: eventSequence,
        payload: progress as unknown as ToolSuccessEventPayload,
      }
    }
    if (['tool_start', 'tool_result', 'tool_error', 'tool_success', 'thinking'].includes(String(progressType))) return null
    if (typeof payload.type === 'string' && typeof payload.sequence === 'number') return payload as StreamEvent
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
