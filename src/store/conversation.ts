import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { conversationApi } from '@/api/conversationApi'
import type { AgentOutput, AgentProgressMetadata, Conversation, ConversationMessage, StreamEvent, ToolCall } from '@/types/conversation'

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([])
  const activeId = ref<number | null>(null)
  const messages = ref<ConversationMessage[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const abortController = ref<AbortController | null>(null)
  const workflowEvents = ref<StreamEvent[]>([])
  const activeConversation = computed(() => conversations.value.find((item) => item.id === activeId.value) ?? null)

  function findOrCreateToolCall(assistant: ConversationMessage, payload: AgentProgressMetadata & { toolCallId: string }, sequence: number): ToolCall {
    assistant.toolCalls ??= []
    const toolCalls = assistant.toolCalls
    const candidates = toolCalls.filter((tool) => tool.toolCallId === payload.toolCallId)
    const existing = payload.agentId
      ? candidates.find((tool) => tool.agentId === payload.agentId) ?? (candidates.length === 1 && !candidates[0]!.agentId ? candidates[0] : undefined)
      : candidates.length === 1 ? candidates[0] : undefined
    if (existing) return existing
    const tool: ToolCall = { toolCallId: payload.toolCallId, agentId: payload.agentId, toolName: '工具', status: 'running', timestamp: payload.timestamp ?? Date.now(), sequence }
    toolCalls.push(tool)
    // Return the reactive array entry so streamed updates also refresh the UI.
    return toolCalls[toolCalls.length - 1]!
  }

  function updateToolMetadata(tool: ToolCall, payload: AgentProgressMetadata & { toolName?: string | null; input?: unknown }) {
    if (payload.agentId) tool.agentId = payload.agentId
    if (payload.agentName) tool.agentName = payload.agentName
    if (payload.toolName) tool.toolName = payload.toolName
    if (payload.tooldesc) tool.tooldesc = payload.tooldesc
    if (payload.input !== undefined && payload.input !== null) tool.input = payload.input
  }

  function settleAgentProgress(assistant: ConversationMessage) {
    const status = assistant.status === 'failed' ? 'failed'
      : assistant.status === 'cancelled' ? 'cancelled'
        : assistant.status === 'awaiting-input' ? 'suspended' : 'interrupted'
    for (const tool of assistant.toolCalls ?? []) {
      if (tool.status === 'running') tool.status = status
    }
    for (const output of assistant.agentOutputs ?? []) {
      if (output.status === 'running') output.status = status === 'interrupted' ? 'completed' : status
    }
  }

  function mergeMessageDelta(current: string, incoming: string): string {
    if (!incoming || incoming === current) return current
    // Some stream producers send the full accumulated answer on every frame,
    // while others send only the newly generated fragment.
    if (!current) return incoming
    if (incoming.startsWith(current)) return incoming
    if (current.startsWith(incoming)) return current
    if (current.includes(incoming)) return current

    const maxOverlap = Math.min(current.length, incoming.length)
    for (let overlap = maxOverlap; overlap >= 3; overlap -= 1) {
      if (current.endsWith(incoming.slice(0, overlap))) return current + incoming.slice(overlap)
    }
    return current + incoming
  }

  async function loadConversations() {
    loading.value = true
    try {
      conversations.value = await conversationApi.list()
      if (!activeId.value && conversations.value[0]) await selectConversation(conversations.value[0].id)
    } finally { loading.value = false }
  }

  async function selectConversation(id: number) {
    const history = await conversationApi.messages(id)
    activeId.value = id
    messages.value = history
    workflowEvents.value = []
  }

  function createConversation() {
    // Keep a new conversation local until the user actually sends a message.
    activeId.value = null
    messages.value = []
    workflowEvents.value = []
  }

  function adoptConversation(id: number, title: string, userMessage?: ConversationMessage, assistant?: ConversationMessage) {
    if (activeId.value !== null || !Number.isFinite(id) || id <= 0) return
    activeId.value = id
    if (userMessage) userMessage.conversationId = id
    if (assistant) assistant.conversationId = id
    if (!conversations.value.some((conversation) => conversation.id === id)) {
      conversations.value.unshift({ id, title: title.trim().slice(0, 24) || '新的差旅咨询', status: 'ACTIVE', messageCount: 0, createTime: new Date().toISOString() })
    }
  }

  async function runAssistant(conversationId: number | null, content: string, assistant: ConversationMessage, userMessage?: ConversationMessage, stream = conversationApi.stream) {
    sending.value = true
    abortController.value = new AbortController()
    let awaitingInput = false
    let streamedConversationId = conversationId
    const seenEvents = new Set<string>()
    let lastOutput: AgentOutput | undefined
    try {
      for await (const event of stream(conversationId, content, abortController.value.signal)) {
        if (event.payload && 'eventId' in event.payload && typeof event.payload.eventId === 'string') {
          if (seenEvents.has(event.payload.eventId)) continue
          seenEvents.add(event.payload.eventId)
        }
        const eventConversationId = event.payload && 'conversationId' in event.payload && typeof event.payload.conversationId === 'number' ? event.payload.conversationId : undefined
        if (eventConversationId !== undefined && streamedConversationId === null) {
          streamedConversationId = eventConversationId
          adoptConversation(eventConversationId, content, userMessage, assistant)
        }
        if (event.type === 'tool_start') {
          lastOutput = undefined
          const tool = findOrCreateToolCall(assistant, event.payload, event.sequence)
          updateToolMetadata(tool, event.payload)
          if (event.payload.timestamp !== undefined) tool.timestamp = event.payload.timestamp
          tool.sequence = event.sequence
          // A late start frame must not undo an already received result.
          if (tool.status === 'running' || tool.status === 'suspended') tool.status = event.payload.status ?? 'running'
          for (const output of assistant.agentOutputs ?? []) {
            if ((tool.agentId ? output.agentId === tool.agentId : !output.agentId && output.agentName === tool.agentName) && output.status === 'running') output.status = 'completed'
          }
          continue
        }
        if (event.type === 'tool_result' || event.type === 'tool_error') {
          lastOutput = undefined
          const tool = findOrCreateToolCall(assistant, event.payload, event.sequence)
          updateToolMetadata(tool, event.payload)
          if (event.payload.output !== undefined && event.payload.output !== null) tool.result = event.payload.output
          else if (event.payload.toolResult !== undefined) tool.result = event.payload.toolResult
          tool.completedAt = event.payload.timestamp ?? Date.now()
          tool.status = event.type === 'tool_error' ? 'failed' : event.payload.status ?? 'completed'
          continue
        }
        if (event.type === 'thinking') {
          if (!event.payload.output) continue
          const payload = event.payload
          assistant.agentOutputs ??= []
          const outputs = assistant.agentOutputs
          if (lastOutput && lastOutput.agentId === payload.agentId && lastOutput.agentName === payload.agentName && lastOutput.messageId === payload.messageId) {
            // Hook output is incremental; repeated fragments and whitespace are meaningful.
            lastOutput.content += payload.output
            lastOutput.status = payload.status ?? 'running'
          } else {
            if (lastOutput?.status === 'running') lastOutput.status = 'completed'
            outputs.push({ id: payload.eventId ?? `thinking-${event.sequence}-${outputs.length}`, agentId: payload.agentId, agentName: payload.agentName, messageId: payload.messageId, content: payload.output, timestamp: payload.timestamp ?? Date.now(), sequence: event.sequence, status: payload.status ?? 'running' })
            lastOutput = outputs[outputs.length - 1]
          }
          continue
        }
        if (event.type === 'tool_success') {
          lastOutput = undefined
          const tool = findOrCreateToolCall(assistant, event.payload, event.sequence)
          updateToolMetadata(tool, event.payload)
          tool.status = 'success'
          tool.completedAt ??= event.payload.timestamp ?? Date.now()
          continue
        }
        if (event.type === 'ask') {
          assistant.ask = event.payload.delta
          assistant.askToolCallId = event.payload.toolCallId
          assistant.askStatus = 'pending'
          assistant.status = 'awaiting-input'
          awaitingInput = true
          break
        }
        if (event.type === 'workflow.update' || event.type === 'action.confirmation_required') workflowEvents.value.push(event)
        if (event.type === 'message.delta') {
          if (event.sequence <= (assistant.sequence ?? -1)) continue
          assistant.sequence = event.sequence
          assistant.content = mergeMessageDelta(assistant.content, event.payload.content)
        } else if (event.type === 'error') {
          assistant.status = 'failed'
          assistant.error = event.payload.message
        } else if (event.type === 'message.done' || event.type === 'done') {
          if (assistant.status !== 'failed' && (eventConversationId === undefined || eventConversationId === streamedConversationId)) assistant.status = 'completed'
        }
      }
      if (assistant.status === 'streaming') assistant.status = abortController.value?.signal.aborted ? 'cancelled' : 'completed'
    } catch (error) {
      if (awaitingInput) assistant.status = 'awaiting-input'
      else if (abortController.value?.signal.aborted) assistant.status = 'cancelled'
      else { assistant.status = 'failed'; assistant.error = error instanceof Error ? error.message : '流式响应失败' }
    } finally { settleAgentProgress(assistant); sending.value = false; abortController.value = null }
  }

  async function send(content: string) {
    if (!content.trim() || sending.value) return
    sending.value = true
    try {
      const conversationId = activeId.value
      const userMessage = await conversationApi.sendMessage(conversationId, content.trim())
      messages.value.push(userMessage)
      const assistant = reactive<ConversationMessage>({ id: Date.now() + 1, conversationId: conversationId ?? 0, role: 'assistant', content: '', status: 'streaming', sequence: -1 })
      messages.value.push(assistant)
      await runAssistant(conversationId, content.trim(), assistant, userMessage)
    } finally { sending.value = false }
  }

  function stop() { abortController.value?.abort() }

  async function answerAsk(message: ConversationMessage, answer: string) {
    if (sending.value || message.askStatus !== 'pending' || message.status !== 'awaiting-input') return
    if (!message.askToolCallId) throw new Error('缺少工具调用标识，无法恢复会话，请重新发起问题')
    const conversationId = message.conversationId > 0 ? message.conversationId : activeId.value
    if (conversationId === null || conversationId <= 0) throw new Error('缺少有效的会话号，无法恢复会话，请重新发起问题')
    message.askStatus = 'submitted'
    sending.value = true
    try {
      const userMessage = await conversationApi.sendMessage(conversationId, answer)
      messages.value.push(userMessage)
      const assistant = reactive<ConversationMessage>({ id: Date.now() + 1, conversationId, role: 'assistant', content: '', status: 'streaming', sequence: -1 })
      messages.value.push(assistant)
      await runAssistant(conversationId, answer, assistant, userMessage, (_conversationId, content, signal) => conversationApi.resume(conversationId, message.askToolCallId!, content, signal))
    } catch (error) {
      message.askStatus = 'pending'
      throw error
    } finally { sending.value = false }
  }

  async function retry(message: ConversationMessage) {
    if (sending.value) return
    const index = messages.value.findIndex((item) => item.id === message.id)
    const userMessage = index > 0 ? messages.value[index - 1] : undefined
    if (userMessage?.role === 'user') {
      messages.value.splice(index, 1)
      const conversationId = userMessage.conversationId > 0 ? userMessage.conversationId : null
      const assistant = reactive<ConversationMessage>({ id: Date.now(), conversationId: conversationId ?? 0, role: 'assistant', content: '', status: 'streaming', sequence: -1 })
      messages.value.push(assistant)
      await runAssistant(conversationId, userMessage.content, assistant, userMessage)
    }
  }

  return { conversations, activeId, activeConversation, messages, workflowEvents, loading, sending, loadConversations, selectConversation, createConversation, send, stop, answerAsk, retry }
})
