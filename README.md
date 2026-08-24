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

**Package manager:** Bun 1.3+  
**Build system:** Turborepo

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- [Node.js](https://nodejs.org) ≥ 20 (for Expo tooling)
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

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-only) |
| `OPENAI_API_KEY` | For AI | OpenAI GPT-4o for itinerary generation |
| `GOOGLE_AI_API_KEY` | For AI | Google Gemini (fallback) |
| `IP_HASH_SALT` | Prod | Server-only HMAC salt for privacy-preserving distributed rate limits |
| `NEXT_PUBLIC_BASE_URL` | Prod | Production URL for OG tags/sitemap |

See `apps/web/.env.example` for the full list including travel vendor API keys.

### Mobile (`apps/mobile/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `EXPO_PUBLIC_API_URL` | Dev | Override backend URL (auto-detected in dev) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Auth | Google OAuth web client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Auth | Google OAuth iOS client ID |

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
  affiliates/    Affiliate link tracking (Booking.com, Viator, etc.)
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

### Web (Vercel)

```bash
bun deploy:web          # Deploy to production
bun deploy:web:preview  # Deploy preview

# Required Vercel environment variables (set in Vercel dashboard):
# - All variables from apps/web/.env.example marked as required
# - Apply all Supabase migrations before deploying
```

### Mobile (EAS)

```bash
bun deploy:mobile:dev       # Development build
bun deploy:mobile:preview   # Preview/TestFlight build
bun deploy:mobile:prod      # Production build
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

GitHub Actions (`.github/workflows/ci.yml`) runs on every push:
1. **Quality** — `type-check`, `lint`, `format:check`
2. **Tests** — unit tests (web: Vitest, mobile: Jest)
3. **Build** — `next build` for web

Mobile type-check is included in the quality step. Mobile EAS builds are triggered manually or via `bun deploy:mobile:*`.

Apple OAuth secret is auto-rotated monthly via `.github/workflows/rotate-apple-secret.yml`.

## Rollback

**Web:** Vercel keeps the previous deployment; use the Vercel dashboard → Deployments → "Promote to Production" on the previous deploy.

**Mobile:** EAS OTA updates can be rolled back via `eas update --rollout`; binary releases require a new store submission.
