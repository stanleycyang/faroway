#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/mobile"
action="${1:-preflight}"
case "$action" in
  preflight|prebuild|pods|export|smoke|android|ios-simulator|cloud-android|cloud-ios|cloud-ios-simulator) ;;
  *) printf '%s\n' 'Usage: bun run qa:mobile [preflight|prebuild|pods|export|smoke|android|ios-simulator|cloud-android|cloud-ios|cloud-ios-simulator]' >&2; exit 2 ;;
esac
# Fetch environment values into the child process; never save or print them.
exec eas env:exec preview "node ../../scripts/mobile-qa.mjs $action" --non-interactive
