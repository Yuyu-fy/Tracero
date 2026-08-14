import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getCurrentRun,
  simulateTc01AgentPush,
  startQuestionReasoning,
} from '@/features/tracero/api'
import {
  questionHistoryRecord,
  questionHistoryRunId,
  useEventHistoryStore,
} from '@/features/tracero/event-history-store'
import { mockCurrentRun } from '@/features/tracero/mock-data'
import type {
  AgentPushStatus,
  DeveloperTab,
  EvidencePackage,
  LatencyMetrics,
  QuestionReasoningRequest,
  TraceroRun,
  UserRole,
} from '@/features/tracero/types'
import { TraceroContext } from './tracero-context'

type TraceroProviderProps = {
  children: ReactNode
  initialRole?: UserRole
  initialLocationId?: string
  initialDeveloperTab?: DeveloperTab
  initialQuestionRequest?: QuestionReasoningRequest
}

export function TraceroProvider({
  children,
  initialRole = 'general',
  initialLocationId,
  initialDeveloperTab = 'code',
  initialQuestionRequest,
}: TraceroProviderProps) {
  const [role, setRole] = useState<UserRole>(initialRole)
  const [selectedLocationId, setSelectedLocationId] = useState<
    string | undefined
  >(initialLocationId)
  const [developerTab, setDeveloperTab] =
    useState<DeveloperTab>(initialDeveloperTab)
  const [currentRun, setCurrentRun] = useState<TraceroRun | null>(
    mockCurrentRun
  )
  const [evidencePackage, setEvidencePackage] =
    useState<EvidencePackage | null>(null)
  const [pushStatus, setPushStatus] = useState<AgentPushStatus>('idle')
  const [latency, setLatency] = useState<LatencyMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const loadCurrentRun = useCallback(async () => {
    setError(null)
    try {
      const run = await getCurrentRun()
      setCurrentRun(run)
      setPushStatus(run.status === 'done' ? 'done' : 'failed')
      if (run.status === 'failed') {
        setError(run.errors?.join('；') || '本次推理结论未通过校验')
      }
      useEventHistoryStore.getState().upsertRun(run)
    } catch (error) {
      setError(error instanceof Error ? error.message : '当前推理事件加载失败')
      setPushStatus('failed')
    }
  }, [])

  useEffect(() => {
    if (!initialQuestionRequest) {
      // Initial remote synchronization is intentionally owned by this provider.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadCurrentRun()
      return
    }

    let active = true
    const reasonFromQuestion = async () => {
      const historyStore = useEventHistoryStore.getState()
      const pendingRunId = questionHistoryRunId(initialQuestionRequest)
      historyStore.upsertRecord(questionHistoryRecord(initialQuestionRequest))
      setIsSimulating(true)
      setError(null)
      setLatency(null)
      setPushStatus('receiving')

      try {
        setPushStatus('reasoning')
        const result = await startQuestionReasoning(initialQuestionRequest)
        if (!active) return
        setEvidencePackage(result.evidencePackage)
        setCurrentRun(result.run)
        setLatency(result.latency)
        setPushStatus(result.run.status === 'done' ? 'done' : 'failed')
        if (result.run.status === 'failed') {
          setError(
            result.run.errors?.join('；') || '本次推理结论未通过校验'
          )
        }
        useEventHistoryStore.getState().upsertRun(result.run, {
          eventTimeIso: initialQuestionRequest.occurred_at,
          previousRunId: pendingRunId,
          summary: initialQuestionRequest.question,
        })
      } catch (error) {
        if (!active) return
        useEventHistoryStore.getState().upsertRecord({
          ...questionHistoryRecord(initialQuestionRequest),
          status: 'failed',
        })
        setError(
          error instanceof Error
            ? error.message
            : '用户提问事件推理失败，请稍后重试'
        )
        setPushStatus('failed')
      } finally {
        if (active) setIsSimulating(false)
      }
    }

    void reasonFromQuestion()
    return () => {
      active = false
    }
  }, [initialQuestionRequest, loadCurrentRun])

  const simulateTc01Push = useCallback(async () => {
    if (isSimulating) return

    setIsSimulating(true)
    setError(null)
    setLatency(null)
    setPushStatus('receiving')

    try {
      setPushStatus('reasoning')
      const result = await simulateTc01AgentPush()
      setEvidencePackage(result.evidencePackage)
      setCurrentRun(result.run)
      setLatency(result.latency)
      setPushStatus(result.run.status === 'done' ? 'done' : 'failed')
      if (result.run.status === 'failed') {
        setError(result.run.errors?.join('；') || '本次推理结论未通过校验')
      }
      useEventHistoryStore.getState().upsertRun(result.run)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'TC-01 模拟推送失败，请重试'
      )
      setPushStatus('failed')
    } finally {
      setIsSimulating(false)
    }
  }, [isSimulating])

  const value = useMemo(
    () => ({
      role,
      setRole,
      selectedLocationId,
      setSelectedLocationId,
      developerTab,
      setDeveloperTab,
      currentRun,
      evidencePackage,
      pushStatus,
      latency,
      error,
      isSimulating,
      loadCurrentRun,
      simulateTc01Push,
    }),
    [
      role,
      selectedLocationId,
      developerTab,
      currentRun,
      evidencePackage,
      pushStatus,
      latency,
      error,
      isSimulating,
      loadCurrentRun,
      simulateTc01Push,
    ]
  )

  return (
    <TraceroContext.Provider value={value}>{children}</TraceroContext.Provider>
  )
}
