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

export type AssistantMessageStatus = 'loading' | 'streaming' | 'awaiting-input' | 'completed' | 'failed' | 'cancelled'

export type ToolCallStatus = 'running' | 'success'

export interface ToolCall {
  toolCallId: string
  agentName?: string
  toolName: string
  input?: unknown
  result?: unknown
  status: ToolCallStatus
}

export interface ConversationMessage extends Message {
  status?: AssistantMessageStatus
  sequence?: number
  blocks?: unknown[]
  error?: string
  toolCalls?: ToolCall[]
  ask?: AskUserPrompt
  askToolCallId?: string
  askStatus?: 'pending' | 'submitted'
}

export type AskUserUiType = 'text' | 'select' | 'multi_select' | 'confirm' | 'form' | 'date' | 'number'

export interface AskUserField {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea'
  placeholder?: string
  required?: boolean
  options?: string[]
  min?: number
  max?: number
  step?: number
}

export interface AskUserPrompt {
  question: string
  ui_type?: AskUserUiType | string
  options?: string[]
  fields?: AskUserField[]
  default_value?: unknown
  allow_other?: boolean
}

export interface AskUserEventPayload {
  conversationId?: number
  toolCallId?: string
  delta: AskUserPrompt
}

export interface ToolStartEventPayload {
  toolCallId: string
  agentName?: string
  toolName: string
  input?: unknown
}

export interface ToolResultEventPayload {
  conversationId?: number
  toolCallId: string
  toolResult?: unknown
}

export interface ToolSuccessEventPayload {
  conversationId?: number
  toolCallId: string
  phase?: string
  state?: string
}

export interface ConversationCompletePayload {
  conversationId?: number
  [key: string]: unknown
}

export type StreamEvent =
  | { version: number; type: 'message.delta'; sequence: number; messageId?: number; payload: { content: string } }
  | { version: number; type: 'ask'; sequence: number; messageId?: number; payload: AskUserEventPayload }
  | { version: number; type: 'tool_start'; sequence: number; messageId?: number; payload: ToolStartEventPayload }
  | { version: number; type: 'tool_result'; sequence: number; messageId?: number; payload: ToolResultEventPayload }
  | { version: number; type: 'tool_success'; sequence: number; messageId?: number; payload: ToolSuccessEventPayload }
  | { version: number; type: 'message.done'; sequence: number; messageId?: number; payload?: ConversationCompletePayload }
  | { version: number; type: 'workflow.update'; sequence: number; messageId?: number; payload: Record<string, unknown> }
  | { version: number; type: 'action.confirmation_required'; sequence: number; messageId?: number; payload: Record<string, unknown> }
  | { version: number; type: 'error'; sequence: number; messageId?: number; payload: { message: string } }
  | { version: number; type: 'done'; sequence: number; messageId?: number; payload?: ConversationCompletePayload }
