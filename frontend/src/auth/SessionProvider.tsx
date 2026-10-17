import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { SessionContext } from './SessionContext'
import type { SessionState, User } from './SessionContext'

type SessionResponse = {
  authenticated: boolean
  user: User | null
  csrf_token: string
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    status: 'loading',
    user: null,
    csrfToken: null,
  })

  async function login(email: string, password: string) {
    if (!session.csrfToken) return 'Unable to log in. Please try again.'

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': session.csrfToken,
        },
        body: JSON.stringify({ email, password }),
      })
      const payload = (await response.json()) as SessionResponse | { error: string }

      if (!response.ok) {
        return 'error' in payload ? payload.error : 'Unable to log in. Please try again.'
      }

      const authenticatedSession = payload as SessionResponse
      setSession((current) => ({
        ...current,
        status: 'authenticated',
        user: authenticatedSession.user,
        csrfToken: authenticatedSession.csrf_token,
      }))
      return null
    } catch {
      return 'Unable to log in. Please try again.'
    }
  }

  async function logout() {
    if (!session.csrfToken) return

    try {
      const response = await fetch('/api/session', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': session.csrfToken,
        },
      })

      if (!response.ok) return

      const payload = (await response.json()) as SessionResponse
      setSession({
        status: 'unauthenticated',
        user: null,
        csrfToken: payload.csrf_token,
      })
    } catch {
      // Keep the authenticated state when the server cannot confirm logout.
    }
  }

  useEffect(() => {
    let active = true

    fetch('/api/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load session')
        return response.json() as Promise<SessionResponse>
      })
      .then((payload) => {
        if (!active) return

        setSession({
          status: payload.authenticated ? 'authenticated' : 'unauthenticated',
          user: payload.user,
          csrfToken: payload.csrf_token,
        })
      })
      .catch(() => {
        if (!active) return
        setSession({ status: 'unauthenticated', user: null, csrfToken: null })
      })

    return () => {
      active = false
    }
  }, [])

  return <SessionContext value={{ ...session, login, logout }}>{children}</SessionContext>
}
