# Tamalife Backend

FastAPI backend for subscriptions, bills, warranties, receipt extraction, derived creature
health, reminders, and widget summaries. The project is managed by `uv` and lives separately
from the Expo application.

## Authentication status

Application authentication is deliberately **not implemented**. There is no Clerk dependency
or configuration. Local and test requests use the configured demo user. In non-production
environments, `X-User-ID: <uuid>` can select another test tenant. Production ignores that
header and uses the configured default user.

This is suitable for backend/mobile integration before an identity provider is selected. It is
not a multi-user production security boundary. Add real authentication before exposing mutating
routes to the public internet.

## Quick start

```powershell
cd backend
uv sync
Copy-Item .env.example .env
uv run alembic upgrade head
uv run tamalife-seed
uv run uvicorn tamalife_backend.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. SQLite, local receipt storage, and a deterministic heuristic
extractor are the local defaults, so no credentials are necessary.

Run verification:

```powershell
uv run ruff format --check .
uv run ruff check .
uv run mypy src
uv run pytest --cov
```

## PostgreSQL and Redis locally

From the repository root:

```powershell
docker compose up --build
```

This starts PostgreSQL, Redis, the API, a Celery worker, and Celery beat. The container runs
Alembic before starting the API.

## Supabase setup

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
Storage; dashboard table edits should be avoided because they create migration drift.

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
- Reminder scanning is idempotent through unique event keys.
