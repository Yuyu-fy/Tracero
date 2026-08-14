import type { currentRun } from './mock-data'

export type TraceroRun = typeof currentRun
export type UserRole = 'general' | 'dev' | 'test' | 'ops'
export type DeveloperTab = 'code' | 'parameters' | 'logs' | 'runtime'

export type AgentPushStatus = 'idle' | 'receiving' | 'reasoning' | 'done' | 'failed'

export type EvidencePackage = {
  event_id: string
  run_id: string
  event_type: string
  robot: string
  trigger_time: string
  received_at: string
  source: 'mock' | 'agent'
  topic_window_seconds: number
  trigger_rules: string[]
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
  conclusion: ReasoningConclusion
  latency: LatencyMetrics
}
