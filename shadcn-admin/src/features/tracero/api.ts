import { currentRun } from './mock-data'
import type {
  EvidencePackage,
  LatencyMetrics,
  SimulatedAgentPushResult,
  TraceroRun,
} from './types'

const MOCK_AGENT_PUSH_MS = 180
const MOCK_BACKEND_REASONING_MS = 760

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function buildEvidencePackage(run: TraceroRun): EvidencePackage {
  return {
    event_id: 'tc-01-obstacle-injection',
    run_id: run.run_id,
    event_type: run.event_type,
    robot: run.robot,
    trigger_time: run.trigger_time,
    received_at: new Date().toISOString(),
    source: 'mock',
    topic_window_seconds: 5,
    trigger_rules: ['急停检测', '规划失败检测'],
  }
}

function buildLatencyMetrics(startedAt: number): LatencyMetrics {
  const frontend_render_ms = Math.round(performance.now() - startedAt)
  const total_ms =
    MOCK_AGENT_PUSH_MS + MOCK_BACKEND_REASONING_MS + frontend_render_ms

  return {
    agent_push_ms: MOCK_AGENT_PUSH_MS,
    backend_reasoning_ms: MOCK_BACKEND_REASONING_MS,
    frontend_render_ms,
    total_ms,
    measured_at: new Date().toISOString(),
  }
}

export async function getCurrentRun(): Promise<TraceroRun> {
  await wait(120)
  return currentRun
}

export async function simulateTc01AgentPush(): Promise<SimulatedAgentPushResult> {
  const startedAt = performance.now()

  await wait(MOCK_AGENT_PUSH_MS)
  const evidencePackage = buildEvidencePackage(currentRun)

  await wait(MOCK_BACKEND_REASONING_MS)

  return {
    evidencePackage,
    run: currentRun,
    conclusion: currentRun.conclusion,
    latency: buildLatencyMetrics(startedAt),
  }
}
