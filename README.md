# Tamalife

**Keep your expenses alive.**

Tamalife is a Tamagotchi for your subscriptions, bills, warranties, and recurring expenses. Every recurring cost becomes a small creature whose health tracks how well the underlying commitment is being managed. When a renewal is coming up, a warranty is about to lapse, or a price quietly goes up, the matching creature gets sick. Renewing, cancelling, disputing, or updating the details brings it back to life, and your dashboard shows the money you saved or reclaimed.

The goal is simple: turn boring financial admin into something you actually want to check on, and use a model to remove the data-entry work so a receipt becomes a tracked item in a couple of taps.

Built for the [OpenAI Codex Hackathon](https://openai.devpost.com/).

## What it actually does

- **Receipt parsing.** Paste text, snap a photo, or pick a document. The backend extracts merchant, price, billing cycle, renewal date, and warranty expiry into a structured record you confirm before it is saved.
- **Derived creature health.** Health, mood, "needs attention" state, and days remaining are computed from the real dates on every request. They are never stored as mutable state, so a creature is always an honest read of the current situation.
- **Resolve flow.** Open a sick creature, review the renewal or warranty, then renew, cancel, snooze, or update it. The action is recorded and the revive animation plays.
- **Price-increase detection.** A backend price-intelligence pipeline monitors approved sources for plan and pricing changes, flags increases on tracked subscriptions, and surfaces recommendations.
- **Reminders and push.** Renewal and warranty thresholds are scanned on a schedule and delivered as push notifications through Firebase Cloud Messaging.
- **Dashboard and insights.** Home, Garden, and Insights screens summarize recurring spend, upcoming renewals, and creatures that need attention.
- **Home-screen widget.** An opaque widget token backs a lightweight summary endpoint for at-a-glance status outside the app.

## How OpenAI is used

Two distinct places, both structured rather than free-text generation:

1. **Extraction.** The parsing service uses the OpenAI Responses API with Pydantic Structured Outputs. Receipt text, or a base64 image at high detail, goes in; a validated schema (price, dates, billing interval, warranty) comes out. Every parse records its prompt version, payload, confidence, and status. Validation failures are retried once and then marked `needs_review` instead of guessing. A deterministic heuristic extractor is the local default so the app runs offline without an API key (text only; image parsing needs OpenAI).
2. **Price-source discovery.** An optional bounded discovery task uses a model to propose candidate pricing sources. Discovered sources never go live automatically; they go through a manual approval workflow before monitoring runs.

Codex was used through development to build the parsing pipeline, the pure domain functions for health and pricing, the Celery task layer, and the backend and mobile integration.

## Tech stack

**Frontend** (`frontend/`)
- Expo / React Native + TypeScript, Expo Router
- Clerk for auth (`@clerk/expo`)
- Firebase Cloud Messaging + Expo Notifications for push
- Image and document pickers for receipt capture, plus print and share
- React Native Reanimated + `react-native-svg` for the procedural creatures
- Zustand for state
- Plus Jakarta Sans and Pixelify Sans (the pixel type carries the Tamagotchi feel)

**Backend** (`backend/`)
- FastAPI, managed with `uv`
- SQLAlchemy + Alembic (SQLite locally, PostgreSQL on Supabase in production)
- Clerk session-token verification and signed Clerk webhooks
- OpenAI Responses API for extraction, heuristic fallback
- Redis + Celery worker and beat for reminders, price monitoring, and cleanup
- Supabase Storage for receipts; RLS-hardened schema where FastAPI is the only data path

## Repo layout

```
frontend/   Expo (React Native) app
backend/    FastAPI service (Clerk auth, Supabase, OpenAI extraction, Celery)
```

Each folder is self-contained with its own dependencies and `.gitignore`.

## Run the frontend

```bash
cd frontend
npm install
npx expo start
```

Press `a` for Android, `i` for the iOS simulator, or scan the QR code with a dev build. Push notifications and native Firebase require a development build rather than Expo Go.

## Run the backend

```bash
cd backend
uv sync
cp .env.example .env          # set the Clerk key and database, or disable auth for local
uv run alembic upgrade head
uv run tamalife-seed
uv run uvicorn tamalife_backend.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. Local defaults are SQLite, local receipt storage, and the heuristic extractor. See [`backend/README.md`](backend/README.md) for the full configuration, and [`backend/docs/PRICE_INTELLIGENCE.md`](backend/docs/PRICE_INTELLIGENCE.md) for the price-intelligence deployment and approval workflow.

### Full stack with Docker

From the repository root:

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, the API, a Celery worker, and Celery beat, running Alembic migrations before the API comes up.

### One-shot price scrape (no Redis or Celery)

```bash
cd backend
uv run tamalife-scrape-once --force      # add --discover for bounded OpenAI source discovery
```

## Key API routes

- `GET /health`, `GET /ready`, `GET /v1/me`
- `GET/POST /v1/subscriptions`, `GET/PATCH/DELETE /v1/subscriptions/{id}`, `PATCH /v1/subscriptions/{id}/resolve`
- `POST /v1/parse` (multipart, one `text` or `image` field), `GET /v1/parse/{id}`, `POST /v1/parse/{id}/confirm`
- `GET/PATCH /v1/notification-preferences`
- `POST /v1/widget/token`, `GET /v1/widget/summary`
- `POST /v1/webhooks/clerk` (public, Svix signature verified)

## Design decisions worth knowing

- Health, mood, days remaining, and normalized costs are computed response fields, never database state.
- Resolution and reminder history is append-only; deletes archive rather than destroy, so the record stays auditable.
- Date, health, mood, price-increase, and reminder math are pure domain functions with an injected clock, which keeps them deterministic and testable.
- Widget tokens are opaque; only their SHA-256 hashes are stored.
- Reminders persist one delivery per threshold and channel before queueing; Celery retries use exponential backoff with jitter and land exhausted deliveries in a queryable dead-letter state.

## Frontend structure

```
app/                  Expo Router routes
  index.tsx           Animated launch screen
  (auth)/             Welcome, sign-up, garden reveal
  (tabs)/             Home, Garden, Insights, Profile + floating Add button
  add/                Add flow: chooser, paste, manual, review, success
  creature/[id].tsx   Creature detail + resolve/revive flow
  edit/[id].tsx       Edit a tracked item
components/
  creatures/          Procedural SVG creature renderer (see below)
  dashboard/          Garden hero, financial summary, quick actions
  price/              Price-intelligence UI
  subscription/       Cards, health meter, mood badge, resolution sheet
  onboarding/         Onboarding shell and companion
  ui/                 Button, Card, Chip, BottomSheet, Toast, Screen, etc.
lib/                  API client, mappers, push notifications, price-intelligence hooks
store/                Zustand stores
constants/theme.ts    Colors, typography, spacing, radii
```

## How the procedural creatures work

`components/creatures/Creature.tsx` is the single public interface:

```tsx
<Creature species="ember" mood="sick" size="large" interactive onPress={...} />
```

Internally it composes:

- **`bodies.tsx`** — one SVG body per species (cloud, sprout, blob, ember, egg, gem) in a 120x120 viewBox, with radial gradients and highlights that fake 3D volume.
- **`palettes.ts`** — a base palette per species, desaturated toward grey when sick or critical and tinted violet when resolved.
- **`CreatureFace.tsx`** — eyes, brows, cheeks, and mouth as animated views (random blinking, droopy eyes when sick, closed eyes when resolved).
- **`CreatureShadow.tsx` / `CreatureParticles.tsx`** — soft ground shadow and floating mood particles.
- **`Creature.tsx`** — Reanimated idle breathing, sick shivering, droop, tap pop, and drag tilt.

Everything (posture, saturation, breathing speed, particles) is driven by the `mood` prop, and each screen recomputes mood from the item's current state.

### Adding a species

1. Add the name to `CreatureSpecies` in `types/subscription.ts`.
2. Add a base palette in `components/creatures/palettes.ts`.
3. Add a body in `components/creatures/bodies.tsx` and register it in `bodyBySpecies`.

Every mood, size, and animation then works automatically. The visual layer sits entirely behind `Creature.tsx`'s props, so swapping in Rive or a 3D renderer later means changing one file and nothing else.

## Notes

- Dark theme by design.
- Reduced motion respects the OS setting and has a manual toggle in Profile.
- `data/mockSubscriptions.ts` holds demo subscriptions and a demo receipt, so the app can be explored without a backend before wiring up the API.

## Team

Avneet Nijjer, Pranoy, Paramveer, Kartik.

## License

See [`LICENSE`](LICENSE).
