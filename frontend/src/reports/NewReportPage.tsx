import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../auth/SessionContext'

const DRAFT_KEY = 'vn-to-english:draft:v1'

type Draft = {
  version: 1
  title: string
  sourceUrl: string
  sourceText: string
  translationText: string
}

const EMPTY_DRAFT: Draft = {
  version: 1,
  title: '',
  sourceUrl: '',
  sourceText: '',
  translationText: '',
}

function restoreDraft(): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null
    if (!saved || saved.version !== 1) return EMPTY_DRAFT

    return {
      version: 1,
      title: saved.title ?? '',
      sourceUrl: saved.sourceUrl ?? '',
      sourceText: saved.sourceText ?? '',
      translationText: saved.translationText ?? '',
    }
  } catch {
    return EMPTY_DRAFT
  }
}

export function NewReportPage() {
  const [draft, setDraft] = useState(restoreDraft)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { csrfToken } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  function update(field: keyof Omit<Draft, 'version'>) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!csrfToken || submitting) return

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          report: {
            title: draft.title,
            source_url: draft.sourceUrl,
            source_text: draft.sourceText,
            translation_text: draft.translationText,
          },
        }),
      })

      if (!response.ok) {
        setError('Unable to submit this translation. Please review the fields and try again.')
        return
      }

      localStorage.removeItem(DRAFT_KEY)
      navigate('/reports')
    } catch {
      setError('Unable to submit this translation. Your draft is still saved in this browser.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900 sm:px-6">
      <section className="mx-auto max-w-7xl">
        <Link className="text-sm font-medium text-emerald-700 hover:text-emerald-900" to="/reports">
          ← Report history
        </Link>
        <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight">New translation</h1>
          <p className="mt-2 text-stone-600">Paste the Vietnamese article and write your English version beside it.</p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {error}
              </p>
            )}
            <label className="block text-sm font-medium">
              Title
              <input
                aria-label="Title"
                className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3"
                maxLength={200}
                onChange={update('title')}
                required
                value={draft.title}
              />
              <span className="mt-1 block text-right text-xs text-stone-500">{draft.title.length}/200</span>
            </label>

            <label className="block text-sm font-medium">
              Source URL <span className="font-normal text-stone-500">(optional)</span>
              <input
                aria-label="Source URL"
                className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3"
                onChange={update('sourceUrl')}
                type="url"
                value={draft.sourceUrl}
              />
            </label>

            <div className="grid gap-6 lg:grid-cols-2">
              <label className="block text-sm font-medium">
                Vietnamese article
                <textarea
                  aria-label="Vietnamese article"
                  className="mt-2 min-h-96 w-full resize-y rounded-xl border border-stone-300 px-4 py-3 leading-7"
                  maxLength={30000}
                  onChange={update('sourceText')}
                  required
                  value={draft.sourceText}
                />
                <span className="mt-1 block text-right text-xs text-stone-500">{draft.sourceText.length}/30,000</span>
              </label>

              <label className="block text-sm font-medium">
                English translation
                <textarea
                  aria-label="English translation"
                  className="mt-2 min-h-96 w-full resize-y rounded-xl border border-stone-300 px-4 py-3 leading-7"
                  maxLength={30000}
                  onChange={update('translationText')}
                  required
                  value={draft.translationText}
                />
                <span className="mt-1 block text-right text-xs text-stone-500">{draft.translationText.length}/30,000</span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                className="rounded-xl bg-stone-900 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
