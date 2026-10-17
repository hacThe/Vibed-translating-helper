import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSession } from '../auth/SessionContext'

type ReportSummary = {
  id: number
  title: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  provider: string
  model: string
  corrections_count: number
  created_at: string
}

type ReportsResponse = {
  reports: ReportSummary[]
  pagination: {
    page: number
    per_page: number
    total_count: number
    total_pages: number
    has_previous: boolean
    has_next: boolean
  }
}

function statusLabel(status: ReportSummary['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function ReportsPage() {
  const { logout, user } = useSession()
  const [searchParams] = useSearchParams()
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const [loaded, setLoaded] = useState<{ page: number; data: ReportsResponse } | null>(null)
  const [errorPage, setErrorPage] = useState<number | null>(null)
  const data = loaded?.page === page ? loaded.data : null
  const error = errorPage === page

  useEffect(() => {
    let active = true

    fetch(`/api/reports?page=${page}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load reports')
        return response.json() as Promise<ReportsResponse>
      })
      .then((payload) => {
        if (active) setLoaded({ page, data: payload })
      })
      .catch(() => {
        if (active) setErrorPage(page)
      })

    return () => {
      active = false
    }
  }, [page])

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:px-6">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-stone-500">Signed in as {user?.email}</p>
          <button
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-white"
            onClick={() => void logout()}
            type="button"
          >
            Log out
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
            <p className="mt-2 text-stone-600">Refresh this page to check queued review statuses.</p>
          </div>
          <Link className="rounded-xl bg-stone-900 px-5 py-3 font-semibold text-white" to="/reports/new">
            New translation
          </Link>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          {!data && !error && <p className="p-8 text-stone-600">Loading reports…</p>}
          {error && <p className="p-8 text-red-800" role="alert">Unable to load reports. Please refresh and try again.</p>}
          {data?.reports.length === 0 && <p className="p-8 text-stone-600">No reports yet. Start a new translation to create one.</p>}

          {data && data.reports.length > 0 && (
            <ul className="divide-y divide-stone-200">
              {data.reports.map((report) => (
                <li className="p-5 sm:p-6" key={report.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      {report.status === 'completed' || report.status === 'failed' ? (
                        <Link className="text-lg font-semibold hover:text-emerald-700" to={`/reports/${report.id}`}>
                          {report.title}
                        </Link>
                      ) : (
                        <p className="text-lg font-semibold">{report.title}</p>
                      )}
                      <p className="mt-2 text-sm text-stone-500">
                        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.created_at))}
                        {' · '}{report.provider}/{report.model}
                      </p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium">
                      {statusLabel(report.status)}
                    </span>
                  </div>
                  {report.status === 'completed' && (
                    <p className="mt-3 text-sm text-stone-600">
                      {report.corrections_count} {report.corrections_count === 1 ? 'correction' : 'corrections'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {data && (data.pagination.has_previous || data.pagination.has_next) && (
          <nav aria-label="Report pages" className="mt-6 flex justify-between">
            {data.pagination.has_previous ? (
              <Link className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-medium" to={`/reports?page=${page - 1}`}>
                Previous
              </Link>
            ) : <span />}
            {data.pagination.has_next && (
              <Link className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-medium" to={`/reports?page=${page + 1}`}>
                Next
              </Link>
            )}
          </nav>
        )}
      </section>
    </main>
  )
}
