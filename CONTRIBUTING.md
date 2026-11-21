# Contributing to Faroway

Thank you for your interest in contributing to Faroway! This guide covers local setup, code standards, testing tiers, and pull request expectations.

## Prerequisites

- **[Bun](https://bun.sh) 1.4.4** (`packageManager` is pinned in `package.json`)
- **[Node.js](https://nodejs.org) >= 22.23.4** (used by Expo and Playwright tooling)
- **[Docker](https://www.docker.com/)** + **[Supabase CLI](https://supabase.com/docs/guides/cli)** (for local Postgres and database migration tests)
- **Python 3** (for offline rubric and database regression suites)

## Local Development Setup

```bash
# 1. Install dependencies (Bun is required)
bun install

# 2. Create local environment files from templates
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# 3. Validate required environment variables
bun run env:check

# 4. Start local Supabase and apply migrations
bun run db:start
bun run db:migrate

# 5. Start development servers
bun run dev           # web + mobile
bun run dev:web       # Next.js web + API backend (http://localhost:3000)
bun run dev:mobile    # Expo Metro bundler
```

> Never commit `.env`, `.env.local`, private keys (`.p8`, `.pem`, `.key`), or local QA dumps under `artifacts/`.

## Quality Checks & Testing

Run these before opening a pull request:

```bash
# Type-check, ESLint, and Prettier across the monorepo
bun run check

# All fast unit & integration tests (web, mobile, shared packages, scripts, Python)
bun run test

# Offline itinerary quality and holdout evals (no API keys or paid calls)
bun run test:evals
```

### Targeted Suites

```bash
bun run test:web          # Next.js web + API unit tests (Vitest)
bun run test:mobile       # Expo React Native tests (Jest)
bun run test:packages     # Shared packages (@faroway/api-client, constants, supabase, validation)
bun run test:scripts      # Tooling, eval, and security regression tests (Bun)
bun run test:python       # Python UAT helper unit tests (unittest)
```

### Integration, Browser, and Database Suites

```bash
# Isolated browser suites (planning, checkout, recovery — no hosted credentials needed)
bun run test:e2e:isolated

# Full Playwright E2E suite against a running local server
bun run test:e2e

# Disposable PostgreSQL migration & RLS security tests (requires Docker)
bun run test:db

# Local secret scan (requires gitleaks)
bun run test:secrets
```

## Coding Guidelines

- **TypeScript strict mode** is enabled across apps, packages, and `scripts/tsconfig.json`.
- **Formatting**: Run `bun run format` before committing; CI enforces `bun turbo format:check`.
- **Database migrations**: Never modify previously applied migration files under `supabase/migrations/`. Add a new timestamped SQL migration instead and verify with `bun run test:db`.
- **No hardcoded credentials or personal paths**: Keep all environment-specific URLs, keys, and tokens in `.env.local` (ignored by Git).
- **Security & privacy**: All user tables must enforce Row Level Security (RLS). Never expose server-only keys (`SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, partner secrets) in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables.

## Pull Request Process

1. Branch from `main` using a descriptive branch name (e.g., `feat/...`, `fix/...`, `docs/...`).
2. Keep changes focused and include tests for new behavior or bug fixes.
3. Verify `bun run check`, `bun run test`, and `bun run test:evals` pass cleanly.
4. Fill out the pull request template with a clear summary and verification notes.

## Licensing & Contributor Agreement

Faroway's source code is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE), and Faroway's brand assets are governed by [TRADEMARKS.md](TRADEMARKS.md).

By submitting a pull request or other contribution to this repository, you confirm that:

1. You have the right to submit the contribution (either as your own original work or with appropriate third-party permissions).
2. You grant Faroway and its maintainers a perpetual, worldwide, non-exclusive, royalty-free, irrevocable copyright and patent license to use, reproduce, modify, distribute, and sublicense your contribution under the [AGPL-3.0](LICENSE) as well as under alternative commercial or proprietary license terms for Faroway's products and services.

> Maintainers may also enable an automated CLA check (such as CLA Assistant) on pull requests for formal click-through sign-off.

