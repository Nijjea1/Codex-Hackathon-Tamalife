# Price intelligence operations

This runbook covers source discovery, controlled web fetching, catalog publication, review,
and authenticated user delivery. It is the deployment checklist for the scraper subsystem; it
does not replace the API design or Alembic migrations.

## Architecture and trust boundaries

```text
OpenAI web search -> untrusted candidate URLs -> evidence/confidence gate -> active pricing source
                                                                  |
Celery beat -> bounded lease scheduler -> Celery worker -> URL/DNS validation -> remote site
                                                          |
                                              extraction and deterministic diff
                                                          |
                  PostgreSQL catalog <- reviewed prices/deals -> authenticated user API
```

- Expo is untrusted and never receives a database password, Clerk secret, OpenAI key, Supabase
  service key, storage service key, lease token, or raw fetched page.
- FastAPI authenticates user routes with Clerk. Admin scraper routes additionally compare the
  authoritative Clerk `sub` to `TAMALIFE_CLERK_ADMIN_USER_IDS`; an empty list denies everyone.
- OpenAI output and every discovered URL are untrusted. A candidate is activated automatically
  only when it is HTTPS, first-party, grounded by its cited URL, on a known provider domain (or
  establishes a new provider domain at the configured high-confidence threshold). Everything
  else stays non-user-visible and is retried later.
- Remote HTTP is hostile input. The fetcher permits HTTP(S), rejects credentials and private or
  non-global addresses, resolves DNS, pins the connection target, revalidates redirects, limits
  redirects and bytes, and enforces connect/read/total timeouts. Do not add a generic proxy or
  user-supplied fetch endpoint.
- Redis is a broker/cache, not the system of record. PostgreSQL stores discovery idempotency,
  source leases, fetches, catalog state, reviews, matches, recommendations, and alerts.
- Alembic is the only schema migration authority. Never recreate application tables with
  Supabase dashboard SQL or a parallel Supabase migration tree.

## Feature flags and environment

Both scraper schedulers are default-disabled. Keep them disabled in local development, CI,
staging smoke tests, and a new production deployment until the rollout gates below pass.

| Variable | Default | Purpose |
| --- | ---: | --- |
| `TAMALIFE_DISCOVERY_ENABLED` | `false` | Adds monthly discovery to beat and permits its tasks. |
| `TAMALIFE_DISCOVERY_MODEL` | `gpt-5.6-luna` | OpenAI model used only for candidate discovery. |
| `TAMALIFE_DISCOVERY_PROMPT_VERSION` | `source-discovery-v1` | Stored prompt/audit version. |
| `TAMALIFE_DISCOVERY_INTERVAL_DAYS` | `30` | Discovery cadence; accepted range 7-90. |
| `TAMALIFE_DISCOVERY_MAX_PROVIDERS_PER_RUN` | `30` | Maximum providers dispatched by one monthly scan. |
| `TAMALIFE_DISCOVERY_MAX_SEARCHES_PER_PROVIDER` | `4` | Maximum web-search tool calls per provider. |
| `TAMALIFE_DISCOVERY_MAX_CANDIDATES_PER_PROVIDER` | `12` | Maximum persisted proposals per provider. |
| `TAMALIFE_DISCOVERY_MIN_AUTO_ACTIVATE_CONFIDENCE` | `0.92` | Minimum confidence for automatic first-party source activation. |
| `TAMALIFE_DISCOVERY_MONTHLY_COST_LIMIT_MICROS` | `25000000` | Monthly discovery budget in millionths of a dollar. |
| `TAMALIFE_DISCOVERY_COUNTRY` | `CA` | Default discovery market. |
| `TAMALIFE_DISCOVERY_CURRENCY` | `CAD` | Default discovery/extraction currency. |
| `TAMALIFE_OPENAI_API_KEY` | empty | Required only when discovery is enabled. Server secret. |
| `TAMALIFE_SCRAPER_MONITORING_ENABLED` | `false` | Adds periodic monitoring to beat and permits its tasks. |
| `TAMALIFE_SCRAPER_USER_AGENT` | Tamalife agent | Identifies controlled requests. Include a real contact URL in production. |
| `TAMALIFE_SCRAPER_CONNECT_TIMEOUT_SECONDS` | `5` | Connect timeout. |
| `TAMALIFE_SCRAPER_READ_TIMEOUT_SECONDS` | `15` | Read timeout. |
| `TAMALIFE_SCRAPER_TOTAL_TIMEOUT_SECONDS` | `25` | Whole-fetch timeout. |
| `TAMALIFE_SCRAPER_MAX_RESPONSE_BYTES` | `2097152` | Hard response-body limit. |
| `TAMALIFE_SCRAPER_MAX_REDIRECTS` | `3` | Redirect limit; every hop is revalidated. |
| `TAMALIFE_SCRAPER_SOURCE_BATCH_SIZE` | `25` | Maximum due sources leased by one scheduler pass. |
| `TAMALIFE_SCRAPER_SOURCE_LEASE_SECONDS` | `300` | Claim lifetime for worker recovery. |
| `TAMALIFE_SCRAPER_MISSING_PLAN_THRESHOLD` | `2` | Observations required before marking a missing plan inactive. |
| `TAMALIFE_SCRAPER_MONITOR_INTERVAL_SECONDS` | `3600` | Beat cadence; minimum 300 seconds. |
| `TAMALIFE_PRICING_EVIDENCE_STORAGE_BUCKET` | `pricing-evidence` | Reserved private bucket name for raw evidence retention. |
| `TAMALIFE_CLERK_ADMIN_USER_IDS` | empty | Comma-separated or JSON Clerk user-ID allowlist. Empty fails closed. |
| `TAMALIFE_PRICE_INTELLIGENCE_REFRESH_ENABLED` | `false` | Enables scheduled user matching and recommendation generation. |
| `TAMALIFE_PRICE_INTELLIGENCE_REFRESH_INTERVAL_SECONDS` | `3600` | Refresh cadence; minimum 300 seconds. |
| `TAMALIFE_PRICE_INTELLIGENCE_REFRESH_BATCH_SIZE` | `100` | Maximum eligible users dispatched per refresh scan. |

Celery also requires `TAMALIFE_REDIS_URL` or explicit `TAMALIFE_CELERY_BROKER_URL` and
`TAMALIFE_CELERY_RESULT_BACKEND`. Production sets all secrets in its secret manager, not in an
image, Compose file, repository, Expo variable, log line, or support ticket.

Recommended local flags:

```dotenv
TAMALIFE_ENVIRONMENT=local
TAMALIFE_CLERK_AUTH_ENABLED=false
TAMALIFE_DISCOVERY_ENABLED=false
TAMALIFE_SCRAPER_MONITORING_ENABLED=false
TAMALIFE_PRICE_INTELLIGENCE_REFRESH_ENABLED=false
TAMALIFE_STORAGE_BACKEND=local
```

Production must use `TAMALIFE_ENVIRONMENT=production`, Clerk authentication, explicit trusted
hosts/CORS origins, OpenAI receipt extraction, Supabase receipt storage, PostgreSQL, and secrets
from the deployment platform. Enable discovery and monitoring independently after validation.

## Supabase, Alembic, and RLS

Use the Supabase direct PostgreSQL URL for migrations. Use a direct runtime URL when the host has
IPv6 connectivity; otherwise use Supavisor **session mode**. Convert the scheme to
`postgresql+asyncpg://`. Do not put square brackets around a password. URL-encode reserved
characters in usernames and passwords.

PowerShell migration sequence from `backend/`:

```powershell
$env:TAMALIFE_MIGRATION_DATABASE_URL = "postgresql+asyncpg://postgres:<encoded-password>@<direct-host>:5432/postgres?ssl=require"
$env:TAMALIFE_DATABASE_URL = "postgresql+asyncpg://<runtime-role>:<encoded-password>@<runtime-host>:5432/postgres?ssl=require"
uv sync --locked
uv run alembic heads
uv run alembic upgrade head
uv run alembic current
uv run alembic check
```

Require one Alembic head. Back up PostgreSQL and record the current revision before production
migration. Run migrations as a release job exactly once; API, worker, and beat processes must
not race to migrate.

All application and catalog tables live in Supabase's exposed `public` schema. RLS must be
enabled and direct grants revoked for `anon` and `authenticated`, with no mobile-client policy,
because FastAPI is the only data plane. Verify after every migration:

```sql
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

The second query must return no application-table grants and every application/catalog row in
the first query must show `relrowsecurity = true`. If a newly added catalog table fails this
gate, stop rollout and add a forward Alembic hardening migration; do not repair it only in the
Supabase dashboard. The runtime database role needs only the operations used by FastAPI. The
Supabase service key can bypass RLS and stays server-side.

Create a private `receipts` Storage bucket for receipt uploads. `pricing-evidence` is reserved
for future raw source evidence and is not currently required by the fetch pipeline. If enabled,
create it as private, use randomized server-owned paths, short retention, and signed authorized
access only. Never expose a public bucket or permanent URL.

## Seed providers

`uv run tamalife-seed` creates only the local demo user; it does not seed providers. Provider
records are curated operational data. Insert a minimal reviewed list through `psql` or a
controlled data migration, using official domains and stable slugs:

```sql
insert into providers
  (id, name, slug, official_domain, category, active, policy_status, created_at, updated_at)
values
  (gen_random_uuid(), 'Example Provider', 'example-provider', 'example.com',
   'Entertainment', true, 'approved', now(), now())
on conflict (slug) do update set
  name = excluded.name,
  official_domain = excluded.official_domain,
  category = excluded.category,
  active = excluded.active,
  policy_status = excluded.policy_status,
  updated_at = now();
```

Do not seed aggregators, search result pages, shortened URLs, login pages, or domains without a
documented right to fetch. Set `active=false` to exclude a provider from discovery.

## One-shot demo without Redis or Celery

The one-shot runner executes the same database-backed services directly in one terminal process.
It needs neither Redis nor a Celery worker/Beat, and the three scheduler flags may remain false.

Monitor every due approved source, then refresh user matches and recommendations:

```powershell
uv run tamalife-scrape-once
```

For a demo, force an immediate check even when a source is not due:

```powershell
uv run tamalife-scrape-once --force
```

Run bounded OpenAI discovery for active providers without monitoring or refreshing users:

```powershell
uv run tamalife-scrape-once --seed-providers-from-subscriptions --discover --skip-monitor --skip-refresh
```

The seed option creates provider records from distinct existing subscription vendor names. It
does not guess official domains, approve candidates, or expose subscription data externally
except for the provider name supplied to the explicitly requested OpenAI discovery.

Discovery activates qualifying first-party candidates automatically. Low-confidence or unsafe
candidates stay non-user-visible for a later retry. The admin API remains available only for
incident response and source maintenance; normal operation needs no approval step.

```powershell
uv run tamalife-scrape-once --approve-candidate <candidate-uuid> --force --skip-refresh
```

Then generate automatic matches, recommendations, and durable alerts from the stored catalog:

```powershell
uv run tamalife-scrape-once --skip-monitor
```

Optional scoping arguments are `--provider-id`, `--source-id`, and `--user-id`. The command
prints a JSON report with counts and sanitized error types. It continues past an individual
provider/source/user failure and never prints secrets or upstream response bodies.

## Source lifecycle and incident controls

Set `TAMALIFE_CLERK_ADMIN_USER_IDS` to exact Clerk development IDs in staging and exact
production IDs in production. Never use email addresses, frontend roles, or unverified claims.
With an administrator session token:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/v1/admin/scraper/candidates?status=discovered&limit=50"

curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/v1/admin/scraper/candidates/$CANDIDATE_ID/approve"

curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"not an official first-party pricing page"}' \
  "https://api.example.com/v1/admin/scraper/candidates/$CANDIDATE_ID/reject"
```

Automatic activation verifies the provider domain, normalized URL, registrable domain,
first-party evidence, country/language/currency, page purpose, confidence, and cited search
evidence. Manual approval is an emergency recovery tool, not a normal operating requirement.

Lifecycle operations:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/v1/admin/scraper/sources/$SOURCE_ID/pause"
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/v1/admin/scraper/sources/$SOURCE_ID/resume"
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"replacement_source_id\":\"$REPLACEMENT_ID\"}" \
  "https://api.example.com/v1/admin/scraper/sources/$SOURCE_ID/supersede"
```

Pause first during investigation. A replacement must be active, backed by a verified/active
candidate, and match provider/country. The service prevents self-reference and cycles. Prefer
supersession to deletion so fetch evidence, plan history, and auditability remain intact.

High-confidence observations from trusted active sources are automatically `auto_approved` and
visible to users. Lower-confidence observations remain non-user-visible and are retried. Admin
review endpoints are reserved for incident recovery; a finalized observation cannot be flipped,
so generate a corrected observation instead.

## Run API, worker, and beat

Local Compose starts PostgreSQL, Redis, API, one worker, and one beat process with discovery and
monitoring disabled:

```powershell
docker compose up --build
docker compose ps
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/ready
```

For separate processes from `backend/`:

```powershell
uv run uvicorn tamalife_backend.main:app --host 0.0.0.0 --port 8000
uv run celery -A tamalife_backend.tasks.celery_app:celery_app worker --loglevel=INFO
uv run celery -A tamalife_backend.tasks.celery_app:celery_app beat --loglevel=INFO
```

The worker consumes the default `celery` queue and imports reminders, cleanup, discovery, and
source-monitoring task modules. Run exactly one beat instance per environment. Scale workers,
not beat. Verify broker and registration:

```powershell
uv run celery -A tamalife_backend.tasks.celery_app:celery_app inspect ping
uv run celery -A tamalife_backend.tasks.celery_app:celery_app inspect registered
uv run celery -A tamalife_backend.tasks.celery_app:celery_app inspect active
uv run celery -A tamalife_backend.tasks.celery_app:celery_app inspect reserved
```

Expected registered names include `tamalife.schedule_source_discovery`,
`tamalife.discover_provider_sources`, `tamalife.schedule_source_monitoring`, and
`tamalife.monitor_pricing_source`. Scheduler claims use bounded batches and PostgreSQL
`FOR UPDATE SKIP LOCKED`; workers commit or roll back and release matching leases. An expired
lease is recoverable on a later pass.

## Cost controls and staged enablement

Discovery is monthly-idempotent per provider/country/shard and checks persisted monthly cost
before calling OpenAI. Provider, search-call, candidate, and monthly-cost caps are independent;
keep all four bounded. Increasing cadence does not override monthly idempotency.

Roll out in this order:

1. Deploy with both flags false and verify migrations, RLS, API, Redis, worker registration, and
   logs.
2. Seed one non-critical provider in staging.
3. Temporarily enable discovery, observe one run, then disable it while reviewing every
   candidate and cost record.
4. Approve one pricing source and enable monitoring in staging with batch size 1 and a long
   interval.
5. Verify fetch limits, extracted catalog, review gating, and authenticated user isolation.
6. Enable production discovery for a small provider cap. Review candidates before activation.
7. Enable production monitoring at a small batch size, then increase gradually within remote
   site and infrastructure capacity.

Never increase the monthly budget as a first response to failures. A zero budget stops new
OpenAI discovery calls while preserving previous sources and catalog data.

## Monitoring and alert runbook

Logs are structured JSON and include request/task IDs. Secret, bearer-token, and database URL
password values are redacted. Search for these events:

- `source_discovery_completed`, `source_discovery_failed`,
  `source_discovery_schedule_failed`, `provider_source_discovery_failed`
- `source_monitoring_schedule_failed`, `pricing_source_monitoring_failed`
- repeated `stale_lease` or `not_claimed` task outcomes

The current `/v1/operations/metrics` endpoint is authenticated and in-process; it primarily
tracks receipt parsing and is not a durable Prometheus scraper metric store. Use centralized
JSON logs, Sentry, database health queries, and broker dashboards for production scraper alerts.
Do not assume a process-local counter survives restart or aggregates workers.

Useful database checks:

```sql
-- Discovery failures and monthly spend
select status, count(*), coalesce(sum(estimated_cost_micros), 0) cost_micros
from source_discovery_runs
where created_at >= date_trunc('month', now())
group by status;

-- Due, leased, and failing sources
select status,
       count(*) filter (where next_check_at <= now()) as due,
       count(*) filter (where lease_expires_at > now()) as leased,
       max(consecutive_failures) as max_failures
from pricing_sources
group by status;

-- Recent fetch outcomes
select status, count(*), max(created_at) latest
from source_fetches
where created_at >= now() - interval '24 hours'
group by status;

-- Pending human review backlog
select 'candidate' queue, count(*) from source_candidates where status in ('discovered','needs_review')
union all
select 'price', count(*) from plan_price_history where review_status = 'pending'
union all
select 'deal', count(*) from deals where review_status = 'pending';
```

Alert externally on: no beat heartbeat/scheduled tasks, broker unavailable, oldest due source age,
lease backlog older than two lease periods, failure-rate spikes by domain, response-size/timeout
rejections, discovery cost nearing 80%/100%, review backlog age, no successful fetches in an
expected window, database readiness failure, and unexpected RLS/grant drift. Never include raw
page content, URLs containing credentials, tokens, or service keys in alerts.

## Incident response and rollback

1. Set `TAMALIFE_DISCOVERY_ENABLED=false` and/or
   `TAMALIFE_SCRAPER_MONITORING_ENABLED=false`; restart beat and workers so all processes load the
   same configuration. The tasks also fail closed when invoked manually.
2. Pause affected sources. Preserve rows and structured logs for investigation.
3. For SSRF or unexpected egress, stop workers, restrict outbound networking, record source IDs
   and request IDs, validate DNS/redirect evidence, and resume only after a tested fix.
4. For bad catalog publication, reject pending observations, pause the source, approve a verified
   replacement, then supersede the old source. Do not delete history.
5. For cost spikes, disable discovery or set its monthly cost limit to zero. Monitoring existing
   sources does not require OpenAI discovery.
6. For leaked Clerk/OpenAI/Supabase/database credentials, revoke and rotate immediately, inspect
   access logs, redeploy every consumer, and verify the old secret fails. A Supabase service-key
   incident is high severity because it can bypass RLS.
7. Prefer application rollback plus a forward database fix. Do not run Alembic downgrade on
   production catalog migrations without a reviewed restore plan; downgrades may remove data.

User deletion/anonymization must continue through the Clerk webhook retention policy. Catalog
prices are global provider data, while matches, recommendations, alerts, subscriptions, receipts,
widget tokens, and identities are user data. Export/delete workflows must select by local user ID;
never weaken API ownership checks or add permissive RLS client policies to make deletion easier.

## Verification and rollout checklist

From `backend/`:

```powershell
uv sync --locked
uv run ruff format --check .
uv run ruff check .
uv run mypy src
uv run pytest --cov --cov-report=term-missing --cov-fail-under=70
uv run pytest tests/unit/test_safe_fetch.py tests/unit/test_scraper_discovery.py `
  tests/unit/test_source_monitoring.py tests/unit/test_source_monitoring_tasks.py `
  tests/unit/test_admin_scraper.py tests/integration/test_price_intelligence_api.py -q
uv run alembic upgrade head
uv run alembic check
```

CI also runs Gitleaks, exports the locked production dependency graph, runs `pip-audit` with
hashes, and builds the production image. Before enabling either flag, confirm:

- one Alembic head and a successful backup/restore drill;
- every public application/catalog table has RLS and no `anon`/`authenticated` grant;
- service/database/OpenAI/Clerk secrets are only in the deployment secret manager;
- a private receipts bucket exists; no public pricing evidence bucket exists;
- exact production Clerk admin IDs are configured and tested with allowlisted/non-allowlisted
  accounts;
- provider seed entries and right-to-fetch policy are reviewed;
- API `/health` and `/ready`, Redis, worker ping, task registration, and one beat instance pass;
- discovery/monitor flags are initially false and all cost/batch/time/byte limits are explicit;
- staging candidate review, source monitoring, review gating, supersession, and user ownership
  tests pass;
- Sentry/log/broker/database alerts and an on-call owner are configured;
- rollback consists of disabling flags, pausing/superseding sources, and deploying forward fixes.
