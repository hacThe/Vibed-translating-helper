# Vietnamese Translation Tutor — MVP Implementation Plan

## 1. Goal

Build a personal web application for a daily translation practice loop:

1. Log in.
2. Create a new exercise by pasting a Vietnamese article and selecting VN–ENG or VN–ZH.
3. Read the Vietnamese text and write the target-language translation in a side-by-side editor.
4. Submit the translation for AI review.
5. Return to the report list while the review runs in a background job.
6. Refresh the list manually and open the report once it is complete.
7. Read an annotated report based on the current static prototype.

The static report prototype at [`index.html`](./index.html) is the visual and content reference for report schema `v1`. Preserve it before scaffolding the React application; move it to a documentation/reference location if the Vite scaffold would overwrite it.

## 2. Confirmed scope

### Included

- React SPA written in TypeScript.
- Vite, React Router, and Tailwind CSS.
- Rails JSON API.
- PostgreSQL.
- Active Job with Solid Queue.
- Docker Compose for local development.
- Email/password login using one seeded user.
- No public signup.
- One local browser draft saved automatically in `localStorage`.
- Two fixed modes: Vietnamese to English and Vietnamese to Simplified Chinese.
- Background AI report generation.
- Fake, OpenAI, DeepSeek, and Anthropic/Claude providers.
- Previous-report list with simple pagination.
- Automated tests for the critical flow.

### Explicitly out of scope

- Production deployment configuration. Fly.io is a possible later target.
- Signup, password reset, email delivery, or account management UI.
- Fetching or scraping an article from its URL.
- Rich-text editing.
- Server-side draft management or multiple drafts.
- Editing a submitted translation.
- Resubmitting or versioning an article.
- Search, filtering, custom sorting, analytics, streaks, or progress tracking.
- Polling, WebSockets, or live status updates.
- A reverse proxy or production TLS configuration.
- Final optimization of the prompt or report design.

## 3. Repository layout

Use one repository with independent frontend and backend applications:

```text
Vn-to-english/
├── frontend/                 # React + TypeScript + Vite + Tailwind
├── backend/                  # Rails API
├── docs/
│   └── report-reference.html # Preserved current static prototype
├── compose.yaml
├── .env.example
├── README.md
└── IMPLEMENTATION_PLAN.md
```

Do not delete the current static prototype. Move it into `docs/` before generating files that would conflict with it.

## 4. Local containers

Docker Compose will define four services:

| Service | Purpose |
| --- | --- |
| `frontend` | Vite development server with source mounted for hot reload |
| `api` | Rails API server |
| `worker` | Same Rails image, running Solid Queue jobs |
| `db` | PostgreSQL with a persistent named volume |

Suggested development ports:

- Frontend: `5173`
- Rails: `3000`
- PostgreSQL: expose only if useful for local inspection; otherwise keep it internal to Compose.

Vite proxies `/api` to the Rails service. Browser requests therefore use the frontend origin, which simplifies cookie sessions and avoids a separate CORS flow in local development.

Use PostgreSQL for both the primary application database and Solid Queue. They may be separate logical databases on the same PostgreSQL container, following the Rails/Solid Queue database configuration.

Expected setup flow:

```bash
cp .env.example .env
docker compose up --build
docker compose exec api bin/rails db:prepare db:seed
```

Database migration and seed commands remain explicit; do not run them automatically every time a container starts.

## 5. Environment configuration

Document all variables in `.env.example` without real credentials.

Minimum application settings:

```dotenv
SEED_USER_EMAIL=
SEED_USER_PASSWORD=

AI_PROVIDER=fake
AI_MODEL=fake-v1

OPENAI_API_KEY=
OPENAI_BASE_URL=

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=

ANTHROPIC_API_KEY=

AI_REQUEST_TIMEOUT_SECONDS=120
```

Provider values should be a controlled enum such as `fake`, `openai`, `deepseek`, and `anthropic`. Validate required configuration at the point the provider is instantiated and return a clear job failure for missing credentials.

## 6. Authentication

Use session-based authentication with an encrypted, `HttpOnly`, `SameSite` cookie.

- `User` has `email` and `password_digest` and uses `has_secure_password`.
- There is no signup endpoint or UI.
- `db:seed` reads `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`.
- Seed is idempotent: create the email when missing; update its password when it already exists.
- A user can also be changed ad hoc through the Rails console/database.
- Add normal CSRF protection for state-changing session-authenticated requests.
- All report endpoints require authentication.
- Scope every report query to the current user. Return `404` for another user's report rather than revealing its existence.

Suggested session API:

```text
GET    /api/session       # Current authentication state and CSRF information
POST   /api/session       # Log in with email/password
DELETE /api/session       # Log out
```

## 7. Data model

The MVP deliberately uses only two domain models.

### User

Suggested columns:

```text
id
email                 unique, required, normalized
password_digest       required
created_at
updated_at
```

### Report

One submission creates one immutable report record. There is no separate `Article` model yet.

Suggested columns:

```text
id
user_id               required foreign key
title                  required, maximum 200 characters
mode                   vn_en | vn_zh_cn, required and immutable
source_url             optional
source_text            required, maximum 30,000 characters
translation_text       required, maximum 30,000 characters
status                 queued | processing | completed | failed
provider               required
model                  required
prompt_version         required; v1 legacy, vn_en_v1, or vn_zh_cn_v1
schema_version         required; v1 legacy, vn_en_v1, or vn_zh_cn_v1
result                 jsonb, empty/null until completed
corrections_count      integer, default 0
error_message          nullable; internal diagnostic, do not expose verbatim in UI
started_at             nullable
completed_at           nullable
failed_at              nullable
created_at
updated_at
```

Add indexes for:

- `user_id, created_at DESC`
- `status`

The four input fields are snapshots. Once submitted, they do not change.

## 8. Report lifecycle

Valid transitions:

```text
queued → processing → completed
                    ↘ failed
```

Creation flow:

1. Validate the input.
2. Create `Report(status: queued)` with the current provider, model, prompt version, and schema version.
3. Enqueue the generation job only after the transaction commits.
4. Return the report metadata.
5. React redirects to the report list.

Job flow:

1. Change `queued` to `processing` and set `started_at`.
2. Call the selected AI adapter.
3. Parse and validate schema `v1`.
4. If formatting or semantic validation fails, make one repair request.
5. If valid, store `result`, calculate `corrections_count`, set `completed_at`, and transition to `completed` atomically.
6. If unrecoverable, store a sanitized diagnostic in `error_message`, set `failed_at`, and transition to `failed`.

Network timeout, rate-limit, and provider 5xx errors get at most two retries after the initial attempt, using exponential backoff. Authentication errors, unknown models, and invalid requests fail immediately. Each provider request has a default timeout of 120 seconds.

Make retries idempotent. A retried job must not regenerate or overwrite a report that is already `completed`.

## 9. Report JSON schema `v1`

The exact JSON Schema should live in the backend and be covered by tests. The frontend TypeScript type should mirror it.

A practical shape is:

```json
{
  "schema_version": "v1",
  "revised_title": "...",
  "paragraphs": [
    {
      "index": 1,
      "translation_text": "Exact submitted paragraph text",
      "revised_text": "...",
      "notes": [
        {
          "original_text": "Exact substring from translation_text",
          "occurrence": 1,
          "correction": "...",
          "category": "meaning",
          "explanation_en": "...",
          "note_vi": "..."
        }
      ]
    }
  ],
  "revised_article": "...",
  "key_lessons": [
    {
      "title": "...",
      "explanation": "...",
      "example": "..."
    }
  ],
  "editing_checklist": [
    {
      "title": "...",
      "description": "..."
    }
  ]
}
```

Allowed correction categories:

```text
meaning
diction
grammar
detail
```

`occurrence` is one-based and disambiguates repeated identical text inside a paragraph. The backend, not the model, derives highlight offsets after locating the requested occurrence.

### Semantic validation

Beyond JSON Schema validation, enforce all of the following:

- Report `schema_version` is `v1`.
- Paragraph indexes are unique, sequential, and map to submitted translation paragraphs.
- Each `translation_text` exactly matches its submitted paragraph.
- Every note's `original_text` occurs in its paragraph.
- The requested occurrence exists.
- Highlight ranges do not overlap.
- Category is one of the four supported values.
- Required strings are not blank.
- The response stays within reasonable array-size limits to prevent pathological output.

If semantic validation fails, provide the validation errors and previous output to the adapter's repair operation once. Never silently use fuzzy matching for highlights in `v1`.

## 10. AI provider architecture

Expose one backend interface, for example:

```ruby
generate_report(source_text:, translation_text:, title:, schema_version:, prompt_version:)
repair_report(previous_output:, validation_errors:, ...)
```

Implement:

- `FakeAdapter`
- `OpenAICompatibleAdapter` configured for OpenAI
- `OpenAICompatibleAdapter` configured for DeepSeek
- `AnthropicAdapter` configured for Claude

The orchestration/job layer must not contain provider-specific request shapes. Adapters translate the common request into each provider's API and return a common parsed candidate.

Use provider-native structured output/schema facilities when available. Do not assume every provider supports the same subset. The common backend validator remains authoritative for all providers.

The fake provider should return deterministic, valid schema `v1` output and pass through the same validation and persistence path. Tests may use a known fixture input so the fake adapter can return meaningful annotations; a safe fallback may return a valid report with no corrections.

Store the selected provider and model on the report at submission time so later environment changes do not alter report metadata.

## 11. API surface

Suggested routes:

```text
POST /api/reports
GET  /api/reports?page=1
GET  /api/reports/:id
```

### Create report

Request:

```json
{
  "report": {
    "title": "...",
    "source_url": "...",
    "source_text": "...",
    "translation_text": "..."
  }
}
```

Return created report metadata with `status: queued`. Do not wait for AI generation.

### List reports

- Scope to current user.
- Newest first.
- 20 per page.
- Provide minimal pagination metadata for Previous/Next.
- Each item includes ID, title, status, provider, model, corrections count, and timestamps.
- Do not include large source, translation, or result fields.

### Report detail

- For `completed`, return input snapshots and result schema `v1`.
- For `queued`, `processing`, or `failed`, return only safe metadata/status information needed for the status page.
- Never expose raw provider responses, API credentials, or internal exception details.

## 12. Frontend routes and behavior

Suggested routes:

```text
/login
/reports
/reports/new
/reports/:id
```

Use a protected-route boundary that checks the current session. Unauthenticated users go to `/login`.

### Login

- Email and password fields.
- Clear invalid-credentials message.
- Successful login goes to `/reports`.

### New translation

- Fields: title, optional source URL, source text, translation text.
- Desktop: source and translation in two side-by-side plain text areas.
- Mobile: stack the two areas.
- Preserve paragraph breaks; paragraphs are separated by blank lines.
- Show character counts and enforce 200/30,000 limits in the UI.
- Backend remains authoritative for validation.
- Autosave the four fields as a single versioned `localStorage` draft.
- Restore the draft when the page opens.
- Clear it only after the backend successfully creates the report.
- Disable duplicate submits while the request is in flight.
- On success, navigate to `/reports`.

### Report list

- Newest first, 20 items per page.
- Show title, submitted date, status, provider/model, and correction count when completed.
- Only `completed` rows are links.
- No polling. A normal refresh updates statuses.
- Previous/Next navigation only.

### Report detail

- Fetch by ID on initial page load only.
- If status is not `completed`, show a simple status-specific message. Do not poll.
- For `completed`, render schema `v1` using the static prototype as the reference:
  - `Your draft`: paragraph-by-paragraph translation with highlighted notes.
  - Filters: Meaning, Word choice, Grammar, Dates & details.
  - Teacher-note panel: You wrote, Try this instead, Why it works, and Vietnamese note.
  - Per-paragraph revised text.
  - `Revised version`: complete revised article and copy action.
  - `Key lessons`: lesson cards and editing checklist.
- Keep report rendering in a schema-version dispatcher so later report versions can coexist.

## 13. Error handling

User-facing states must cover:

- Invalid login.
- Expired/unauthenticated session.
- Form validation errors.
- Submission/network failure without clearing the local draft.
- Empty report list.
- Report not found.
- `queued`, `processing`, and `failed` direct-access messages.
- Unsupported report schema version.
- Completed report with invalid persisted data should show a safe rendering error and log the diagnostic server-side.

Do not show raw `error_message` content to the browser. The list/detail UI only needs a general failure message.

## 14. Testing strategy

### Rails

- Model validations and status enum/transitions.
- Idempotent seeded user behavior.
- Session login/logout and authorization.
- Report creation snapshots provider/model/version and enqueues after commit.
- Report list ownership, order, pagination, and response size.
- Report detail visibility for every status.
- Cross-user report access returns `404`.
- JSON Schema and semantic report validation.
- Exact occurrence lookup and overlapping-range rejection.
- Provider adapter contract tests using stubbed HTTP responses.
- Job success, repair success, permanent failure, transient retry, and idempotency.

### React

- Login validation and error state.
- Protected routes.
- New-report field limits.
- Local draft save, restore, and clear-after-success behavior.
- Report list only links completed items.
- Non-completed detail status messages.
- Schema `v1` report rendering, filters, note selection, and revised-version copy action.

### End-to-end

One critical test using the fake provider:

```text
seeded login
→ create a translation
→ submit
→ see queued report in list
→ run/process worker job
→ refresh list
→ open completed report
→ verify an annotation and revised version render
```

Do not test Tailwind class names or every static sentence.

## 15. Implementation milestones

### Milestone 1 — Preserve reference and scaffold

- Move the current static report page into `docs/report-reference.html`.
- Scaffold Vite React TypeScript frontend.
- Scaffold Rails in API mode.
- Add Tailwind and React Router.
- Add PostgreSQL and Docker Compose services.
- Verify all four containers start.
- Document local setup.

### Milestone 2 — Authentication and base API

- Add `User`, password hashing, seed, session endpoints, cookie configuration, and CSRF handling.
- Build login page and protected routing.
- Add request tests.

### Milestone 3 — Submission and history

- Add `Report` migration/model and validations.
- Add create, list, and detail APIs.
- Add new-translation editor and local draft behavior.
- Add paginated report list and direct-access status screens.
- Initially use fake/static job output if necessary.

### Milestone 4 — Report contract and background generation

- Define JSON Schema `v1` and matching TypeScript types.
- Implement semantic validator and highlight-range derivation.
- Configure Solid Queue and worker.
- Implement report state transitions and retry behavior.
- Implement deterministic fake provider.
- Complete end-to-end flow with fake provider.

### Milestone 5 — Report UI

- Translate the current static prototype into React/Tailwind components.
- Render annotated draft, notes, category filters, revised version, and lessons from JSON.
- Add schema-version dispatch.
- Add component tests for interactions.

### Milestone 6 — Real providers

- Implement OpenAI-compatible OpenAI adapter.
- Reuse/configure it for DeepSeek.
- Implement Anthropic adapter.
- Stub provider HTTP calls in tests.
- Verify schema repair and provider error classification.
- Document environment variables and manual smoke-test steps.

### Milestone 7 — Final verification

- Run backend, frontend, and end-to-end test suites.
- Build the frontend production bundle as a compile check.
- Rebuild containers from scratch.
- Walk through the acceptance criteria below.
- Update README with actual commands and known limitations.

## 16. MVP acceptance criteria

The MVP is complete when all of the following are true:

1. A fresh checkout can be started using the documented Docker commands.
2. The seeded user can log in; there is no signup path.
3. An unauthenticated user cannot access report APIs or protected pages.
4. A user can paste a source article and type a translation in the side-by-side editor.
5. Refreshing the editor restores the local draft.
6. Submitting valid input creates a queued report, clears the draft, and returns to the list.
7. The worker processes the report asynchronously through the fake provider.
8. The list shows status and only completed reports are clickable.
9. Directly opening an incomplete or failed report shows a message and never polls.
10. A completed report renders the core behavior of the static reference page from schema `v1`.
11. Highlighted text is an exact, non-overlapping substring of the submitted translation.
12. Invalid AI output gets one repair attempt and then fails safely.
13. OpenAI, DeepSeek, and Anthropic adapters conform to the same internal interface.
14. Reports record provider, model, prompt version, and schema version.
15. Report history is paginated newest-first at 20 items per page.
16. Critical Rails, React, and fake-provider end-to-end tests pass.

## 17. First task for the next session

Start with Milestone 1 only:

1. Inspect the workspace and confirm there are no user-owned files beyond this plan and the static prototype that would be overwritten.
2. Move the prototype to `docs/report-reference.html` without changing its content.
3. Scaffold the frontend and backend with pinned versions recorded in their lockfiles/Dockerfiles.
4. Create Docker Compose with the four agreed services.
5. Verify container startup and hot reload.
6. Stop and report the resulting structure, commands, and any scaffold decisions before moving into authentication.

Do not broaden the first build step into deployment, scraping, signup, report redesign, or progress features.
