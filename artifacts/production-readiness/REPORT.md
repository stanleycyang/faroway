# Production Readiness Handoff

Branch: `codex/production-readiness-20260629`

## Launch Recommendation

HOLD for public launch until the mobile release environment is populated and native device/simulator QA is completed.

Code, tests, lint, formatting, web build, and available browser E2E checks pass after this branch's fixes. The remaining blockers are release prerequisites, not known regressions from this pass.

## Major Fixes

- Mobile push notification tokens now register through the authenticated backend endpoint `/api/user/push-token` instead of placeholder client behavior.
- Removed raw push-token and notification payload console logging from the mobile notification path; notification/trip-store diagnostics now use the existing dev-only logger.
- Hardened the mobile API client against empty or malformed server response bodies so UI callers receive safe `ApiResponse` errors instead of misleading fetch failures.
- Removed hardcoded demo identity creation from onboarding preferences and added duplicate-submit protection while syncing authenticated preferences.
- Corrected launch copy that said "No account needed" despite generation being auth-gated.
- Added server-side calendar-date and date-range validation for trip creation, trip updates with both dates, search start, non-streaming itinerary generation, and streaming itinerary generation.
- Fixed trip delete ownership/not-found semantics by requesting an exact delete count from Supabase before returning success.
- Switched `/api/search/start` to the async rate-limit helper so distributed KV-backed limits apply when configured.

## Security and Reliability

- Push-token writes now derive ownership from the backend authenticated user instead of trusting a client-side direct table write.
- Impossible dates like `2026-02-31` and inverted ranges are rejected before workflows or writes start.
- Search-start abuse protection now awaits the distributed rate-limit path.
- Mobile logs no longer expose push tokens or full notification payloads in production console output.

## Tests and Checks

- `bun --filter @faroway/web test -- __tests__/api/trips.test.ts __tests__/api/search-start.test.ts __tests__/api/itinerary.test.ts __tests__/api/itinerary-stream.test.ts __tests__/lib/date-range.test.ts` - PASS, 28 tests.
- `bun --filter @faroway/mobile test -- --runTestsByPath __tests__/services/api.test.ts __tests__/stores/tripStore.test.ts` - PASS, 42 tests.
- `bun run type-check` - PASS, 7 package tasks.
- `bun run lint` - PASS, mobile and web.
- `bun run format:check` - PASS.
- `bun run test` - PASS, 5 package tasks; web 58 files / 366 tests, mobile 16 suites / 140 tests, package tests passed.
- `bun run build` - PASS. Non-blocking warnings: deprecated Sentry `disableLogger`, unsupported Next `eslint` config key, missing public Supabase env causing empty blog/static data fallbacks.
- `cd apps/web && bunx playwright test` - PARTIAL. 48 passed; 9 Mobile Safari tests blocked because local WebKit executable is missing at `/Users/stanleyyang/Library/Caches/ms-playwright/webkit-2287/pw_run.sh`.
- `cd apps/web && bunx playwright test --project=chromium --project="Mobile Chrome"` - PASS, 38 tests.
- `bun run release:check:mobile` - BLOCKED. Missing required env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`, `EAS_PROJECT_ID`.
- `xcrun simctl list devices available` - PASS for availability; iOS 26.3 simulators are installed, including iPhone 17 Pro variants.

## Manual QA

- Web browser smoke coverage was exercised through Playwright on Chromium and Mobile Chrome.
- Native mobile runtime QA was not executed because mobile release config is incomplete. Simulators exist locally, but release/native confidence should wait for the missing Expo/Supabase/Google/EAS variables.
- Screenshots/videos were not captured as final artifacts in this pass.

## Remaining Risks and Follow-ups

- Add the missing mobile release env vars, then rerun `bun run release:check:mobile`.
- Install the Playwright WebKit browser with the repo-approved Bun path, then rerun full `cd apps/web && bunx playwright test`.
- Run native iOS simulator QA after release env is present: onboarding, auth, create trip, generation/stream, trips list, trip detail, profile/preferences, push-token registration, offline/restore paths.
- Resolve build-time warnings before launch: remove unsupported `eslint` key from `apps/web/next.config.ts`, update Sentry `disableLogger` config, and verify production Supabase env/image assets are present.
- Review remaining direct `console.*` output in backend/vendor paths and decide which should move to structured logger versus stay as test/dev diagnostics.
