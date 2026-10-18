import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { conversationApi } from '@/api/conversationApi'
import type { Conversation, ConversationMessage, StreamEvent } from '@/types/conversation'

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([])
  const activeId = ref<number | null>(null)
  const messages = ref<ConversationMessage[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const abortController = ref<AbortController | null>(null)
  const workflowEvents = ref<StreamEvent[]>([])
  const activeConversation = computed(() => conversations.value.find((item) => item.id === activeId.value) ?? null)

  async function loadConversations() {
    loading.value = true
    try {
      conversations.value = await conversationApi.list()
      if (!activeId.value && conversations.value[0]) await selectConversation(conversations.value[0].id)
    } finally { loading.value = false }
  }

  async function selectConversation(id: number) {
    activeId.value = id
    messages.value = await conversationApi.messages(id)
  }

  async function createConversation() {
    const conversation = await conversationApi.create('新的差旅咨询')
    conversations.value.unshift(conversation)
    await selectConversation(conversation.id)
  }

  async function runAssistant(conversationId: number, content: string, assistant: ConversationMessage) {
    sending.value = true
    abortController.value = new AbortController()
    try {
      for await (const event of conversationApi.stream(conversationId, content, abortController.value.signal)) {
        if (event.type === 'workflow.update' || event.type === 'action.confirmation_required') workflowEvents.value.push(event)
        if (event.type === 'message.delta') {
          if (event.sequence <= (assistant.sequence ?? -1)) continue
          assistant.sequence = event.sequence
          assistant.content += event.payload.content
        } else if (event.type === 'error') {
          assistant.status = 'failed'
          assistant.error = event.payload.message
        } else if (event.type === 'message.done' || event.type === 'done') assistant.status = 'completed'
      }
      if (assistant.status === 'streaming') assistant.status = 'completed'
    } catch (error) {
      if (abortController.value?.signal.aborted) assistant.status = 'cancelled'
      else { assistant.status = 'failed'; assistant.error = error instanceof Error ? error.message : '流式响应失败' }
    } finally { sending.value = false; abortController.value = null }
  }

  async function send(content: string) {
    if (!content.trim() || sending.value) return
    if (!activeId.value) await createConversation()
    const conversationId = activeId.value as number
    const userMessage = await conversationApi.sendMessage(conversationId, content.trim())
    messages.value.push(userMessage)
    const assistant: ConversationMessage = { id: Date.now(), conversationId, role: 'assistant', content: '', status: 'streaming', sequence: -1 }
    messages.value.push(assistant)
    await runAssistant(conversationId, content.trim(), assistant)
  }

  function stop() { abortController.value?.abort() }

  async function retry(message: ConversationMessage) {
    const index = messages.value.findIndex((item) => item.id === message.id)
    const userMessage = index > 0 ? messages.value[index - 1] : undefined
    if (userMessage?.role === 'user') {
      messages.value.splice(index, 1)
      const assistant: ConversationMessage = { id: Date.now(), conversationId: userMessage.conversationId, role: 'assistant', content: '', status: 'streaming', sequence: -1 }
      messages.value.push(assistant)
      await runAssistant(userMessage.conversationId, userMessage.content, assistant)
    }
  }

  return { conversations, activeId, activeConversation, messages, workflowEvents, loading, sending, loadConversations, selectConversation, createConversation, send, stop, retry }
})
