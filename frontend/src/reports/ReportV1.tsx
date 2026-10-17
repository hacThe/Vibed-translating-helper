import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CorrectionCategory, ReportNoteV1, ReportSchemaV1 } from './reportSchemaV1'

const CATEGORY_LABELS: Record<CorrectionCategory, string> = {
  meaning: 'Meaning',
  diction: 'Word choice',
  grammar: 'Grammar',
  detail: 'Dates & details',
}

const CATEGORY_STYLES: Record<CorrectionCategory, string> = {
  meaning: 'bg-orange-100 text-orange-950 ring-orange-300',
  diction: 'bg-lime-100 text-lime-950 ring-lime-400',
  grammar: 'bg-blue-100 text-blue-950 ring-blue-300',
  detail: 'bg-amber-100 text-amber-950 ring-amber-300',
}

type LocatedNote = {
  id: string
  paragraphIndex: number
  note: ReportNoteV1
}

type ReportV1Props = {
  title: string
  sourceUrl?: string
  result: ReportSchemaV1
}

export function ReportV1({ title, sourceUrl, result }: ReportV1Props) {
  const notes = useMemo<LocatedNote[]>(() => result.paragraphs.flatMap((paragraph) =>
    paragraph.notes.map((note, noteIndex) => ({
      id: `note-${paragraph.index}-${noteIndex + 1}`,
      paragraphIndex: paragraph.index,
      note,
    }))), [result])
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? null)
  const [activeCategory, setActiveCategory] = useState<'all' | CorrectionCategory>('all')
  const [activeTab, setActiveTab] = useState<'draft' | 'revision' | 'lessons'>('draft')
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const selected = notes.find((item) => item.id === selectedId) ?? null
  const visibleNotes = activeCategory === 'all'
    ? notes
    : notes.filter((item) => item.note.category === activeCategory)

  function applyFilter(category: 'all' | CorrectionCategory) {
    setActiveCategory(category)
    const matching = category === 'all' ? notes : notes.filter((item) => item.note.category === category)
    if (!matching.some((item) => item.id === selectedId)) setSelectedId(matching[0]?.id ?? null)
  }

  async function copyRevision() {
    const text = `${result.revised_title}\n\n${result.revised_article}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage('Revised translation copied.')
    } catch {
      setCopyMessage('Copy is unavailable. Select the revised text and copy it manually.')
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f5ef] text-[#263b34]">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between border-b border-stone-300 px-5 sm:px-8">
        <Link className="font-serif text-xl tracking-tight" to="/reports">← between the lines</Link>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Tiếng Việt → English</span>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="grid gap-8 py-10 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Your personal translation lesson</p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-normal tracking-tight sm:text-6xl">{title}</h1>
            <p className="mt-4 max-w-xl leading-7 text-stone-600">Explore each correction, understand why it works, and carry the lesson into your next translation.</p>
          </div>
          <aside className="border-l-2 border-lime-700/40 pl-5 font-serif text-lg leading-8">
            “Translate the idea.<br />Then find the words.”
          </aside>
        </div>

        {sourceUrl && (
          <div className="border-y border-stone-300 py-4 text-sm">
            <a className="underline decoration-stone-400 underline-offset-4" href={sourceUrl} rel="noreferrer" target="_blank">Vietnamese original ↗</a>
          </div>
        )}

        <nav aria-label="Lesson views" className="flex gap-7 border-b border-stone-300" role="tablist">
          {([
            ['draft', 'Your draft'],
            ['revision', 'Revised version'],
            ['lessons', 'Key lessons'],
          ] as const).map(([tab, label]) => (
            <button
              aria-selected={activeTab === tab}
              className={`border-b-2 px-0 py-4 text-sm ${activeTab === tab ? 'border-emerald-900 font-bold text-emerald-900' : 'border-transparent text-stone-500'}`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <div hidden={activeTab !== 'draft'} role="tabpanel">
          <div className="mt-7 flex flex-wrap items-center gap-2" aria-label="Correction filters">
          {(['all', 'meaning', 'diction', 'grammar', 'detail'] as const).map((category) => {
            const count = category === 'all' ? notes.length : notes.filter((item) => item.note.category === category).length
            return (
              <button
                aria-pressed={activeCategory === category}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${activeCategory === category ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-stone-300 text-stone-600 hover:bg-white'}`}
                key={category}
                onClick={() => applyFilter(category)}
                type="button"
              >
                {category === 'all' ? 'All notes' : CATEGORY_LABELS[category]} <span className="opacity-70">{count}</span>
              </button>
            )
          })}
          <span className="ml-auto text-xs text-stone-500">{visibleNotes.length} visible {visibleNotes.length === 1 ? 'note' : 'notes'}</span>
          </div>

          <div className="mt-5 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <article className="overflow-hidden rounded-xl border border-stone-300 bg-[#fffefa] shadow-sm">
            <header className="border-b border-stone-200 px-6 py-6 sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Your draft</p>
              <h2 className="mt-2 font-serif text-2xl">{result.revised_title}</h2>
            </header>
            {result.paragraphs.map((paragraph) => {
              const paragraphNotes = notes.filter((item) => item.paragraphIndex === paragraph.index)
                .sort((left, right) => left.note.start_offset - right.note.start_offset)
              let cursor = 0

              return (
                <section className="border-b border-stone-200 px-6 py-6 last:border-0 sm:px-8" key={paragraph.index}>
                  <div className="mb-3 flex justify-between text-[0.68rem] font-bold uppercase tracking-[0.14em] text-stone-500">
                    <span>Paragraph {String(paragraph.index).padStart(2, '0')}</span>
                    <span>{paragraph.notes.length} {paragraph.notes.length === 1 ? 'note' : 'notes'}</span>
                  </div>
                  <p className="font-serif text-lg leading-9 text-stone-700">
                    {paragraphNotes.flatMap((item) => {
                      const before = paragraph.translation_text.slice(cursor, item.note.start_offset)
                      cursor = item.note.end_offset
                      return [
                        before,
                        <button
                          aria-label={`${CATEGORY_LABELS[item.note.category]} correction: ${item.note.original_text}`}
                          aria-pressed={selectedId === item.id}
                          className={`mx-0.5 inline rounded-sm px-0.5 py-0.5 font-inherit ring-offset-2 transition hover:ring-2 ${CATEGORY_STYLES[item.note.category]} ${selectedId === item.id ? 'ring-2' : ''} ${activeCategory !== 'all' && activeCategory !== item.note.category ? 'opacity-30 saturate-0' : ''}`}
                          key={item.id}
                          onClick={() => {
                            if (activeCategory !== 'all' && activeCategory !== item.note.category) setActiveCategory('all')
                            setSelectedId(item.id)
                          }}
                          type="button"
                        >
                          {item.note.original_text}
                        </button>,
                      ]
                    })}
                    {paragraph.translation_text.slice(cursor)}
                  </p>
                  <details className="mt-5">
                    <summary className="cursor-pointer text-xs font-semibold text-emerald-800">Show paragraph revision</summary>
                    <p className="mt-3 border-l-2 border-lime-700/40 bg-lime-50 px-4 py-3 font-serif leading-7 text-stone-700">{paragraph.revised_text}</p>
                  </details>
                </section>
              )
            })}
          </article>

          <aside className="sticky top-6 rounded-xl border border-stone-300 bg-[#fffefa] shadow-sm" aria-label="Teacher note">
            <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em]">Teacher note</h2>
              <span className="text-xs text-stone-500">{selected ? `${String(notes.indexOf(selected) + 1).padStart(2, '0')} / ${String(notes.length).padStart(2, '0')}` : '0 / 0'}</span>
            </header>
            {selected ? (
              <div className="p-5">
                <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${CATEGORY_STYLES[selected.note.category]}`}>{CATEGORY_LABELS[selected.note.category]}</span>
                <p className="mt-5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-stone-500">You wrote</p>
                <p className="mt-2 font-serif text-lg text-stone-600 line-through">{selected.note.original_text}</p>
                <p className="mt-5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-stone-500">Try this instead</p>
                <p className="mt-2 font-serif text-xl text-emerald-900">{selected.note.correction}</p>
                <p className="mt-5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-stone-500">Why it works</p>
                <p className="mt-2 text-sm leading-7 text-stone-600">{selected.note.explanation_en}</p>
                <p className="mt-4 rounded-lg bg-lime-50 p-3 text-sm leading-6 text-lime-900" lang="vi">{selected.note.note_vi}</p>
              </div>
            ) : (
              <p className="p-5 text-sm leading-6 text-stone-600">This report has no corrections. Your draft is ready to compare with the revised version.</p>
            )}
          </aside>
          </div>
        </div>

        {activeTab === 'revision' && (
          <section className="py-8" role="tabpanel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-3xl">Revised version</h2>
                <p className="mt-2 text-sm text-stone-600">A polished version that keeps the meaning of your original translation.</p>
              </div>
              <button className="rounded-lg border border-emerald-900 px-4 py-2 text-sm font-semibold text-emerald-900" onClick={() => void copyRevision()} type="button">Copy revised version</button>
            </div>
            <article className="rounded-xl border border-stone-300 bg-[#fffefa] p-7 shadow-sm sm:p-10">
              <h2 className="font-serif text-3xl">{result.revised_title}</h2>
              {result.revised_article.split(/\n\s*\n/).map((paragraph, index) => (
                <p className="mt-6 font-serif text-lg leading-9 text-stone-700" key={index}>{paragraph}</p>
              ))}
            </article>
          </section>
        )}

        {activeTab === 'lessons' && (
          <section className="py-8" role="tabpanel">
            <div>
              <h2 className="font-serif text-3xl">Key lessons</h2>
              <p className="mt-2 text-sm leading-7 text-stone-600">Patterns worth remembering for your next translation.</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.key_lessons.map((lesson, index) => (
                <article className="rounded-xl border border-stone-300 bg-[#fffefa] p-6" key={`${lesson.title}-${index}`}>
                  <span className="font-serif text-2xl italic text-lime-700">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="mt-4 text-base font-bold">{lesson.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-stone-600">{lesson.explanation}</p>
                  <p className="mt-4 rounded-lg bg-lime-50 p-3 font-serif text-emerald-900">{lesson.example}</p>
                </article>
              ))}
            </div>
            <section className="mt-6 rounded-xl border border-lime-200 bg-lime-50 p-6">
              <h3 className="font-serif text-2xl">Editing checklist</h3>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {result.editing_checklist.map((item, index) => (
                  <div key={`${item.title}-${index}`}>
                    <h4 className="font-bold text-emerald-900">{item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-lime-900">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>
        )}
      </section>
      {copyMessage && <p className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-emerald-950 px-5 py-3 text-sm text-white shadow-lg" role="status">{copyMessage}</p>}
    </main>
  )
}
