# Mobile E2E Strategy (Detox + Maestro)

## Critical flow contract

All flows below are merge-gate candidates and must satisfy pass/fail invariants.

1. `FlowA_CreateGenerateView`
   - Route: `/create` -> `/create/generating` -> `/trip/:id`
   - Pass invariants:
     - `create_screen` and `create_continue_button` visible
     - generation screen appears (`generating_screen`)
     - either progressive blocks appear (`generating_progressive_blocks`) or completion CTA appears (`generating_view_trip_button`)
2. `FlowB_GuestAuthGateShare`
   - Route: `/trip/:id` guest user share/save actions
   - Pass invariants:
     - share or save action is visible (`trip_share_button`, `trip_save_button`)
     - auth gate modal appears (`auth_gate_modal`)
3. `FlowC_TripsLibraryOpen`
   - Route: `/(tabs)/trips` -> `/trip/:id`
   - Pass invariants:
     - trips entry route renders
     - selecting a trip opens `trip_screen`
4. `FlowD_InspirationPrefill`
   - Route: `/inspiration/:slug` -> `/create`
   - Pass invariants:
     - inspiration screen renders (`inspiration_screen`)
     - CTA interaction (`inspiration_surprise_me_button`) lands in create flow (`create_screen`)

## Selector naming convention

- Format: `screen_action_element`
- Dynamic selectors use suffixes:
  - `trip_day_tab_${n}`
  - `inspiration_destination_${id}`
- Keep selectors stable across layout/style refactors.
- Prefer `testID` for app controls; include accessibility label for semantic controls where useful.

## Framework split

- **Maestro:** fast smoke coverage for route entry and happy-path regressions.
- **Detox:** deterministic app-state assertions and deeper journey correctness.

## Deterministic E2E env contract

Required env vars:

- `EXPO_PUBLIC_API_URL`
- `E2E_SEED_TOKEN`
- `E2E_MODE=true`
- `E2E_PROFILE=default`

Fixture scripts:

- Seed: `bun run e2e:fixtures:seed`
- Teardown: `bun run e2e:fixtures:teardown`
- Required seeded trip id for guest gate checks: `e2e-demo`

Both scripts are idempotent and profile-aware.

## Local runbook

1. `bun install`
2. `cd apps/mobile`
3. `bun run prebuild` (first run only, or after native deps change)
4. `bun run e2e:fixtures:seed`
5. `bun run e2e:detox:build:ios`
6. `bun run e2e:detox:test:ios`
7. `bun run e2e:maestro:test`
8. `bun run e2e:fixtures:teardown`

## CI expectations

- Dedicated workflow: `.github/workflows/mobile-e2e.yml`
- Phase 1: set repo variable `MOBILE_E2E_PHASE=1` (non-blocking)
- Phase 2: set repo variable `MOBILE_E2E_PHASE=2` (blocking on PR mobile path changes)
- Phase 3: nightly matrix with artifact retention

Artifacts to retain:

- Detox logs and screenshots
- Maestro logs and screenshots
- JUnit reports when available

## Flake and triage policy

- Retry budget: 1 automatic retry for Detox failures in CI.
- Quarantine rule: 3 flakes in 7 days -> test moved to quarantine list and owner assigned.
- Escalation:
  - product regression -> app owner
  - infra/simulator instability -> devex owner
- A quarantined test cannot remain quarantined for more than 14 days.
