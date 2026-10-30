#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../apps/mobile"
case "${1:-check}" in
  check) exec eas env:exec preview "node ../../scripts/uat/verify.mjs" --non-interactive ;;
  live) exec eas env:exec preview "node ../../scripts/uat/verify.mjs --live" --non-interactive ;;
  family) exec eas env:exec preview "node ../../scripts/uat/verify.mjs --live --family" --non-interactive ;;
  *) echo 'Usage: bun run uat:api [check|live|family]' >&2; exit 2 ;;
esac
