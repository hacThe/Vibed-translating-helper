import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './auth/SessionContext'
import { SessionProvider } from './auth/SessionProvider'
import { NewReportPage } from './reports/NewReportPage'
import { ReportDetailPage } from './reports/ReportDetailPage'
import { ReportsPage } from './reports/ReportsPage'

function LoadingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 text-stone-600">
      <p>Loading…</p>
    </main>
  )
}

function LoginPage() {
  const { login } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    const message = await login(String(form.get('email')), String(form.get('password')))

    setError(message)
    setSubmitting(false)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 px-6 text-stone-900">
      <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Translation Tutor
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-2 text-stone-600">Use the account configured for this tutor.</p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="w-full rounded-xl bg-stone-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </section>
    </main>
  )
}

function LoginRoute() {
  const { status } = useSession()

  if (status === 'authenticated') return <Navigate to="/reports" replace />
  return <LoginPage />
}

function ProtectedPage({ children }: { children: ReactNode }) {
  const { status } = useSession()

  if (status === 'loading') return <LoadingPage />
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/reports" element={<ProtectedPage><ReportsPage /></ProtectedPage>} />
      <Route path="/reports/new" element={<ProtectedPage><NewReportPage /></ProtectedPage>} />
      <Route path="/reports/:id" element={<ProtectedPage><ReportDetailPage /></ProtectedPage>} />
      <Route path="*" element={<Navigate to="/reports" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  )
}

export default App
