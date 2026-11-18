export interface UserQuery {
  pageNo: number
  pageSize: number
  keyword?: string
  role?: string
}

export interface ConfigEntry {
  id: number
  configKey: string
  configValue: string
  configName?: string
  remark?: string
  updateTime?: string
  createTime?: string
}

export type ProviderApiKeyStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED'

export interface ProviderApiKey {
  id: number
  userId?: number
  providerCode: string
  status: ProviderApiKeyStatus | string
  remark?: string
  createTime?: string
  updateTime?: string
}

export interface PromptEntry {
  id: number
  promptKey: string
  promptName: string
  agentCapability?: string
  description?: string
  currentVersionId?: number
  status?: string
  updateTime?: string
}

export interface PromptVersion {
  id: number
  promptId: number
  versionNo: number
  promptContent: string
  contentHash?: string
  versionStatus?: string
  changeReason?: string
  current?: boolean
}

export interface PromptReleaseLog {
  id: number
  promptId: number
  operationType: string
  targetVersionId?: number
  previousVersionId?: number
  operationReason?: string
  operationResult?: string
  failureReason?: string
  createTime?: string
}

export interface PromptVersionCompare {
  promptId?: number
  leftVersionId?: number
  rightVersionId?: number
  leftPromptContent?: string
  rightPromptContent?: string
  contentChanged?: boolean
}

export type AgentTraceSpanType = 'AGENT' | 'MODEL' | 'TOOL' | 'SUMMARY' | string
export type AgentTraceStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SUSPENDED' | string

export interface AgentTraceSpan {
  id: number
  traceId: string
  spanId: string
  parentSpanId?: string | null
  sessionId?: number | null
  userId?: number | null
  agentId?: string | null
  agentName?: string | null
  spanType: AgentTraceSpanType
  operationName?: string | null
  status: AgentTraceStatus
  iteration?: number | null
  modelName?: string | null
  toolName?: string | null
  toolCallId?: string | null
  inputMessageCount?: number | null
  inputChars?: number | null
  outputChars?: number | null
  inputMessages?: unknown
  outputMessage?: unknown
  toolResult?: unknown
  inputTokens?: number | null
  outputTokens?: number | null
  startTime: string
  endTime?: string | null
  durationMs?: number | null
  errorSummary?: string | null
  attributes?: Record<string, unknown> | null
  createTime?: string
  updateTime?: string
}

export interface AgentTraceDetail {
  traceId: string
  totalDurationMs?: number | null
  totalInputTokens?: number | null
  totalOutputTokens?: number | null
  spans: AgentTraceSpan[]
}

export interface AgentTraceQuery {
  pageNo: number
  pageSize: number
  traceId?: string
  sessionId?: string
  userId?: string
  spanType?: AgentTraceSpanType | ''
  status?: AgentTraceStatus | ''
  startFrom?: string
  startTo?: string
}
