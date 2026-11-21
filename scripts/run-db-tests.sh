#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is required to run disposable PostgreSQL migration tests." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon is not running. Start Docker and retry." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 is required to run database regression suites." >&2
  exit 1
fi

suites=(
  "scripts/test-trip-attempt-fence.py"
  "scripts/test-trip-creation-recovery.py"
  "scripts/test-database-access-boundaries.py"
  "scripts/test-staging-bootstrap.py"
  "scripts/test-helper-search-paths.py"
  "scripts/test-release-account-push.py"
  "scripts/test-venue-evidence.py"
)

for suite in "${suites[@]}"; do
  echo "==> Running ${suite}"
  python3 "${suite}"
done

echo "All ${#suites[@]} database regression suites passed."
