import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

function emptyReportsResponse() {
  return new Response(
    JSON.stringify({
      reports: [],
      pagination: {
        page: 1,
        per_page: 20,
        total_count: 0,
        total_pages: 0,
        has_previous: false,
        has_next: false,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

test('unauthenticated visitor is sent from reports to login', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ authenticated: false, user: null, csrf_token: 'csrf-1' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  )

  render(
    <MemoryRouter initialEntries={['/reports']}>
      <App />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible()
})

test('invalid credentials leave the visitor on login with a clear error', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ authenticated: false, user: null, csrf_token: 'csrf-1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Email'), 'learner@example.com')
  await user.type(screen.getByLabelText('Password'), 'wrong password')
  await user.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
})

test('valid credentials take the user to the protected reports page', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ authenticated: false, user: null, csrf_token: 'csrf-1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 7, email: 'learner@example.com' },
          csrf_token: 'csrf-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Email'), 'learner@example.com')
  await user.type(screen.getByLabelText('Password'), 'correct password')
  await user.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('heading', { name: 'Reports' })).toBeVisible()
})

test('authenticated user can log out and log in again without refreshing', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 7, email: 'learner@example.com' },
          csrf_token: 'csrf-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      emptyReportsResponse(),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ authenticated: false, user: null, csrf_token: 'csrf-3' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 7, email: 'learner@example.com' },
          csrf_token: 'csrf-4',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(emptyReportsResponse())
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/reports']}>
      <App />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Log out' }))

  await user.type(await screen.findByLabelText('Email'), 'learner@example.com')
  await user.type(screen.getByLabelText('Password'), 'correct password')
  await user.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('heading', { name: 'Reports' })).toBeVisible()
})

test('new report editor restores and autosaves the versioned local draft', async () => {
  localStorage.setItem(
    'vn-to-english:draft:v1',
    JSON.stringify({
      version: 1,
      title: 'Saved title',
      sourceUrl: 'https://example.com/saved',
      sourceText: 'Bản nháp tiếng Việt.',
      translationText: 'Saved English draft.',
    }),
  )
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        authenticated: true,
        user: { id: 7, email: 'learner@example.com' },
        csrf_token: 'csrf-2',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  )
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/reports/new']}>
      <App />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'New translation' })).toBeVisible()
  expect(screen.getByLabelText('Vietnamese article')).toHaveValue('Bản nháp tiếng Việt.')
  expect(screen.getByLabelText('English translation')).toHaveValue('Saved English draft.')

  await user.clear(screen.getByLabelText('Title'))
  await user.type(screen.getByLabelText('Title'), 'Updated title')

  await waitFor(() => {
    expect(JSON.parse(localStorage.getItem('vn-to-english:draft:v1')!)).toMatchObject({
      version: 1,
      title: 'Updated title',
    })
  })
})

test('successful report submission clears the draft and returns to history', async () => {
  localStorage.setItem(
    'vn-to-english:draft:v1',
    JSON.stringify({
      version: 1,
      title: 'Ready to submit',
      sourceUrl: 'https://example.com/ready',
      sourceText: 'Bài viết tiếng Việt.',
      translationText: 'The English translation.',
    }),
  )
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 7, email: 'learner@example.com' },
          csrf_token: 'csrf-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: 12, title: 'Ready to submit', status: 'queued' }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/reports/new']}>
      <App />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Submit for review' }))

  expect(await screen.findByRole('heading', { name: 'Reports' })).toBeVisible()
  expect(localStorage.getItem('vn-to-english:draft:v1')).toBeNull()
})

test('failed report submission preserves the local draft', async () => {
  const savedDraft = {
    version: 1,
    title: 'Keep this draft',
    sourceUrl: 'https://example.com/keep',
    sourceText: 'Nội dung cần giữ lại.',
    translationText: 'Content that must be preserved.',
  }
  localStorage.setItem('vn-to-english:draft:v1', JSON.stringify(savedDraft))
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 7, email: 'learner@example.com' },
          csrf_token: 'csrf-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/reports/new']}>
      <App />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Submit for review' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to submit this translation')
  expect(JSON.parse(localStorage.getItem('vn-to-english:draft:v1')!)).toEqual(savedDraft)
})

test('report history links completed and failed reports but not queued reports', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 7, email: 'learner@example.com' },
          csrf_token: 'csrf-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reports: [
            {
              id: 12,
              title: 'Completed report',
              status: 'completed',
              provider: 'fake',
              model: 'fake-v1',
              corrections_count: 3,
              created_at: '2026-10-17T04:00:00Z',
            },
            {
              id: 11,
              title: 'Queued report',
              status: 'queued',
              provider: 'fake',
              model: 'fake-v1',
              corrections_count: 0,
              created_at: '2026-10-17T03:00:00Z',
            },
            {
              id: 10,
              title: 'Failed report',
              status: 'failed',
              provider: 'openai',
              model: 'gpt-test',
              corrections_count: 0,
              created_at: '2026-10-17T02:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            per_page: 20,
            total_count: 3,
            total_pages: 1,
            has_previous: false,
            has_next: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

  render(
    <MemoryRouter initialEntries={['/reports']}>
      <App />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('link', { name: 'Completed report' })).toHaveAttribute('href', '/reports/12')
  expect(screen.getByRole('link', { name: 'Failed report' })).toHaveAttribute('href', '/reports/10')
  expect(screen.queryByRole('link', { name: 'Queued report' })).not.toBeInTheDocument()
  expect(screen.getByText('3 corrections')).toBeVisible()
})

test('queued report detail shows a status message without polling', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 7, email: 'learner@example.com' },
          csrf_token: 'csrf-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 12,
          title: 'Queued report',
          status: 'queued',
          provider: 'fake',
          model: 'fake-v1',
          corrections_count: 0,
          created_at: '2026-10-17T03:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

  render(
    <MemoryRouter initialEntries={['/reports/12']}>
      <App />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'Queued report' })).toBeVisible()
  expect(screen.getByText('Your review is queued.')).toBeVisible()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
