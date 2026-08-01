import { mockCurrentRun } from './mock-data'
import type {
  ChatApiRequest,
  ChatApiResponse,
  EvidencePackage,
  LatencyMetrics,
  QuestionReasoningRequest,
  ReasoningConclusion,
  SimulatedAgentPushResult,
  TraceroRun,
} from './types'

const MOCK_AGENT_PUSH_MS = 180
const MOCK_BACKEND_REASONING_MS = 760
const API_BASE_URL = (import.meta.env.VITE_TRACERO_API_BASE_URL ?? '').replace(
  /\/$/,
  ''
)
const USE_MOCK = import.meta.env.VITE_TRACERO_USE_MOCK !== 'false'

const endpoints = {
  reasoning: import.meta.env.VITE_TRACERO_REASONING_PATH ?? '/api/reason',
  runs: import.meta.env.VITE_TRACERO_RUNS_PATH ?? '/api/runs',
}

type ReasonTriggerApiRequest = {
  trigger_type: 'navigation_failed' | 'user_question' | 'follow_up_question'
  robot: string
  occurred_at: string
  context_window_seconds: number
  question?: string
  run_id?: string
  history?: ChatApiRequest['history']
  context?: ChatApiRequest['context']
}

type ReasoningApiResponse = {
  run_id: string
  trigger_type: string
  event_type: string
  evidence_type: string
  provider_type: 'demo' | 'robot' | 'direct' | 'legacy'
  data_source: 'demo' | 'robot' | 'direct' | 'legacy'
  robot: string
  occurred_at: string
  context_window_seconds?: number | null
  question?: string | null
  output?: string
  status: 'completed' | 'verification_failed'
  verified: boolean
  conclusion: ReasoningConclusion | null
  evidence?: Array<{
    evidence_id: string
    type: string
    content: string
    occurred_at: string
  }>
  errors: string[]
  error_code:
    | 'PROVIDER_UNAVAILABLE'
    | 'EVIDENCE_NOT_FOUND'
    | 'MODEL_REQUEST_FAILED'
    | 'OUTPUT_VERIFICATION_FAILED'
    | 'DATABASE_WRITE_FAILED'
    | null
  valid_evidence_ids: string[]
  created_at: string
}

type RunsApiResponse = {
  runs: Array<Pick<ReasoningApiResponse, 'run_id' | 'created_at'>>
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function buildQuestionRun(request: QuestionReasoningRequest): TraceroRun {
  const occurredAt = formatTime(request.occurred_at)
  const runId = `run_question_${Date.now()}`
  const windowMinutes = Math.round(request.context_window_seconds / 60)

  return {
    ...mockCurrentRun,
    run_id: runId,
    event_type: '用户提问事件',
    trigger_time: occurredAt,
    status: 'done',
    robot: request.robot,
    trigger_source: 'user_question',
    user_question: request.question,
    context_window_seconds: request.context_window_seconds,
    conclusion: {
      fact: `${request.robot} 在用户标记时刻前后出现连续横摆，横向角速度在约 18 秒内多次反向变化；当时尚未触发碰撞或导航失败告警。`,
      reasoning:
        '回溯运动遥测发现，局部路径在狭窄区域内频繁重规划，左右两侧障碍物代价接近，导致控制器在候选路径之间反复切换，形成可被用户观察到的左右摇摆。该行为是故障发生前的早期异常信号。',
      suggestion:
        '建议将本次提问保留为观察事件，继续跟踪后续 5 分钟轨迹；同时检查路径切换抑制参数、定位抖动和左右障碍物距离。当横摆幅度或频率超过阈值时，提前降速并自动升级为预警事件。',
    },
    timeline: [
      {
        time: occurredAt,
        title: '用户标记异常行为',
        description: `用户提问：“${request.question}”`,
        level: 'info',
      },
      {
        time: `前 ${windowMinutes} 分钟`,
        title: '回溯上下文数据',
        description: `加载 ${request.robot} 的定位、角速度、路径规划与障碍物距离数据。`,
        level: 'info',
      },
      {
        time: 'T-18s',
        title: '横向角速度开始反复变化',
        description:
          'yaw_rate 连续多次正负切换，左右摆动明显，但未达到故障告警阈值。',
        level: 'warning',
      },
      {
        time: 'T-11s',
        title: '局部路径频繁切换',
        description: '左右候选路径代价接近，控制器连续重选路径并修正方向。',
        level: 'critical',
      },
      {
        time: 'T+0s',
        title: '生成观察事件',
        description: '系统依据用户提问创建事件并完成初步原因分析，供后续追踪。',
        level: 'success',
      },
    ],
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function endpoint(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const responseText = await response.text()
    let detail = responseText
    try {
      const errorPayload = JSON.parse(responseText) as {
        detail?: string | { error_code?: string; message?: string }
      }
      if (typeof errorPayload.detail === 'string') {
        detail = errorPayload.detail
      } else if (errorPayload.detail) {
        detail = [errorPayload.detail.error_code, errorPayload.detail.message]
          .filter(Boolean)
          .join('：')
      }
    } catch {
      // 非 JSON 响应（例如临时隧道的 503 页面）直接保留原文。
    }
    throw new Error(detail || `Tracero API 请求失败 (${response.status})`)
  }

  return response.json() as Promise<T>
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
  return {
    agent_push_ms: MOCK_AGENT_PUSH_MS,
    backend_reasoning_ms: MOCK_BACKEND_REASONING_MS,
    frontend_render_ms,
    total_ms:
      MOCK_AGENT_PUSH_MS + MOCK_BACKEND_REASONING_MS + frontend_render_ms,
    measured_at: new Date().toISOString(),
  }
}

function buildLiveLatencyMetrics(startedAt: number): LatencyMetrics {
  const total_ms = Math.round(performance.now() - startedAt)
  return {
    agent_push_ms: 0,
    backend_reasoning_ms: total_ms,
    frontend_render_ms: 0,
    total_ms,
    measured_at: new Date().toISOString(),
  }
}

function toTraceroRun(response: ReasoningApiResponse): TraceroRun {
  if (!response.conclusion) {
    throw new Error(
      `${response.error_code ?? 'OUTPUT_VERIFICATION_FAILED'}：后端未返回结构化结论`
    )
  }
  return {
    ...mockCurrentRun,
    run_id: response.run_id,
    event_type: response.event_type,
    trigger_time: formatTime(response.occurred_at || response.created_at),
    status: response.verified ? 'done' : 'failed',
    robot: response.robot,
    trigger_source:
      response.trigger_type === 'user_question' ? 'user_question' : 'automatic',
    user_question: response.question ?? undefined,
    context_window_seconds: response.context_window_seconds ?? undefined,
    data_source: response.data_source,
    conclusion: response.conclusion,
  }
}

function requireVerifiedResponse(
  response: ReasoningApiResponse
): ReasoningApiResponse & { conclusion: ReasoningConclusion } {
  if (!response.verified || !response.conclusion) {
    const detail = response.errors.join('；') || '后端推理结果校验失败'
    throw new Error(
      response.error_code ? `${response.error_code}：${detail}` : detail
    )
  }
  return response as ReasoningApiResponse & { conclusion: ReasoningConclusion }
}

export async function getCurrentRun(): Promise<TraceroRun> {
  if (USE_MOCK) {
    await wait(120)
    return mockCurrentRun
  }

  const { runs } = await requestJson<RunsApiResponse>(endpoints.runs)
  const latestRun = runs[0]
  if (!latestRun) {
    throw new Error('后端暂无推理记录，请先运行 TC-01')
  }

  const run = await requestJson<ReasoningApiResponse>(
    `${endpoints.runs}/${encodeURIComponent(latestRun.run_id)}`
  )
  return toTraceroRun(run)
}

export async function simulateTc01AgentPush(): Promise<SimulatedAgentPushResult> {
  const startedAt = performance.now()
  if (!USE_MOCK) {
    const reasoningRequest: ReasonTriggerApiRequest = {
      trigger_type: 'navigation_failed',
      robot: mockCurrentRun.robot,
      occurred_at: new Date().toISOString(),
      context_window_seconds: 5,
    }
    const response = await requestJson<ReasoningApiResponse>(
      endpoints.reasoning,
      {
        method: 'POST',
        body: JSON.stringify(reasoningRequest),
      }
    )

    requireVerifiedResponse(response)

    const run = toTraceroRun(response)
    return {
      evidencePackage: {
        ...buildEvidencePackage(run),
        run_id: response.run_id,
        received_at: response.created_at,
        source: 'agent',
      },
      run,
      conclusion: run.conclusion,
      latency: buildLiveLatencyMetrics(startedAt),
    }
  }

  await wait(MOCK_AGENT_PUSH_MS)
  const evidencePackage = buildEvidencePackage(mockCurrentRun)
  await wait(MOCK_BACKEND_REASONING_MS)

  return {
    evidencePackage,
    run: mockCurrentRun,
    conclusion: mockCurrentRun.conclusion,
    latency: buildLatencyMetrics(startedAt),
  }
}

export async function startQuestionReasoning(
  request: QuestionReasoningRequest
): Promise<SimulatedAgentPushResult> {
  if (!USE_MOCK) {
    const startedAt = performance.now()
    const reasoningRequest: ReasonTriggerApiRequest = {
      trigger_type: 'user_question',
      ...request,
    }
    const response = requireVerifiedResponse(
      await requestJson<ReasoningApiResponse>(endpoints.reasoning, {
        method: 'POST',
        body: JSON.stringify(reasoningRequest),
      })
    )
    const conclusion = response.conclusion
    const run: TraceroRun = {
      ...buildQuestionRun(request),
      run_id: response.run_id,
      event_type: response.event_type,
      trigger_time: formatTime(response.occurred_at),
      status: 'done',
      robot: response.robot,
      data_source: response.data_source,
      conclusion,
    }

    return {
      evidencePackage: {
        event_id: `question-${response.run_id}`,
        run_id: response.run_id,
        event_type: run.event_type,
        robot: request.robot,
        trigger_time: run.trigger_time,
        received_at: response.created_at,
        source: 'user_question',
        topic_window_seconds: request.context_window_seconds,
        trigger_rules: ['用户主动提问', '行为时间窗回溯'],
      },
      run,
      conclusion,
      latency: buildLiveLatencyMetrics(startedAt),
    }
  }

  const startedAt = performance.now()
  await wait(MOCK_AGENT_PUSH_MS)
  const run = buildQuestionRun(request)
  const evidencePackage: EvidencePackage = {
    event_id: `question-${Date.now()}`,
    run_id: run.run_id,
    event_type: run.event_type,
    robot: run.robot,
    trigger_time: run.trigger_time,
    received_at: new Date().toISOString(),
    source: 'user_question',
    topic_window_seconds: request.context_window_seconds,
    trigger_rules: ['用户主动提问', '行为时间窗回溯'],
  }
  await wait(MOCK_BACKEND_REASONING_MS)

  return {
    evidencePackage,
    run,
    conclusion: run.conclusion,
    latency: buildLatencyMetrics(startedAt),
  }
}

export async function sendChatMessage(
  request: ChatApiRequest
): Promise<ChatApiResponse> {
  if (USE_MOCK) {
    await wait(500)
    return {
      content: `已收到关于“${request.message}”的追问。我会结合当前推理过程与结论继续分析；接入后端后，此处将直接展示模型返回内容。`,
    }
  }

  const response = requireVerifiedResponse(
    await requestJson<ReasoningApiResponse>(endpoints.reasoning, {
      method: 'POST',
      body: JSON.stringify({
        trigger_type: 'follow_up_question',
        robot: request.context.robot,
        occurred_at: new Date().toISOString(),
        context_window_seconds: 300,
        question: request.message,
        run_id: request.run_id,
        history: request.history,
        context: request.context,
      } satisfies ReasonTriggerApiRequest),
    })
  )

  return {
    content: [
      `事实：${response.conclusion.fact}`,
      `推理：${response.conclusion.reasoning}`,
      `建议：${response.conclusion.suggestion}`,
    ].join('\n'),
  }
}
