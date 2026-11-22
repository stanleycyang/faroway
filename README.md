# Faroway

AI-powered travel planning monorepo — personalized day-by-day itineraries with accommodations, activities, dining, transport, interactive travel tools, and offline-capable mobile sync.

## Features

- **Multi-Agent AI Itinerary Planning**: Orchestrated planning workflow (hotels, activities, dining, transport, and aggregation) with Server-Sent Events (SSE) real-time streaming.
- **Web App & Unified API Backend (`apps/web`)**: Next.js 16 App Router application serving the web planner, shared itineraries, travel tools (world map, trip cost, packing list, currency converter, visa checker, travel quiz), blog, and the complete REST/SSE API backend for mobile.
- **Cross-Platform Mobile App (`apps/mobile`)**: Expo 54 + React Native app for iOS and Android with Expo Router, Zustand state management, offline persistence/sync queue, Google & Apple Sign-In, and push notifications.
- **Supabase PostgreSQL Backend (`supabase/`)**: Full SQL migration history with Row Level Security (RLS) across all user tables.
- **Deterministic Offline Eval & Verification Harness**: Unit tests across every workspace, offline itinerary quality/holdout rubrics, isolated Playwright browser suites, and disposable Docker PostgreSQL RLS regression tests — all runnable without paid API calls or hosted credentials.

## Tech Stack

| Layer            | Technology                                                           |
| ---------------- | -------------------------------------------------------------------- |
| Monorepo & Build | [Bun 1.4.4](https://bun.sh), [Turborepo](https://turbo.build)        |
| Web & API        | [Next.js 16](https://nextjs.org), React 19, Tailwind CSS 4, Zod      |
| Mobile           | [Expo 54](https://expo.dev), React Native 0.81, Expo Router, Zustand |
| Database & Auth  | [Supabase](https://supabase.com) (PostgreSQL 17, Auth, Storage, RLS) |
| AI & Workflows   | Vercel AI SDK (Google Gemini via AI Gateway), Workflow runtime       |
| Testing          | Vitest, Jest, Bun Test, Playwright, Python `unittest` + Docker PG    |

## Monorepo Structure

```text
apps/
  web/                Next.js 16 web frontend + API backend (Vercel)
  mobile/             Expo 54 + React Native iOS/Android app (EAS)
packages/
  types/              Shared TypeScript domain types
  constants/          Shared destination catalog, pricing, and date helpers
  supabase/           Browser, server, and React Native Supabase client factories
  validation/         Shared Zod schemas for API and form validation
  api-client/         Shared HTTP client helpers
  tsconfig/           Base TypeScript configurations
  eslint-config/      Shared ESLint configuration
supabase/
  migrations/         Canonical PostgreSQL schema and RLS migrations
scripts/
  __tests__/          Bun test suites for tooling, evals, and security checks
  uat/                Offline itinerary quality evals and UAT helpers
  run-db-tests.sh     Disposable Docker PostgreSQL migration & RLS test runner
docs/                 Architecture, QA, testing, and release runbooks
```

## Prerequisites

- **[Bun](https://bun.sh) 1.4.4** (`1.0.21`–`1.4.3` are affected by CVE-2026-111497)
- **[Node.js](https://nodejs.org) >= 22.23.4** (required for Expo and Playwright tooling; Node 20 is EOL, and `22.x` before `22.23.4` is affected by CVE-2026-111497)
- **[Docker](https://www.docker.com/)** and **[Supabase CLI](https://supabase.com/docs/guides/cli)** (for local PostgreSQL and database regression tests)
- **Python 3** (for offline rubric and database regression suites)
- **[EAS CLI](https://docs.expo.dev/eas/)** (optional, for native mobile builds: `bun add -g eas-cli`)

## Quick Start

```bash
# 1. Clone and install dependencies (Bun is required)
git clone <repo-url>
cd faroway
bun install

# 2. Configure local environment variables
cp .env.example .env.local                   # local Supabase CLI OAuth config
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
# Edit the .env.local files with your local or hosted Supabase keys

# 3. Verify required environment variables
bun run env:check

# 4. Start local Supabase (requires Docker) and apply migrations
bun run db:start
bun run db:migrate

# 5. Start dev servers
bun run dev            # Web + Mobile simultaneously

# Or run each app individually:
bun run dev:web        # Next.js web + API backend at http://localhost:3000
bun run dev:mobile     # Expo Metro bundler
bun run dev:ios        # Launch iOS simulator directly
bun run dev:android    # Launch Android emulator directly
```

> **Tip:** You can run the full unit test suite (`bun run test`) and offline evals (`bun run test:evals`) immediately after `bun install` — no `.env.local` files, Docker containers, or external API keys are required.

## Environment Variables

### Web (`apps/web/.env.local`)

| Variable                        | Required | Description                                                                                                                                      |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL                                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase anonymous/public key (respects RLS)                                                                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes      | Supabase service role key (server-only — never expose publicly)                                                                                  |
| `AI_GATEWAY_API_KEY`            | AI       | Vercel AI Gateway key for live itinerary generation (Gemini)                                                                                     |
| `IP_HASH_SALT`                  | Prod     | Server-only HMAC salt (>= 32 chars) for privacy-preserving rate limits                                                                           |
| `NEXT_PUBLIC_BASE_URL`          | Prod     | Canonical public URL for OpenGraph tags, sitemap, and share links                                                                                |
| `FAROWAY_BUILD_WITHOUT_BLOG_DB` | No       | Set to `1` only for offline local `next build` when Supabase is unreachable; leave unset in production so database connectivity errors fail fast |

Optional travel integrations (Duffel, LiteAPI, Viator, GetYourGuide, TripAdvisor, Tavily, Google Places, MET Norway weather), Sentry, and verification tags (`GOOGLE_SITE_VERIFICATION`, `IMPACT_SITE_VERIFICATION`) are documented in [`apps/web/.env.example`](apps/web/.env.example). Generation degrades gracefully when optional supplier keys are omitted.

### Mobile (`apps/mobile/.env.local`)

| Variable                            | Required | Description                                           |
| ----------------------------------- | -------- | ----------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`          | Yes      | Supabase project URL                                  |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`     | Yes      | Supabase anonymous/public key                         |
| `EXPO_PUBLIC_API_URL`               | Dev/Prod | Web/API backend origin (e.g. `http://localhost:3000`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`  | Auth     | Google OAuth web client ID                            |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`  | Auth     | Google OAuth iOS client ID                            |
| `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` | Auth     | Reversed Google iOS client ID URL scheme              |

See [`apps/mobile/.env.example`](apps/mobile/.env.example) and [`docs/CREDENTIAL_SETUP.md`](docs/CREDENTIAL_SETUP.md) for the complete mobile & OAuth setup guide.

### Root (`.env.local`)

Used by the local Supabase CLI (`supabase/config.toml`) for local Google and Apple OAuth credentials. See [`.env.example`](.env.example).

## Scripts & Testing

### Development & Quality

```bash
bun run dev               # Start all apps in dev mode
bun run build             # Build all packages + web app
bun run build:web         # Build Next.js web app
bun run check             # Full quality gate: type-check + lint + format:check
bun run type-check        # TypeScript checks across apps, packages, and scripts
bun run lint              # ESLint across apps
bun run format            # Prettier format across apps
bun run format:check      # Verify Prettier formatting
bun run env:check         # Validate required environment variables
```

### Test Suites

All test layers are wired into root scripts and CI:

```bash
# Fast unit & integration suites (no Docker or API keys needed)
bun run test              # Web (Vitest) + Mobile (Jest) + Packages (Vitest) + Scripts (Bun) + Python (unittest)
bun run test:web          # Next.js web & API unit tests (Vitest)
bun run test:mobile       # Expo React Native unit tests (Jest)
bun run test:packages     # Shared packages (@faroway/api-client, constants, supabase, validation)
bun run test:scripts      # Tooling, eval, and dependency security tests (Bun)
bun run test:python       # Python UAT helper unit tests (unittest)

# Offline AI planning quality & holdout rubrics (no model/provider calls)
bun run test:evals        # Planning rubric calibration + traveler holdout + generation quality

# Browser E2E tests (Playwright)
bun run test:e2e:isolated # Isolated planning, checkout, and recovery suites (no hosted credentials)
bun run test:e2e          # Full Playwright suite against a running local server

# Database migration & RLS security tests (requires Docker)
bun run test:db           # Runs all 7 disposable PostgreSQL migration/RLS regression suites

# Secret scanning (requires gitleaks)
bun run test:secrets      # Scan working tree against .gitleaks.toml
```

### Database & Mobile Utilities

```bash
bun run db:start          # Start local Supabase stack (Docker)
bun run db:stop           # Stop local Supabase stack
bun run db:reset          # Reset and reseed local database
bun run db:migrate        # Apply pending migrations locally
bun run db:diff           # Diff local public schema
bun run db:push           # Push migrations to a linked remote project
bun run db:studio         # Open Supabase Studio at http://localhost:54323

bun run dev:mobile:test   # Local mobile integration environment with deterministic fixtures
bun run release:check:mobile  # Validate mobile release env, EAS config, and expo-doctor
```

## Architecture

### Web & API Backend (`apps/web`)

Next.js App Router application serving both the public/authenticated web UI and the API backend consumed by the mobile app:

```text
apps/web/
  app/
    (marketing)/     Landing page, about, support, privacy, terms, report
    (app)/           Authenticated dashboard and trip detail workspace
    s/[token]/       Link-only shared trip viewer
    blog/            Static/ISR travel blog and guides
    tools/           Interactive travel calculators and world map
    api/
      trips/         Trip CRUD, AI generation trigger, SSE stream, copilot, checkout, sharing
      search/        Multi-agent search lifecycle endpoints
      workflows/     Durable itinerary generation workflow endpoints
      destinations/  Popular and trending destinations
      places/        Google Places autocomplete, details, and venue lookup
      user/          Profile, push token, and account deletion endpoints
      weather/       Optional MET Norway weather forecast proxy
      health/        Service health check
  lib/
    workflow/        Durable workflow runtime
    search/          Multi-agent search, grounding, schedule compiler, and supplier adapters
    affiliates/      Travel partner integrations (Duffel, LiteAPI, Viator, GetYourGuide, TripAdvisor)
    json-render/     Block-based itinerary renderer specs
    security/        Rate limiting, CORS, CSP headers, and redirect validation
  workflows/
    plan-trip.ts     Primary AI itinerary orchestration workflow
```

### Mobile (`apps/mobile`)

Expo Router app with Zustand stores and an AsyncStorage-backed offline sync queue:

```text
apps/mobile/
  app/
    (tabs)/          Explore, Trips, Profile tabs
    create/          Multi-step trip creation flow + live streaming generation screen
    trip/[id].tsx    Trip detail view with sharing, companion mode, and itinerary blocks
    onboarding/      Welcome and authentication screens
  hooks/             useAuth, useStreamingItinerary, useTrips, useOfflineSync, useNotifications
  stores/            tripStore, userStore, promptStore (Zustand)
  lib/
    json-render/     React Native itinerary block renderer
    offline/         Network monitor, AsyncStorage cache, and mutation sync queue
```

### Database (`supabase/`)

PostgreSQL 17 via Supabase with Row Level Security (RLS) on all user tables. Key tables include `users`, `trips`, `itineraries`, `searches`, `search_results`, `destinations`, `affiliate_clicks`, `push_tokens`, `notifications`, and `trip_venue_evidence`.

## CI/CD & Deployment

### GitHub Actions

- **CI (`.github/workflows/ci.yml`)**: Runs on pushes to `main` and pull requests:
  1. **Quality Checks**: `bun run type-check`, `bun turbo lint`, `bun turbo format:check`
  2. **Tests & Offline Evals**: `bun run test` and `bun run test:evals`
  3. **Full Verification** (manual `workflow_dispatch` with `full_verification=true`): `bun run test:db`, `bun run test:e2e:isolated`, and production web build
- **Release Verification (`.github/workflows/release.yml`)**: Runs `scripts/verify-release-local.sh` end-to-end without hosted credentials for `release/*` PRs, PRs labeled `release-verification`, or manual dispatch.
- **Apple OAuth Rotation (`.github/workflows/rotate-apple-secret.yml`)**: Regenerates the Apple Sign-In client secret JWT monthly (see [`docs/CREDENTIAL_SETUP.md`](docs/CREDENTIAL_SETUP.md)).

### Deployment Commands

```bash
# Web (Vercel)
bun run deploy:web:preview    # Preview deployment
bun run deploy:web            # Production deployment

# Mobile (EAS)
bun run deploy:mobile:dev     # Development client build
bun run deploy:mobile:preview # Internal distribution build
bun run deploy:mobile:prod    # Store build (App Store / Google Play)
bun run deploy:mobile:submit  # Submit to App Store / Google Play
bun run deploy:mobile:update  # Over-the-air JS update
```

For production readiness, monetization/partner configuration, brand guidelines, cutover, rollback, mobile QA, and testing runbooks, see:

- [Production Readiness, Monetization & Design Audit](PROD_AUDIT.md)
- [Faroway Brand Guidelines](brand/BRAND.md)
- [Production Acceptance & Cutover](docs/production-acceptance.md)
- [Release Verification & Rollback](docs/release-verification.md)
- [Credential Setup](docs/CREDENTIAL_SETUP.md)
- [Mobile Testing Guide](docs/mobile-testing.md) & [Mobile QA](docs/mobile/QA.md)
- [Offline Sync Architecture](docs/OFFLINE_SYNC.md) & [Itinerary Streaming](docs/itinerary-streaming.md)
- [Generation Quality Eval](docs/generation-quality-eval.md) & [Traveler Quality Gate](docs/traveler-quality-gate.md)

## Contributing & Security

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
- Report security issues privately following [SECURITY.md](SECURITY.md).

## License & Trademarks

- **Source code**: Licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE). If you modify and run Faroway as a network service, you must make the corresponding source code of your modifications available under AGPL-3.0.
- **Commercial licensing**: If you want to use, embed, or distribute Faroway (including in proprietary web services or mobile app store distributions) without AGPL-3.0 obligations, contact `support@faroway.ai` for a commercial license.
- **Trademarks & brand assets**: The **Faroway** name, wordmark, logos, and assets under `brand/` are excluded from the AGPL-3.0 code license. See [TRADEMARKS.md](TRADEMARKS.md) for permitted and prohibited uses.
