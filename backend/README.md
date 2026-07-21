# Tamalife Backend

FastAPI backend for subscriptions, bills, warranties, receipt extraction, derived creature
health, reminders, and widget summaries. The project is managed by `uv` and lives separately
from the Expo application.

## Authentication status

Clerk session-token authentication protects user-scoped API routes. The Expo client sends its
session token as `Authorization: Bearer <token>`; the backend verifies it with Clerk and maps the
stable `sub` claim to a unique `users.clerk_user_id` record. `GET /v1/me` verifies the complete
mobile-to-backend identity chain.

Set `TAMALIFE_CLERK_SECRET_KEY` only on the backend. Optionally restrict token `azp` claims with
`TAMALIFE_CLERK_AUTHORIZED_PARTIES`, especially in production. Authentication can be disabled
for offline tests/local tooling with `TAMALIFE_CLERK_AUTH_ENABLED=false`; production rejects that
configuration. In that mode only, `X-User-ID` can select a development tenant.

Configure a Clerk webhook endpoint at `https://<api-host>/v1/webhooks/clerk`, subscribe it to
`user.created`, `user.updated`, and `user.deleted`, and store its signing secret as
`TAMALIFE_CLERK_WEBHOOK_SIGNING_SECRET`. Deliveries are signature-verified, recorded by unique
event ID, and safely ignored after successful processing. User deletion disables the local user
and uses `TAMALIFE_CLERK_DELETED_USER_POLICY=anonymize` by default to remove denormalized PII.
Just-in-time creation remains enabled so webhook delay never blocks a valid first request.

The Clerk Dashboard still owns environment-specific identity policy: use separate development
and production instances, enable the Native API, configure email verification and the chosen
password/passwordless policy, enable Google, enable Apple before iOS release, and allowlist the
actual Expo/deep-link redirect URLs. Keep publishable keys per frontend environment and all
secret/webhook keys in backend deployment secrets.

## Quick start

```powershell
cd backend
uv sync
Copy-Item .env.example .env
# Replace the Clerk placeholder and configure the database before continuing.
uv run alembic upgrade head
uv run tamalife-seed
uv run uvicorn tamalife_backend.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. SQLite, local receipt storage, and a deterministic heuristic
extractor are the local defaults; Clerk requires a backend secret unless explicitly disabled.

Run verification:

```powershell
uv run ruff format --check .
uv run ruff check .
uv run mypy src
uv run pytest --cov
```

For a hackathon/demo run without Redis or Celery, use the direct one-shot command:

```powershell
uv run tamalife-scrape-once --force
```

It safely monitors approved active sources and refreshes matches/recommendations in the current
process. Add `--discover` to run bounded OpenAI candidate discovery. Discovery never bypasses
source review; see `docs/PRICE_INTELLIGENCE.md` for the approval workflow and all options.

## PostgreSQL and Redis locally

From the repository root:

```powershell
docker compose up --build
```

This starts PostgreSQL, Redis, the API, a Celery worker, and Celery beat. The container runs
Alembic before starting the API.

## Supabase setup

The production price-intelligence deployment and incident runbook is in
[`docs/PRICE_INTELLIGENCE.md`](docs/PRICE_INTELLIGENCE.md).

1. Create separate Supabase projects for staging and production.
2. Create a private Storage bucket named `receipts`.
3. Use the direct PostgreSQL connection for Alembic migrations. Use the direct connection or
   Supavisor session pool for a persistent API, depending on deployment network support.
4. Create a least-privileged database role for application runtime.
5. Set `TAMALIFE_DATABASE_URL` and `TAMALIFE_MIGRATION_DATABASE_URL`.
6. Set `TAMALIFE_STORAGE_BACKEND=supabase`, `TAMALIFE_SUPABASE_URL`, and the server-only
   `TAMALIFE_SUPABASE_SERVICE_KEY`.
7. Never put the database password or service key in the Expo application.

Alembic is the application-schema source of truth. Supabase provides hosted PostgreSQL and
Storage; dashboard table edits should be avoided because they create migration drift. The
application schema contains:

- `users`
- `subscriptions`
- `subscription_events`
- `parsed_receipts`
- `notification_preferences`
- `idempotency_keys`
- `widget_tokens`
- `clerk_webhook_events`

`clerk_webhook_events` provides webhook deduplication storage; session authentication itself is
handled by Clerk token verification. No Supabase SQL migration duplicates these application
tables; the only SQL bootstrap file creates the private Storage bucket.

The hardening migration enables RLS on these public-schema tables and revokes direct access from
Supabase `anon` and `authenticated` roles. It intentionally creates no client policies: FastAPI's
database owner/service credential is the only application data path and must never reach Expo.

## OpenAI extraction

Set:

```dotenv
TAMALIFE_EXTRACTION_PROVIDER=openai
TAMALIFE_OPENAI_API_KEY=...
TAMALIFE_OPENAI_MODEL=gpt-5.6
```

The extractor uses the Responses API with Pydantic Structured Outputs. Images are supplied as
base64 data URLs at explicit high detail. Each parse records its prompt version, payload,
confidence, status, and errors. Failed validation is retried once and then marked
`needs_review`.

For local development, keep `TAMALIFE_EXTRACTION_PROVIDER=heuristic`. It parses common amounts,
ISO dates, and billing intervals without network access. Image extraction requires OpenAI.

## Main routes

- `GET /health`, `GET /ready`
- `GET /v1/me`
- `POST /v1/webhooks/clerk` (public endpoint with Svix signature verification)
- `GET/POST /v1/subscriptions`
- `GET/PATCH/DELETE /v1/subscriptions/{id}`
- `PATCH /v1/subscriptions/{id}/resolve`
- `POST /v1/parse` as multipart form with exactly one `text` or `image` field
- `GET /v1/parse/{id}`
- `POST /v1/parse/{id}/confirm`
- `GET/PATCH /v1/notification-preferences`
- `POST /v1/widget/token`
- `GET /v1/widget/summary` with the widget bearer token

## Design decisions

- Health, mood, attention state, days remaining, and normalized costs are computed response
  fields, never mutable database state.
- Resolution and reminder history is append-only in `subscription_events`.
- Deletes archive subscriptions so history remains auditable.
- Widget tokens are random opaque credentials; only SHA-256 hashes are stored.
- Redis is optional locally and used for widget caching and distributed parse rate limits when
  enabled.
- Reminder scanning persists one delivery per renewal threshold and enabled channel before it is
  queued. Celery retries use exponential backoff with deterministic jitter; exhausted deliveries
  remain queryable in the `dead_letter` state. Processing leases let beat recover work after a
  worker or broker interruption.
- The development `log` reminder provider performs no external delivery. Production should set
  `TAMALIFE_REMINDER_DELIVERY_ENABLED=true`, select the `webhook` provider, and configure its URL
  and bearer token. Provider requests include stable `Idempotency-Key` and `X-Request-ID` headers.
- Date, health, mood, price-increase, resolution, cost, and reminder calculations are pure
  domain functions with an injected current date/time for deterministic behavior.
