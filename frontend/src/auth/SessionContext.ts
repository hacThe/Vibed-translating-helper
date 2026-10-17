import { createContext, useContext } from 'react'

export type User = {
  id: number
  email: string
}

export type SessionState = {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  user: User | null
  csrfToken: string | null
}

type SessionContextValue = SessionState & {
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
