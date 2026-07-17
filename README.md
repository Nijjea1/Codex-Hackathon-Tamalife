# Tamalife

**Keep your expenses alive.**

# Codex-Hackathon-Tamalife
A Tamagotchi for your subscriptions, bills, warranties and recurring expenses.

Tamalife transforms the way people manage recurring finances by turning every subscription, bill, or warranty into a living digital companion. Instead of relying on easy-to-ignore reminders, each item is represented by a unique creature whose health reflects how well it's being managed. As renewal dates, warranty expirations, or price increases approach, neglected creatures become sick or wilt. Taking action—renewing, cancelling, disputing, or updating information—brings them back to life.

Using OpenAI models, Tamalife can intelligently extract structured information from receipts, invoices, and confirmation emails, automatically identifying renewal dates, billing cycles, prices, and warranty expirations with minimal user input.

✨ Features
🪴 Interactive creature-based subscription tracking
🤖 AI-powered receipt and email parsing
📅 Automatic renewal and warranty detection
❤️ Dynamic creature health based on real-world dates
📊 Personalized dashboard for subscriptions and recurring expenses
🔔 Smart reminders and proactive financial insights
📈 Price increase detection and spending analysis

🛠️ Tech Stack
Frontend: React Native (Expo) + TypeScript
Backend: Supabase
Database: PostgreSQL (Supabase)
AI: OpenAI API
Animations: React Native Reanimated + Lottie

🚀 Built for the OpenAI Codex Hackathon

Tamalife is being developed as part of the OpenAI Codex Hackathon, showcasing how AI can solve a real-world consumer problem through intelligent automation, natural language understanding, and an engaging user experience.

Rather than simply generating text, Codex is being used throughout development to help build parsing pipelines, state management logic, backend integrations, and application architecture.

👥 Team
Avneet Nijjer
Pranoy
Paramveer
Kartik

## Run it

```bash
npm install
npx expo start
```

Then press `a` for Android, `i` for iOS simulator, or scan the QR code with Expo Go.

## Demo walkthrough

1. Launch → animated seed-egg logo (skippable).
2. Welcome → "Start my garden" begins the Duolingo-style onboarding (5 steps, one question per screen).
3. Choose a starter creature (Sprout / Glint / Puff), then mocked sign-up ("Explore demo first" works too).
4. Garden reveal → Home dashboard with 5 demo subscriptions.
5. Open **Flick** (sick, renews tomorrow) → "Review renewal" → "Cancel subscription" → watch the revive animation and the recurring spend drop.
6. Tap the **+** tab → "Paste receipt or email" → "Use demo receipt" → "Find subscription" → review the extracted fields → "Create creature" → watch **Nova** hatch and find it in the Garden.

## Project structure

```
app/                  Expo Router routes
  index.tsx           Animated launch screen
  (auth)/             Welcome, onboarding (5 screens), sign-up, garden reveal
  (tabs)/             Home, Garden, Insights, Profile + floating Add button
  add/                Add flow: chooser, paste, manual, review, hatch sequence
  creature/[id].tsx   Creature detail + resolve/revive flow
  subscription/[id]   Redirects to creature detail
components/
  creatures/          Procedural creature renderer (see below)
  onboarding/         Shell, option cards, progress bar, reacting companion
  subscription/       Cards, health meter, mood badge, resolution sheet
  dashboard/          Garden hero, financial summary, quick actions, win card
  ui/                 Button, Card, Chip, BottomSheet, Toast, Screen, etc.
constants/theme.ts    Colors, typography, spacing, radii
data/mockSubscriptions.ts   The five demo subscriptions + demo receipt text
store/                Zustand stores (auth, subscriptions, UI)
types/subscription.ts All shared types
utils/creatureMood.ts Mood logic, health meta, formatting helpers
```

## How the procedural creatures work

`components/creatures/Creature.tsx` is the single public interface:

```ts
<Creature species="ember" mood="sick" size="large" interactive onPress={...} />
```

Internally it composes:

- **`bodies.tsx`** — one SVG body per species (cloud, sprout, blob, ember, egg, gem) drawn in a 120×120 viewBox with radial gradients and highlights that fake 3D volume.
- **`palettes.ts`** — a base palette per species, desaturated toward grey for sick/critical moods and tinted violet for resolved.
- **`CreatureFace.tsx`** — eyes, brows, cheeks and mouth as animated views (random blinking, droopy eyes when sick, closed eyes when resolved).
- **`CreatureShadow.tsx` / `CreatureParticles.tsx`** — soft ground shadow and floating mood particles.
- **`Creature.tsx`** — Reanimated idle breathing, sick shivering, droop, tap pop reaction, and gesture-based drag tilt.

Mood behaviour (posture, saturation, breathing speed, particles) is driven entirely by the `mood` prop, and every screen recomputes mood from subscription state.

## Where the mock data lives

`data/mockSubscriptions.ts` — five complete subscriptions (Cloudy, Moss, Wobble, Flick, Pip) plus the demo receipt used by the paste flow. The Zustand store in `store/useSubscriptionStore.ts` seeds from this file and handles resolve/cancel/snooze/add.

## Adding another creature species

1. Add the species name to `CreatureSpecies` in `types/subscription.ts`.
2. Add a base palette in `components/creatures/palettes.ts`.
3. Add a body component in `components/creatures/bodies.tsx` and register it in `bodyBySpecies`.

That's it — every mood, size, and animation works automatically.

## Replacing procedural creatures with Rive or true 3D later

The whole visual layer is behind `Creature.tsx`'s props (`species`, `mood`, `size`, `interactive`, `onPress`). To upgrade:

- **Rive**: map `mood` to a state-machine input, render a `<Rive>` view per species instead of `bodyBySpecies[species]`, and keep the face/particles off.
- **GLB / React Three Fiber / Expo GL**: replace the SVG body with a `<Canvas>` rendering the model; drive mood via animation clips.

No screen outside `components/creatures/` needs to change.

## Notes

- Dark theme only by design; typography is Plus Jakarta Sans via Expo Google Fonts.
- Reduced motion: respects the OS setting and has a manual toggle in Profile.
- No backend, no env vars, no external assets — everything runs offline in Expo Go.
