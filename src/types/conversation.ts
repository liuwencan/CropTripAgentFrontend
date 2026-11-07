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

// completed describes execution finishing, not business success.
export type ProgressStatus = 'running' | 'completed' | 'suspended' | 'failed' | 'cancelled' | 'interrupted'
export type ToolCallStatus = ProgressStatus | 'success'

export interface AgentProgressMetadata {
  conversationId?: number
  eventId?: string | null
  eventType?: string
  agentId?: string | null
  agentName?: string | null
  tooldesc?: string | null
  timestamp?: number
  status?: ProgressStatus
}

export interface ToolCall {
  toolCallId: string
  agentId?: string | null
  agentName?: string | null
  toolName: string
  tooldesc?: string | null
  input?: unknown
  result?: unknown
  status: ToolCallStatus
  timestamp?: number
  completedAt?: number
  sequence?: number
}

export interface AgentOutput {
  id: string
  agentId?: string | null
  agentName?: string | null
  messageId?: string | null
  content: string
  timestamp: number
  sequence: number
  status: ProgressStatus
}

export type PlanTaskState = 'done' | 'in_progress' | 'todo'

export interface PlanTask {
  idx: number
  name: string
  state: PlanTaskState | string
}

export interface AgentPlan {
  agentName: string
  planName: string
  tasks: PlanTask[]
}

export interface ConversationMessage extends Message {
  status?: AssistantMessageStatus
  sequence?: number
  blocks?: unknown[]
  error?: string
  toolCalls?: ToolCall[]
  agentOutputs?: AgentOutput[]
  plans?: AgentPlan[]
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

export interface ToolStartEventPayload extends AgentProgressMetadata {
  toolCallId: string
  toolName: string
  input?: unknown
  output?: string | null
  messageId?: string | null
}

export interface ToolResultEventPayload extends AgentProgressMetadata {
  toolCallId: string
  toolName?: string | null
  input?: unknown
  output?: string | null
  messageId?: string | null
  /** Compatibility with the previous SSE contract. */
  toolResult?: unknown
}

export interface ThinkingEventPayload extends AgentProgressMetadata {
  output: string
  messageId?: string | null
  toolCallId?: null
  toolName?: null
  input?: null
}

export interface ToolSuccessEventPayload extends AgentProgressMetadata {
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
  | { version: number; type: 'tool_error'; sequence: number; messageId?: number; payload: ToolResultEventPayload }
  | { version: number; type: 'thinking'; sequence: number; messageId?: number; payload: ThinkingEventPayload }
  | { version: number; type: 'tool_success'; sequence: number; messageId?: number; payload: ToolSuccessEventPayload }
  | { version: number; type: 'plan_update'; sequence: number; messageId?: number; payload: AgentPlan }
  | { version: number; type: 'message.done'; sequence: number; messageId?: number; payload?: ConversationCompletePayload }
  | { version: number; type: 'workflow.update'; sequence: number; messageId?: number; payload: Record<string, unknown> }
  | { version: number; type: 'action.confirmation_required'; sequence: number; messageId?: number; payload: Record<string, unknown> }
  | { version: number; type: 'error'; sequence: number; messageId?: number; payload: { message: string } }
  | { version: number; type: 'done'; sequence: number; messageId?: number; payload?: ConversationCompletePayload }
