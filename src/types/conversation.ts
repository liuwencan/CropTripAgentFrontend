export interface Conversation {
  id: number
  title: string
  status: string
  messageCount: number
  createTime?: string
  updateTime?: string
}

export interface Message {
  id: number
  conversationId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  modelName?: string
  createTime?: string
  feedback?: string
  feedbackAt?: string
}

export type AssistantMessageStatus = 'loading' | 'streaming' | 'completed' | 'failed' | 'cancelled'

export interface ConversationMessage extends Message {
  status?: AssistantMessageStatus
  sequence?: number
  blocks?: unknown[]
  error?: string
}

export type StreamEvent =
  | { version: number; type: 'message.delta'; sequence: number; messageId?: number; payload: { content: string } }
  | { version: number; type: 'message.done'; sequence: number; messageId?: number; payload?: Record<string, unknown> }
  | { version: number; type: 'workflow.update'; sequence: number; messageId?: number; payload: Record<string, unknown> }
  | { version: number; type: 'action.confirmation_required'; sequence: number; messageId?: number; payload: Record<string, unknown> }
  | { version: number; type: 'error'; sequence: number; messageId?: number; payload: { message: string } }
  | { version: number; type: 'done'; sequence: number; messageId?: number; payload?: Record<string, unknown> }
