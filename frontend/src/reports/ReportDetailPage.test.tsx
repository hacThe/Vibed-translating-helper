import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../App'
import { waitingTimeMessage } from './reportWaitingTime'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function authenticatedSession() {
  return new Response(
    JSON.stringify({
      authenticated: true,
      user: { id: 7, email: 'learner@example.com' },
      csrf_token: 'csrf-2',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function completedReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    title: 'Traffic in the city',
    mode: 'vn_en',
    source_url: 'https://example.com/traffic',
    source_text: 'Ùn tắc giao thông rất lớn.',
    translation_text: 'The traffic jam is very big.',
    status: 'completed',
    provider: 'fake',
    model: 'fake-v1',
    schema_version: 'v1',
    corrections_count: 1,
    created_at: '2026-10-17T03:00:00Z',
    result: {
      schema_version: 'v1',
      revised_title: 'Traffic in the city — revised',
      paragraphs: [
        {
          index: 1,
          translation_text: 'The traffic jam is very big.',
          revised_text: 'The traffic jam is severe.',
          notes: [
            {
              original_text: 'very big',
              occurrence: 1,
              correction: 'severe',
              category: 'diction',
              explanation_en: '“Severe” is more precise for serious congestion.',
              note_vi: '“Severe” tự nhiên và chính xác hơn.',
              start_offset: 19,
              end_offset: 27,
            },
          ],
        },
      ],
      revised_article: 'The traffic jam is severe.',
      key_lessons: [
        {
          title: 'Choose precise words',
          explanation: 'Specific adjectives make descriptions clearer.',
          example: 'Use severe congestion.',
        },
      ],
      editing_checklist: [
        { title: 'Read for precision', description: 'Replace broad intensifiers.' },
      ],
    },
    ...overrides,
  }
}

function renderReport(report = completedReport()) {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(authenticatedSession())
    .mockResolvedValueOnce(
      new Response(JSON.stringify(report), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

  render(
    <MemoryRouter initialEntries={['/reports/12']}>
      <App />
    </MemoryRouter>,
  )
}

test('completed v1 report renders an exact annotation and its teacher note', async () => {
  renderReport()
  const user = userEvent.setup()

  const annotation = await screen.findByRole('button', { name: 'Word choice correction: very big' })
  await user.click(annotation)

  expect(screen.getByRole('heading', { name: 'Traffic in the city' })).toBeVisible()
  expect(screen.getByText('You wrote')).toBeVisible()
  expect(screen.getByText('Try this instead')).toBeVisible()
  expect(screen.getByText('“Severe” is more precise for serious congestion.')).toBeVisible()
  expect(screen.getByText('“Severe” tự nhiên và chính xác hơn.')).toHaveAttribute('lang', 'vi')
})

test('completed simplified Chinese report renders sentence structure feedback and pinyin', async () => {
  renderReport(completedReport({
    title: 'Giao thông thành phố',
    mode: 'vn_zh_cn',
    translation_text: '交通变得很重要。',
    schema_version: 'vn_zh_cn_v1',
    result: {
      schema_version: 'vn_zh_cn_v1',
      revised_title: '城市交通',
      paragraphs: [
        {
          index: 1,
          translation_text: '交通变得很重要。',
          revised_text: '交通越来越重要。',
          notes: [
            {
              original_text: '变得很重要',
              occurrence: 1,
              correction: '越来越重要',
              correction_pinyin: 'yuè lái yuè zhòng yào',
              category: 'sentence_structure',
              explanation_vi: 'Cấu trúc 越来越… diễn tả mức độ tăng dần tự nhiên hơn.',
              start_offset: 2,
              end_offset: 7,
            },
          ],
        },
      ],
      revised_article: '交通越来越重要。',
      key_lessons: [
        {
          title: 'Diễn tả sự thay đổi tăng dần',
          explanation: 'Dùng cấu trúc 越来越… khi mức độ tăng theo thời gian.',
          example: '交通越来越重要。',
        },
      ],
      editing_checklist: [
        { title: 'Kiểm tra kết cấu câu', description: 'Tránh dịch từng từ.' },
      ],
    },
  }))

  const annotation = await screen.findByRole('button', { name: 'Sentence structure correction: 变得很重要' })
  expect(annotation).toHaveAttribute('lang', 'zh-CN')
  expect(screen.getByText('Tiếng Việt → 简体中文')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Sentence structure 1' })).toBeVisible()
  expect(screen.getByText('越来越重要')).toHaveAttribute('lang', 'zh-CN')
  expect(screen.getByText('yuè lái yuè zhòng yào')).toBeVisible()
  expect(screen.getByText('Cấu trúc 越来越… diễn tả mức độ tăng dần tự nhiên hơn.')).toHaveAttribute('lang', 'vi')
})

test('category filters select the first matching correction', async () => {
  const report = completedReport()
  report.corrections_count = 2
  report.result.paragraphs[0].notes.push({
    original_text: 'traffic jam',
    occurrence: 1,
    correction: 'congestion',
    category: 'grammar',
    explanation_en: 'Use the uncountable noun for traffic generally.',
    note_vi: 'Congestion là danh từ không đếm được.',
    start_offset: 4,
    end_offset: 15,
  })
  renderReport(report)
  const user = userEvent.setup()

  const grammarFilter = await screen.findByRole('button', { name: 'Grammar 1' })
  expect(grammarFilter).toHaveClass('cursor-pointer')
  await user.click(grammarFilter)

  expect(grammarFilter).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Use the uncountable noun for traffic generally.')).toBeVisible()
  expect(screen.getByText('1 visible note')).toBeVisible()
})

test('lesson tabs expose the revised copy action and key lessons', async () => {
  renderReport()
  const user = userEvent.setup()
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()

  const revisedTab = await screen.findByRole('tab', { name: 'Revised version' })
  expect(revisedTab).toHaveClass('cursor-pointer', 'hover:text-emerald-800')
  await user.click(revisedTab)
  expect(screen.getByRole('heading', { name: 'Traffic in the city — revised' })).toBeVisible()
  expect(within(screen.getByRole('tabpanel')).getByText('The traffic jam is severe.')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Copy revised version' }))
  expect(writeText).toHaveBeenCalledWith(
    'Traffic in the city — revised\n\nThe traffic jam is severe.',
  )
  expect(await screen.findByRole('status')).toHaveTextContent('Revised translation copied.')

  await user.click(screen.getByRole('tab', { name: 'Key lessons' }))
  expect(screen.getByRole('heading', { name: 'Choose precise words' })).toBeVisible()
  expect(screen.getByText('Replace broad intensifiers.')).toBeVisible()
})

test('unsupported or corrupted completed reports fail safely', async () => {
  renderReport(completedReport({ schema_version: 'v2', result: { schema_version: 'v2' } }))

  expect(await screen.findByRole('heading', { name: 'Unable to display this report' })).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent('unsupported or invalid format')
  expect(screen.queryByText('Detailed report rendering arrives in Milestone 5.')).not.toBeInTheDocument()
})

test('completed v1 reports with corrupted highlight ranges fail safely', async () => {
  const report = completedReport()
  report.result.paragraphs[0].notes[0].end_offset = 26
  renderReport(report)

  expect(await screen.findByRole('heading', { name: 'Unable to display this report' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Word choice correction: very big' })).not.toBeInTheDocument()
})

test('failed report can be retried from its detail page', async () => {
  const failedReport = completedReport({
    status: 'failed',
    result: undefined,
    source_text: undefined,
    translation_text: undefined,
  })
  const fetchMock = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(authenticatedSession())
    .mockResolvedValueOnce(
      new Response(JSON.stringify(failedReport), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...failedReport, status: 'queued' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/reports/12']}>
      <App />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Retry report' }))

  expect(fetchMock).toHaveBeenLastCalledWith('/api/reports/12/retry', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-2' }),
  }))
  expect(screen.getByText('Your review is queued.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Retry report' })).not.toBeInTheDocument()
})

test('waiting time counts seconds before switching to approximate minutes and hours', () => {
  const queuedAt = '2026-10-17T03:00:00Z'

  expect(waitingTimeMessage(queuedAt, Date.parse('2026-10-17T03:00:37Z'))).toBe('Waiting for 37 seconds.')
  expect(waitingTimeMessage(queuedAt, Date.parse('2026-10-17T03:01:59Z'))).toBe('Waiting for about 1 minute.')
  expect(waitingTimeMessage(queuedAt, Date.parse('2026-10-17T05:59:59Z'))).toBe('Waiting for about 2 hours.')
})

test('queued reports poll silently until the completed report is ready', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-17T03:00:37Z'))
  const queuedReport = completedReport({
    status: 'queued',
    queued_at: '2026-10-17T03:00:00Z',
    result: undefined,
  })
  const fetchMock = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(authenticatedSession())
    .mockResolvedValueOnce(new Response(JSON.stringify(queuedReport), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    .mockRejectedValueOnce(new TypeError('temporary network error'))
    .mockResolvedValueOnce(new Response(JSON.stringify(completedReport({
      queued_at: '2026-10-17T03:00:00Z',
    })), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

  render(
    <MemoryRouter initialEntries={['/reports/12']}>
      <App />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Your review is queued.')).toBeVisible()
  expect(screen.getByRole('timer')).toHaveTextContent('Waiting for 37 seconds.')

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5_000)
  })
  expect(screen.getByRole('timer')).toHaveTextContent('Waiting for 42 seconds.')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5_000)
  })
  expect(await screen.findByRole('heading', { name: 'Traffic in the city' })).toBeVisible()
  expect(screen.queryByRole('timer')).not.toBeInTheDocument()

  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

test('polling pauses in a hidden tab and refreshes immediately when visible', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-17T03:00:10Z'))
  let hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const queuedReport = completedReport({
    status: 'queued',
    queued_at: '2026-10-17T03:00:00Z',
    result: undefined,
  })
  const fetchMock = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(authenticatedSession())
    .mockResolvedValueOnce(new Response(JSON.stringify(queuedReport), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    .mockResolvedValueOnce(new Response(JSON.stringify(completedReport({
      queued_at: '2026-10-17T03:00:00Z',
    })), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

  render(
    <MemoryRouter initialEntries={['/reports/12']}>
      <App />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Your review is queued.')).toBeVisible()

  await act(async () => {
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
  expect(fetchMock).toHaveBeenCalledTimes(2)

  await act(async () => {
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
  })
  expect(await screen.findByRole('heading', { name: 'Traffic in the city' })).toBeVisible()
  expect(fetchMock).toHaveBeenCalledTimes(3)
})
