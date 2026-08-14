import type { mockCurrentRun } from './mock-data'

export type EventTriggerSource = 'automatic' | 'user_question'
export type DataProviderType = 'demo' | 'robot' | 'direct' | 'legacy'
export type ReasoningErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'EVIDENCE_NOT_FOUND'
  | 'MODEL_REQUEST_FAILED'
  | 'OUTPUT_VERIFICATION_FAILED'
  | 'DATABASE_WRITE_FAILED'

export type TraceroRun = Omit<typeof mockCurrentRun, 'conclusion'> & {
  conclusion: ReasoningConclusion | null
  trigger_source?: EventTriggerSource
  user_question?: string
  context_window_seconds?: number
  provider_type?: DataProviderType
  data_source?: DataProviderType
  occurred_at?: string
  verified?: boolean
  error_code?: ReasoningErrorCode | null
  errors?: string[]
  valid_evidence_ids?: string[]
}
export type UserRole = 'general' | 'dev' | 'test' | 'ops'
export type DeveloperTab = 'code' | 'parameters' | 'logs' | 'runtime'

export type AgentPushStatus =
  | 'idle'
  | 'receiving'
  | 'reasoning'
  | 'done'
  | 'failed'

export type EvidencePackage = {
  event_id: string
  run_id: string
  event_type: string
  robot: string
  trigger_time: string
  received_at: string
  source: 'mock' | 'agent' | 'user_question' | DataProviderType
  topic_window_seconds: number
  trigger_rules: string[]
}

export type QuestionReasoningRequest = {
  question: string
  robot: string
  occurred_at: string
  context_window_seconds: number
}

export type ReasoningConclusion = {
  fact: string
  reasoning: string
  suggestion: string
}

export type LatencyMetrics = {
  agent_push_ms: number
  backend_reasoning_ms: number
  frontend_render_ms: number
  total_ms: number
  measured_at: string
}

export type SimulatedAgentPushResult = {
  evidencePackage: EvidencePackage
  run: TraceroRun
  conclusion: ReasoningConclusion | null
  latency: LatencyMetrics
}

export type ChatApiMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatApiRequest = {
  run_id: string
  message: string
  history: ChatApiMessage[]
  context: {
    perspective: 'general'
    event_type: string
    robot: string
  }
}

export type ChatApiResponse = {
  content: string
}
