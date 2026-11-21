#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Fail before any command can inherit a local application's credentials.
for directory in . apps/web apps/mobile; do
  for filename in .env .env.local .env.development .env.development.local .env.test .env.test.local .env.production .env.production.local; do
    if [[ -f "$directory/$filename" ]]; then
      printf '%s\n' 'Run release verification in a separate worktree without dotenv files; see docs/code-consolidation-20261011.md.' >&2
      exit 1
    fi
  done
done

# Uses disposable databases and synthetic browser services; no hosted SQL,
# GitHub Actions dispatch, deployment or paid provider request.
bun run check
bun run test
bun run test:evals
bun run test:db
bun run test:e2e:isolated

# Build the unmodified production configuration against a read-only local catalog.
# The resulting artifact is verification-only; it must never be deployed.
node scripts/verify-web-build.mjs
