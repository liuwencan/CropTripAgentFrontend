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
