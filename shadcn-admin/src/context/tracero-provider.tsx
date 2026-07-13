import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getCurrentRun,
  simulateTc01AgentPush,
} from '@/features/tracero/api'
import { currentRun as mockCurrentRun } from '@/features/tracero/mock-data'
import type {
  AgentPushStatus,
  DeveloperTab,
  EvidencePackage,
  LatencyMetrics,
  TraceroRun,
  UserRole,
} from '@/features/tracero/types'
import { TraceroContext, type Message } from './tracero-context'

type TraceroProviderProps = {
  children: ReactNode
  initialRole?: UserRole
  initialLocationId?: string
  initialDeveloperTab?: DeveloperTab
}

export function TraceroProvider({
  children,
  initialRole = 'general',
  initialLocationId,
  initialDeveloperTab = 'code',
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
  const [messages, setMessages] = useState<Message[]>([])

  const loadCurrentRun = useCallback(async () => {
    setError(null)
    try {
      const run = await getCurrentRun()
      setCurrentRun(run)
    } catch {
      setError('当前推理事件加载失败')
      setPushStatus('failed')
    }
  }, [])

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
      setPushStatus('done')
    } catch {
      setError('TC-01 模拟推送失败，请重试')
      setPushStatus('failed')
    } finally {
      setIsSimulating(false)
    }
  }, [isSimulating])

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const resetChat = useCallback(() => {
    setMessages([])
  }, [])

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
      messages,
      addMessage,
      resetChat,
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
      messages,
      addMessage,
      resetChat,
    ]
  )

  return (
    <TraceroContext.Provider value={value}>{children}</TraceroContext.Provider>
  )
}
