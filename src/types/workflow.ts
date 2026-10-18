export type WorkflowStatus = 'loading' | 'success' | 'partial' | 'failure' | 'cancelled'

export interface PolicyCheck {
  id: string
  title: string
  compliant: boolean
  explanation: string
  status: WorkflowStatus
}

export interface ItineraryOption {
  id: string
  route: string
  departAt: string
  arriveAt: string
  duration: string
  detail: string
  price?: string
  recommended?: boolean
  policyStatus?: 'passed' | 'failed' | 'unknown'
}

export interface ConfirmationAction {
  id: string
  workflowId: string
  title: string
  summary: string
  status: 'pending' | 'processing' | 'confirmed' | 'cancelled' | 'failed'
  idempotencyKey?: string
}

export interface WorkflowBlock {
  workflowId: string
  status: WorkflowStatus
  sources?: Array<{ id: string; name: string; status: WorkflowStatus; error?: string }>
  policy?: PolicyCheck
  options?: ItineraryOption[]
  action?: ConfirmationAction
  message?: string
}
