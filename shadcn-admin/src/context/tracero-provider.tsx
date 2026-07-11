import { useState, type ReactNode } from 'react'
import { TraceroContext, type Message, type UserRole } from './tracero-context'

export function TraceroProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('general')
  const [messages, setMessages] = useState<Message[]>([])

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message])
  }

  const resetChat = () => {
    setMessages([])
  }

  return (
    <TraceroContext.Provider
      value={{ role, setRole, messages, addMessage, resetChat }}
    >
      {children}
    </TraceroContext.Provider>
  )
}
