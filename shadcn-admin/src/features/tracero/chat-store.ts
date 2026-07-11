import { create } from 'zustand'
import { currentRun } from './mock-data'

export type ChatMessageRole = 'user' | 'assistant'

export type ChatContext = {
  perspective: 'general' | 'dev' | 'test' | 'ops'
  evidenceId?: string
  repository?: string
  commit?: string
  filePath?: string
  line?: number
  functionName?: string
  module?: string
  testCaseId?: string
}

export type ChatMessage = {
  id: string
  role: ChatMessageRole
  content: string
  createdAt?: Date
  context?: ChatContext
}

type ChatState = {
  conversations: Record<string, ChatMessage[]>
  getMessages: (runId: string) => ChatMessage[]
  addMessage: (runId: string, message: Omit<ChatMessage, 'id'>) => void
}

const initialConversations: Record<string, ChatMessage[]> = {
  [currentRun.run_id]: currentRun.chatHistory.map((message, index) => ({
    id: `${currentRun.run_id}-${index + 1}`,
    role: message.role === 'ai' ? 'assistant' : 'user',
    content: message.content,
  })),
}

export const useTraceroChatStore = create<ChatState>()((set, get) => ({
  conversations: initialConversations,
  getMessages: (runId) => get().conversations[runId] ?? [],
  addMessage: (runId, message) =>
    set((state) => {
      const messages = state.conversations[runId] ?? []

      return {
        conversations: {
          ...state.conversations,
          [runId]: [
            ...messages,
            {
              ...message,
              id: `${runId}-${Date.now()}`,
              createdAt: new Date(),
            },
          ],
        },
      }
    }),
}))
