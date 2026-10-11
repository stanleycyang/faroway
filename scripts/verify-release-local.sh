#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Uses disposable databases and synthetic browser services; no hosted SQL,
# GitHub Actions dispatch, deployment or paid provider request.
bun run check
bun run test
python3 scripts/planning-quality-eval.py
python3 scripts/test-trip-attempt-fence.py
python3 scripts/test-database-access-boundaries.py
python3 scripts/test-staging-bootstrap.py
python3 scripts/test-release-account-push.py
python3 scripts/test-trip-creation-recovery.py
cd apps/web
bunx playwright test -c playwright.checkout.config.ts
bunx playwright test -c playwright.recovery.config.ts
