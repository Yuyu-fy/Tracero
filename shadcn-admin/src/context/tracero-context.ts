import { createContext } from 'react'
import type {
  AgentPushStatus,
  DeveloperTab,
  EvidencePackage,
  LatencyMetrics,
  TraceroRun,
  UserRole,
} from '@/features/tracero/types'

export interface Message {
  id: number
  role: 'user' | 'ai'
  content: string
}

export interface TraceroContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  selectedLocationId: string | undefined
  setSelectedLocationId: (locationId: string | undefined) => void
  developerTab: DeveloperTab
  setDeveloperTab: (tab: DeveloperTab) => void
  currentRun: TraceroRun | null
  evidencePackage: EvidencePackage | null
  pushStatus: AgentPushStatus
  latency: LatencyMetrics | null
  error: string | null
  isSimulating: boolean
  loadCurrentRun: () => Promise<void>
  simulateTc01Push: () => Promise<void>
  messages: Message[]
  addMessage: (message: Message) => void
  resetChat: () => void
}

export const TraceroContext = createContext<TraceroContextType | null>(null)
