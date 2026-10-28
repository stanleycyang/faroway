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
python3 scripts/planning-quality-eval.py
python3 scripts/test-trip-attempt-fence.py
python3 scripts/test-database-access-boundaries.py
python3 scripts/test-staging-bootstrap.py
python3 scripts/test-helper-search-paths.py
python3 scripts/test-release-account-push.py
python3 scripts/test-trip-creation-recovery.py
cd apps/web
bunx playwright test -c playwright.checkout.config.ts
bunx playwright test -c playwright.recovery.config.ts

# Build the unmodified production configuration against a read-only local catalog.
# The resulting artifact is verification-only; it must never be deployed.
cd ../..
node scripts/verify-web-build.mjs
