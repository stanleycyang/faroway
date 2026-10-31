# Faroway

AI-powered travel planning — personalized day-by-day itineraries with hotels, activities, dining, and transport.

## Monorepo Structure

```
apps/
  web/       Next.js 16 — web frontend + API backend (deployed on Vercel)
  mobile/    Expo 54 + React Native — iOS/Android app (deployed via EAS)
packages/
  types/     Shared TypeScript types
  constants/ Shared destination data and image paths
  supabase/  Supabase client factory
  validation/ Zod schemas for API validation
  api-client/ HTTP client helpers
  tsconfig/  Base tsconfig configs
  eslint-config/ Shared ESLint rules
supabase/
  migrations/ SQL migrations (applied via `bun db:push`)
```

**Package manager:** Bun 1.4.4  
**Build system:** Turborepo

## Prerequisites

- [Bun](https://bun.sh) 1.4.4 (1.0.21–1.4.3 are affected by CVE-2026-111497)
- [Node.js](https://nodejs.org) ≥ 22.23.4 (for Expo tooling; Node 20 is EOL, and 22.x before 22.23.4 is affected by CVE-2026-111497)
- [Supabase CLI](https://supabase.com/docs/guides/cli) for local database
- [EAS CLI](https://docs.expo.dev/eas/) for mobile builds (`bun add -g eas-cli`)

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Set up environment variables
cp .env.example .env.local            # root (shared)
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
# Edit both .env.local files with your Supabase + API keys

# 3. Start local Supabase (requires Docker)
bun db:start
bun db:migrate   # apply all migrations

# 4. Run dev servers (web + mobile simultaneously)
bun dev

# Or individually:
bun dev:web      # Next.js on http://localhost:3000
bun dev:mobile   # Expo Metro bundler
bun dev:ios      # Open iOS simulator directly
```

## Environment Variables

### Web (`apps/web/.env.local`)

| Variable                        | Required | Description                                                                                                                                                            |
| ------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL                                                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase anon key (safe to expose)                                                                                                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes      | Service role key (server-only)                                                                                                                                         |
| `IP_HASH_SALT`                  | Prod     | Server-only HMAC salt for privacy-preserving distributed rate limits                                                                                                   |
| `NEXT_PUBLIC_BASE_URL`          | Prod     | Production URL for OG tags/sitemap                                                                                                                                     |
| `FAROWAY_BUILD_WITHOUT_BLOG_DB` | No       | Set to `1` only for a local `next build` that should publish an empty blog when Supabase is unreachable. Leave unset in production so a network error fails the build. |

AI planning uses Google Gemini through Vercel AI Gateway (`AI_GATEWAY_API_KEY` where explicit authentication is required). Flight searches use Duffel; hotel quotes use the separate LiteAPI sandbox flow.

See `apps/web/.env.example` for the full list including travel vendor API keys.

### Mobile (`apps/mobile/.env.local`)

| Variable                           | Required | Description                                 |
| ---------------------------------- | -------- | ------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`         | Yes      | Supabase project URL                        |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`    | Yes      | Supabase anon key                           |
| `EXPO_PUBLIC_API_URL`              | Dev      | Override backend URL (auto-detected in dev) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Auth     | Google OAuth web client ID                  |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Auth     | Google OAuth iOS client ID                  |

See `apps/mobile/.env.example` for the full list.

## Key Scripts

```bash
bun dev                   # Start all apps in dev mode
bun build                 # Build all packages + web
bun lint                  # ESLint across monorepo
bun type-check            # TypeScript across monorepo
bun test                  # Run all test suites
bun format                # Prettier format all files
bun check                 # type-check + lint + format check

# Database
bun db:start              # Start local Supabase (Docker)
bun db:stop               # Stop local Supabase
bun db:reset              # Reset + reseed local database
bun db:migrate            # Apply pending migrations
bun db:push               # Push local schema to remote
bun db:studio             # Open Supabase Studio at localhost:54323

# Mobile pre-launch check
bun release:check:mobile  # Validate env vars + EAS config + expo-doctor
```

## Architecture

### Web (`apps/web`)

Next.js App Router app that serves both the marketing/web frontend and the **entire API backend** used by the mobile app.

```
app/
  (marketing)/   Public pages: landing, blog, tools, legal
  (app)/         Authenticated app: trip detail, share pages
  api/
    trips/       Trip CRUD + generation trigger + SSE stream
    search/      Search state management
    itinerary/   Legacy direct-generation endpoint
    workflows/   Durable workflow trigger (Temporal-style)
    destinations/ Popular/trending destinations
    places/      Google Places autocomplete proxy
    user/        Profile management
    health/      Health check
lib/
  workflow/      Durable workflow runtime
  json-render/   Block-based itinerary renderer specs
  affiliates/    Travel integrations (Duffel, LiteAPI, Viator, GetYourGuide)
  security/      Rate limiting (KV-backed in prod, in-memory in dev)
workflows/
  plan-trip.ts   Main AI orchestration workflow
```

### Mobile (`apps/mobile`)

Expo Router (file-based routing) with Zustand state management and offline sync.

```
app/
  (tabs)/        Main tabs: Explore, Trips, Profile
  create/        Trip creation flow (destination → dates → preferences)
  trip/[id]      Trip detail view with streaming itinerary
  onboarding/    Welcome + login screens
hooks/
  useAuth.ts         Authentication (Google, Apple, anonymous)
  useStreamingItinerary.ts  SSE-based real-time generation
  useTrips.ts        Trip list + CRUD with offline queue
  useOfflineSync.ts  Sync queue management
stores/
  tripStore.ts   Zustand trip state
  userStore.ts   Zustand user/auth state
  promptStore.ts Trip creation form state
lib/
  json-render/   React Native itinerary block renderer
  offline/       AsyncStorage-backed persistence
```

### Database (Supabase)

PostgreSQL via Supabase with Row Level Security on all user tables.

Key tables: `users`, `trips`, `itineraries`, `searches`, `search_results`, `destinations`, `affiliate_clicks`, `push_tokens`, `notifications`.

## Deployment

Production releases require the [acceptance and cutover checks](docs/production-acceptance.md).
The main Git deployment hold does not block manual CLI deployment. Reconcile and
apply database changes in the reviewed dependency order; do not use a blanket
migration push for the pending production release.

### Web (Vercel)

```bash
bun deploy:web          # Deploy to production
bun deploy:web:preview  # Deploy preview

# Required Vercel environment variables (set in Vercel dashboard):
# - All variables from apps/web/.env.example marked as required
# - Follow the reviewed database/application cutover order before production
```

### Mobile (EAS)

```bash
bun deploy:mobile:dev       # Development build
bun deploy:mobile:preview   # Internal device build (iOS needs registered devices)
bun deploy:mobile:prod      # Store build for TestFlight/App Store or Google Play
bun deploy:mobile:submit    # Submit to App Store / Google Play
bun deploy:mobile:update    # OTA update (JS-only change)
```

### Database Migrations

```bash
supabase db push   # Push local migrations to remote Supabase project
# Or via Supabase CLI linked to the project:
supabase migration up
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on main pushes and pull requests
targeting main or the release candidate:

1. **Quality** — `type-check`, `lint`, `format:check`
2. **Tests** — unit tests (web: Vitest, mobile: Jest)

The existing CI workflow's full database/browser and web-build jobs require a
manual dispatch with `full_verification=true`. The separate
`.github/workflows/release.yml` runs the complete local verification script,
including the production web build, automatically for PRs from `release/`
branches or with the `release-verification` label. It retains verification logs
and browser failure screenshots/traces. It can also be dispatched manually and
does not need hosted application credentials.

See [production acceptance](docs/production-acceptance.md) for staging, signed
device, live planning and cutover requirements. Passing CI alone is not launch
acceptance; repository branch protection must separately require release checks.

Mobile type-check is included in the quality step. Mobile EAS builds are triggered manually or via `bun deploy:mobile:*`.

For isolated iPhone testing, follow [Mobile QA](docs/mobile/QA.md). Use the `qa`
profile for a signed physical-device build; `qa-simulator` artifacts cannot be
installed on an iPhone. A production JavaScript export alone is not an
installable iOS app.

Apple OAuth secret is auto-rotated monthly via `.github/workflows/rotate-apple-secret.yml`.

## Rollback

**Web:** Promote a previously verified, schema-compatible deployment. After
restrictive database migrations, an arbitrary older deployment may no longer be
compatible. Follow the paused rollback procedure in
[release verification](docs/release-verification.md).

**Mobile:** EAS OTA updates can be rolled back via `eas update --rollout`; binary releases require a new store submission.

### Local mobile integration tests

Use `bun run dev:mobile:test` for real local email authentication and deterministic
AI fixtures. See [the mobile testing guide](docs/mobile-testing.md) for setup,
Maestro commands, failure scenarios, and production guards.

## Flight supplier migration

Duffel remains the default for existing searches. The trip brief can collect separate, versioned LiteAPI consent. Changing supplier clears the consent checkbox; explicit revocation prevents supplier requests. LiteAPI failure does not fall back to another recipient.

The LiteAPI adapter supports one-way and return search, the supplier's adult/child/infant age bands, and validated currency, party, route, cabin and expiry. It uses the returned selling total, preserves all segments, and creates no checkout links or reservations. Production search requires both `LITEAPI_FLIGHTS_ENABLED=true` and `LITEAPI_FLIGHTS_PRODUCTION_APPROVED=true` with a production `LITEAPI_API_KEY`. Leave both disabled until access and live acceptance are complete. Sandbox quotes never enter saved itineraries.

From `apps/web`, `bun scripts/rehearse-liteapi-flights.ts --help` describes the sandbox-only search harness; `bun scripts/compare-flight-fees.ts --help` describes an offline fee calculator. The sandbox harness requires `LITEAPI_FLIGHTS_SANDBOX_ENABLED=true` and a sandbox key.

Published pricing checked October 28, 2026: [LiteAPI](https://docs.liteapi.travel/reference/api-pricing-usage-costs) lists 1% ticketing with a EUR 2 minimum and EUR 10 maximum per booking, EUR 25 voluntary servicing, and EUR 0.005 per excess search above 1,500 searches per booking. [Duffel](https://duffel.com/pricing) lists USD 3 per order, 1% Managed Content, USD 2 per paid ancillary, and USD 0.005 per excess search above the same ratio. These are headline fees, not an all-in comparison. Account settings, payment/merchant fees, ancillary fees, fare conditions, FX and underlying fares must be checked before migration approval; returned LiteAPI totals can already include platform fees, so do not add them twice.

Production Flights access is not yet approved. [LiteAPI's access guide](https://docs.liteapi.travel/docs/getting-access-to-flights) requires separate approval and warns that sandbox prices cannot establish real availability or fare competitiveness. No live fare comparison or production switch has been performed.
