import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReportV1 } from './ReportV1'
import { isReportSchemaV1 } from './reportSchemaV1'
import { useSession } from '../auth/SessionContext'

type ReportDetail = {
  id: number
  title: string
  mode: 'vn_en' | 'vn_zh_cn'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  provider: string
  model: string
  created_at: string
  schema_version: string
  source_url?: string
  source_text?: string
  translation_text?: string
  result?: unknown
}

const STATUS_MESSAGES: Record<ReportDetail['status'], string> = {
  queued: 'Your review is queued.',
  processing: 'Your review is being prepared.',
  completed: 'Your review is ready.',
  failed: 'The review could not be completed. You can retry it below.',
}

export function ReportDetailPage() {
  const { id } = useParams()
  const { csrfToken } = useSession()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  async function retryReport() {
    if (!csrfToken || retrying || !report) return

    setRetrying(true)
    setRetryError(null)
    try {
      const response = await fetch(`/api/reports/${report.id}/retry`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      })
      if (!response.ok) throw new Error('Unable to retry report')

      setReport(await response.json() as ReportDetail)
    } catch {
      setRetryError('Unable to retry this report. Please try again.')
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    let active = true

    fetch(`/api/reports/${id}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (response.status === 404) return { kind: 'not-found' as const }
        if (!response.ok) throw new Error('Unable to load report')
        return { kind: 'report' as const, report: await response.json() as ReportDetail }
      })
      .then((result) => {
        if (!active) return
        if (result.kind === 'not-found') {
          setState('not-found')
          return
        }
        setReport(result.report)
        setState('ready')
      })
      .catch(() => {
        if (active) setState('error')
      })

    return () => {
      active = false
    }
  }, [id])

  if (state === 'ready' && report?.status === 'completed') {
    if (['v1', 'vn_en_v1', 'vn_zh_cn_v1'].includes(report.schema_version)
      && isReportSchemaV1(report.result, report.translation_text)) {
      return <ReportV1 mode={report.mode} result={report.result} sourceUrl={report.source_url} title={report.title} />
    }

    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 px-5 text-stone-900">
        <section className="max-w-lg rounded-2xl border border-stone-200 bg-white p-8">
          <h1 className="text-2xl font-semibold">Unable to display this report</h1>
          <p className="mt-3 text-stone-600" role="alert">This completed report uses an unsupported or invalid format.</p>
          <Link className="mt-5 inline-block font-medium text-emerald-800" to="/reports">← Report history</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:px-6">
      <section className="mx-auto max-w-4xl">
        <Link className="text-sm font-medium text-emerald-700 hover:text-emerald-900" to="/reports">
          ← Report history
        </Link>

        <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          {state === 'loading' && <p className="text-stone-600">Loading report…</p>}
          {state === 'not-found' && (
            <>
              <h1 className="text-3xl font-semibold">Report not found</h1>
              <p className="mt-3 text-stone-600">This report does not exist or is not available to this account.</p>
            </>
          )}
          {state === 'error' && <p className="text-red-800" role="alert">Unable to load this report. Please try again.</p>}
          {state === 'ready' && report && (
            <>
              <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
                {report.provider}/{report.model}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{report.title}</h1>
              <div className="mt-6 rounded-2xl bg-stone-100 p-5">
                <p className="font-medium">{STATUS_MESSAGES[report.status]}</p>
                {report.status === 'failed' && (
                  <button
                    className="mt-4 rounded-xl bg-stone-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
                    disabled={retrying}
                    onClick={() => void retryReport()}
                    type="button"
                  >
                    {retrying ? 'Retrying…' : 'Retry report'}
                  </button>
                )}
                {retryError && <p className="mt-3 text-sm text-red-800" role="alert">{retryError}</p>}
                {report.status !== 'completed' && (
                  <p className="mt-2 text-sm text-stone-600">Refresh the report history to check for a new status.</p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
