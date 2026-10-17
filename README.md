# Vietnamese-to-English Translation Tutor

This repository contains a React/Vite frontend and a Rails JSON API. Local
development uses Docker Compose for the frontend, API, Solid Queue worker, and
PostgreSQL.

## Prerequisites

- Docker with the Compose plugin

## Start the development stack

```bash
cp .env.example .env
docker compose build
docker compose up -d db
docker compose run --rm api bin/rails db:prepare
docker compose run --rm api bin/rails db:seed
docker compose up
```

The explicit `db:prepare` step creates both the application and Solid Queue
databases. `db:seed` creates or updates the single login from `.env`. These
commands are intentionally not part of container startup.

- Frontend: <http://localhost:5173>
- API health check: <http://localhost:3000/up>

Vite proxies browser requests under `/api` to the Rails service. Both source
directories are bind-mounted, so Vite hot module replacement and Rails code
reloading work without rebuilding an image.

## Useful commands

```bash
docker compose exec api bin/rails test
docker compose exec frontend npm run build
docker compose exec frontend npm test
docker compose logs -f worker
docker compose down
```

The original static report prototype is preserved unchanged at
[`docs/report-reference.html`](docs/report-reference.html).

## Background report generation

Submitting a translation creates a queued report and enqueues a Solid Queue
job after the database transaction commits. The worker validates fake-provider
output against report schema `v1`, derives exact highlight offsets, and stores
the completed result. Refresh the report list manually to see the new status;
the application intentionally does not poll.

The default development configuration uses the deterministic `fake` provider
and `fake-v1` model, so no external API credentials are needed. Its sample
annotation recognizes the phrase `very big`; other text still produces a valid
zero-correction report.

## AI providers

Keep `AI_PROVIDER=fake` for deterministic local development and tests. To run a
real provider, set one provider, its model, and its API key in `.env`:

| Provider | `AI_PROVIDER` | Required settings |
| --- | --- | --- |
| OpenAI | `openai` | `AI_MODEL`, `OPENAI_API_KEY` |
| DeepSeek | `deepseek` | `AI_MODEL`, `DEEPSEEK_API_KEY` |
| Anthropic | `anthropic` | `AI_MODEL`, `ANTHROPIC_API_KEY` |

The corresponding `*_BASE_URL` values normally keep the defaults shown in
`.env.example`; they can point to a compatible proxy for development. All
providers use `AI_REQUEST_TIMEOUT_SECONDS`, which must be a positive integer.
Never commit populated keys.

The adapters follow the providers' current native structured-output APIs:
[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses),
[DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/), and
[Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
The Rails validator remains authoritative and makes one repair request when a
provider returns syntactically valid JSON that fails report schema `v1` or its
highlight rules.

### Manual provider smoke test

After editing `.env`, recreate the API and worker so they receive the new
configuration:

```bash
docker compose up -d --force-recreate api worker
docker compose logs -f worker
```

Log in, submit a short known Vietnamese/English pair, and confirm the report
moves from queued to completed and renders its annotations. A bad key, unknown
model, or rejected request should produce a safely failed report without
showing provider response bodies in the UI. Restore `AI_PROVIDER=fake` and
`AI_MODEL=fake-v1` after the smoke test, then recreate the API and worker again.
