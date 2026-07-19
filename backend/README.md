# Tamalife Backend

FastAPI service for Tamalife. It is the **only** component that holds
credentials for Clerk (and, later, Postgres, Redis, OpenAI, Storage). Clients
talk to it over HTTP/JSON only — never to those services directly.

This is the **auth slice**: Clerk session-token verification, a public health
check, and a protected `/me` endpoint. Database, AI, and background jobs are
separate workstreams that plug into the seams described below.

## Requirements

- Python 3.12
- [uv](https://docs.astral.sh/uv/) (`pip install uv` or `winget install astral-sh.uv`)
- (Optional) Docker, for the containerized run

## Setup

```bash
cd backend
uv sync                 # create .venv and install deps from uv.lock
cp .env.example .env     # then paste your Clerk Secret Key into .env
```

Fill in `.env`:

| Variable | What it is |
|---|---|
| `CLERK_SECRET_KEY` | Clerk backend Secret Key (`sk_test_...`). The only Clerk value the backend needs. |
| `CLERK_AUTHORIZED_PARTIES` | Blank in dev. In prod, comma-separated allowed `azp` values. |
| `CORS_ORIGINS` | Browser origins allowed to call the API (Expo web / tools). |
| `ENVIRONMENT` | `development` / `staging` / `production`. |

## Run

```bash
uv run uvicorn app.main:app --reload --port 8000
# or, containerized:
docker compose up --build
```

- Interactive API docs: http://localhost:8000/docs
- Health: http://localhost:8000/v1/health

## Test

```bash
uv run pytest
```

Tests mock Clerk's SDK so they run fully offline.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | public | Service name + version |
| GET | `/v1/health` | public | Liveness check |
| GET | `/v1/me` | Clerk bearer | Returns the verified caller's identity |

Send auth as `Authorization: Bearer <clerk_session_token>`.

## Project layout

```
app/
  main.py            App factory: CORS, logging, router, error handlers
  config.py          Typed env settings (pydantic-settings)
  core/
    security.py      Clerk verification + get_current_user dependency  ← auth lives here
    errors.py        Consistent {"error": {...}} envelope
    logging.py       JSON logs + X-Request-ID middleware
  schemas/auth.py    CurrentUser + response/error models
  services/users.py  get_or_create_user() — the DB seam (stubbed)
  api/v1/            Versioned routes (health, me)
tests/               Offline tests (Clerk SDK mocked)
```

## How auth works

1. The mobile app signs the user in with Clerk and gets a session token.
2. It calls this API with `Authorization: Bearer <token>`.
3. `core/security.py` hands the request to Clerk's SDK, which verifies the
   token against Clerk's JWKS (cached — networkless after the first fetch).
4. Verified → routes receive a typed `CurrentUser`. Otherwise → `401`.

Verification is isolated in `core/security.py`. Swapping the Clerk SDK for raw
PyJWT + JWKS later touches only that file.

## Seams for other workstreams

- **Database (Supabase/SQLAlchemy):** implement `services/users.py::get_or_create_user`
  to map `clerk_user_id` → an internal `users` row (fetching email from Clerk's
  Backend API, since the session token doesn't include it).
- **Background jobs (Celery):** add a worker/beat entrypoint from the same
  Docker image.
- **AI (`/v1/parse`), rate limiting, caching:** new routers under `app/api/v1/`.
