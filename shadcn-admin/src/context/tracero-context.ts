import { createContext } from 'react'

export type UserRole = 'general' | 'dev' | 'test' | 'ops'

export interface Message {
  id: number
  role: 'user' | 'ai'
  content: string
}

export interface TraceroContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  messages: Message[]
  addMessage: (message: Message) => void
  resetChat: () => void
}

export const TraceroContext = createContext<TraceroContextType | null>(null)
