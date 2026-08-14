import { mockCurrentRun, type EvidenceType, type TimelineLevel } from './mock-data'
import type {
  ChatApiRequest,
  ChatApiResponse,
  EvidencePackage,
  LatencyMetrics,
  QuestionReasoningRequest,
  ReasoningConclusion,
  ReasoningErrorCode,
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
  reasoning: import.meta.env.VITE_TRACERO_REASONING_PATH ?? '/api/debug/reason',
  questionReasoning:
    import.meta.env.VITE_TRACERO_QUESTION_REASONING_PATH ??
    '/tracero/reasoning/question',
  chat: import.meta.env.VITE_TRACERO_CHAT_PATH ?? '/tracero/chat',
  runs: import.meta.env.VITE_TRACERO_RUNS_PATH ?? '/api/runs',
}

type BackendEvidence = {
  evidence_id: string
  type: string
  topic?: string
  timestamp?: number
  name?: string
  value?: unknown
  file?: string
  line?: number
  snippet?: string
  source?: string
  data?: unknown
}

type BackendRunResponse = {
  run_id: string
  event_type?: string
  evidence_type?: string
  trigger_time?: number
  robot_id?: string
  status: 'received' | 'reasoning' | 'done' | 'failed' | 'completed' | 'verification_failed'
  progress?: string
  verified: boolean
  evidence?: BackendEvidence[]
  output?: string
  errors: string[]
  valid_evidence_ids: string[]
  created_at: string
}

type RunsApiResponse = {
  runs: Array<Pick<BackendRunResponse, 'run_id' | 'created_at'>>
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

class TraceroApiError extends Error {
  constructor(
    message: string,
    readonly errorCode?: ReasoningErrorCode
  ) {
    super(message)
    this.name = 'TraceroApiError'
  }
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
    const payload: unknown = await response.json().catch(() => null)
    const detail =
      payload &&
      typeof payload === 'object' &&
      'detail' in payload &&
      typeof payload.detail === 'object' &&
      payload.detail
        ? (payload.detail as { error_code?: ReasoningErrorCode; message?: string })
        : undefined
    throw new TraceroApiError(
      detail?.error_code
        ? `${detail.error_code}: ${detail.message ?? 'Tracero API 请求失败'}`
        : (detail?.message ?? `Tracero API 请求失败 (${response.status})`),
      detail?.error_code
    )
  }

  return response.json() as Promise<T>
}

function unwrap<T>(payload: T | { data: T }): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as { data?: T }).data
  ) {
    return (payload as { data: T }).data
  }
  return payload as T
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

function toEvidenceType(type: string): EvidenceType {
  return ['log', 'code', 'metric', 'config'].includes(type)
    ? (type as EvidenceType)
    : 'log'
}

function toTimelineLevel(status: BackendRunResponse['status']): TimelineLevel {
  return status === 'done' || status === 'completed' ? 'success' : 'critical'
}

function formatEvidence(item: BackendEvidence) {
  if (item.type === 'source_code') return item.snippet || '未提供源码片段'
  if (item.type === 'parameter') return `${item.name}: ${JSON.stringify(item.value)}`
  return JSON.stringify(item.data ?? item, null, 0)
}

function evidenceTitle(item: BackendEvidence) {
  const names: Record<string, string> = {
    runtime: '运行时数据',
    parameter: '参数配置',
    source_code: '源码位置',
    message_mapping: '消息映射',
  }
  return item.topic ?? item.name ?? names[item.type] ?? item.type
}

function parseConclusion(output?: string): ReasoningConclusion | null {
  if (!output) return null

  const sections = {
    fact: '【事实】',
    reasoning: '【推理】',
    suggestion: '【建议】',
  } as const
  const conclusion = Object.fromEntries(
    Object.entries(sections).map(([key, heading]) => [
      key,
      output
        .split('\n')
        .find((line) => line.trim().startsWith(heading))
        ?.trim()
        .replace(heading, '')
        .trim() ?? '',
    ])
  ) as ReasoningConclusion

  return conclusion.fact || conclusion.reasoning || conclusion.suggestion
    ? conclusion
    : null
}

function toTraceroRun(response: BackendRunResponse): TraceroRun {
  const triggerTime = response.trigger_time
    ? new Date(response.trigger_time * 1000).toISOString()
    : response.created_at
  const evidence = (response.evidence ?? []).map((item) => ({
    evidence_id: item.evidence_id,
    type: toEvidenceType(item.type),
    title: evidenceTitle(item),
    source:
      item.source ??
      (item.file ? `${item.file}:${item.line ?? '?'}` : 'Tracero Backend'),
    excerpt: formatEvidence(item),
    impact: `采集时间：${formatTime(
      item.timestamp ? new Date(item.timestamp * 1000).toISOString() : triggerTime
    )}`,
  }))

  return {
    ...mockCurrentRun,
    run_id: response.run_id,
    event_type: response.event_type ?? response.evidence_type ?? mockCurrentRun.event_type,
    trigger_time: formatTime(triggerTime),
    status:
      response.status === 'received' || response.status === 'reasoning'
        ? 'reasoning'
        : response.verified
          ? 'done'
          : 'failed',
    robot: response.robot_id ?? mockCurrentRun.robot,
    trigger_source: 'automatic',
    occurred_at: triggerTime,
    verified: response.verified,
    errors: response.errors,
    valid_evidence_ids: response.valid_evidence_ids,
    conclusion: parseConclusion(response.output),
    evidence,
    timeline:
      evidence.length > 0
        ? evidence.map((item) => ({
            time: item.impact.replace('采集时间：', ''),
            title: item.title,
            description: item.excerpt,
            level: toTimelineLevel(response.status),
          }))
        : [
            {
              time: formatTime(triggerTime),
              title: '未返回可展示证据',
              description: response.errors.join('；') || '本次推理未产生证据。',
              level: toTimelineLevel(response.status),
            },
          ],
  }
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

  const run = await requestJson<BackendRunResponse>(
    `${endpoints.runs}/${encodeURIComponent(latestRun.run_id)}`
  )
  return toTraceroRun(run)
}

export async function simulateTc01AgentPush(): Promise<SimulatedAgentPushResult> {
  const startedAt = performance.now()
  if (!USE_MOCK) {
    const reasoningRequest = {
      evidence_type: 'navigation_failed',
      evidence: mockCurrentRun.evidence.map((item) => ({
        evidence_id: item.evidence_id,
        type: item.type,
        content: [item.title, item.source, item.excerpt, item.impact].join(
          '；'
        ),
      })),
    }
    const created = await requestJson<BackendRunResponse>(
      endpoints.reasoning,
      {
        method: 'POST',
        body: JSON.stringify(reasoningRequest),
      }
    )

    const response = await requestJson<BackendRunResponse>(
      `${endpoints.runs}/${encodeURIComponent(created.run_id)}`
    )
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
    const payload = await requestJson<
      SimulatedAgentPushResult | { data: SimulatedAgentPushResult }
    >(endpoints.questionReasoning, {
      method: 'POST',
      body: JSON.stringify({ trigger: 'user_question', ...request }),
    })
    return unwrap(payload)
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

  const payload = await requestJson<
    | ChatApiResponse
    | { data: ChatApiResponse }
    | { answer: string }
    | { reply: string }
  >(endpoints.chat, {
    method: 'POST',
    body: JSON.stringify(request),
  })
  const result = unwrap(payload as ChatApiResponse | { data: ChatApiResponse })
  const content =
    result.content ??
    (result as ChatApiResponse & { answer?: string }).answer ??
    (result as ChatApiResponse & { reply?: string }).reply

  if (!content) throw new Error('AI Chat 接口未返回 content、answer 或 reply')
  return { content }
}
