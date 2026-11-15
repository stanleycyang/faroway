# Production-readiness follow-up

This records verified progress, not release approval.

## Findings addressed

- CI Quality Checks failed because `apps/mobile/__tests__/hooks/useTrips.test.tsx`
  was not formatted. Corrected the file and reran the complete workspace check,
  including package-wide formatting, rather than only linting changed files.
- The dedicated phone QA account's staging database and QA profile API both return
  Culture/Foodie and matching identity. The iPhone's empty summary was not evidence
  of lost server preferences. Auth enrichment is best-effort and previously had no
  profile-tab retry. The tab now refreshes on focus/foreground, distinguishes failed
  loading from empty preferences, and guards against stale reads, account switches,
  and overwriting newer local edits. Seven lifecycle regressions pass.
- Saved activity photos previously disappeared permanently after one load error.
  Saved hotel photos and streamed hero/hotel/activity/restaurant photos bypassed
  the shared error/reconnect behavior. These now use TravelImage; regression tests
  fail actual card images and restore connectivity without reopening the screen.
  Attribution is retained. This does not prove the separate initial generation-to-
  detail hero issue is resolved or create photos where providers supplied none.

## Verification

- Full workspace `bun run check`: 11 tasks pass; nine existing web lint warnings.
- Mobile Jest: 76 suites / 764 tests pass.
- Web Vitest: 188 files / 1,729 tests pass, including loopback runtime tests.
- `bun --no-env-file test scripts/__tests__`: 261 tests / 1,650 assertions pass.
- `python3 scripts/planning-quality-eval.py`: 17/17 expected synthetic outcomes,
  including all 14 negative controls. This is rubric calibration, not live quality.
- Current Gateway reconciliation: original key $9.71708035 plus replacement key
  $0.11735150 = $9.83443185 cumulative of the original $20. No paid call dispatched
  in this follow-up. The replacement key's nonrenewing cap remains $10.28.
- Installed device builds still contain b7133b7; the new fixes need new native
  acceptance. No new native build or production deployment was submitted here.

## Tooling and remaining gates

Local Bun 1.3.8 cannot audit lockfile version 3 (`UnknownLockfileVersion`). CI/EAS
pin Bun 1.4.4. Do not regenerate the lockfile with an older runtime to bypass this.
A read-only npm bulk advisory lookup of 1,491 locked dependency names completed
through curl after Node encountered a TLS transport error. It reports the same
seven advisories across decode-uri-component, deepmerge, image-size and nanoid
already covered by the maintained patches and resolved-consumer regression tests.
This is not a zero-finding audit; patch integrity and native coverage remain part
of release review. No package or lockfile was rewritten.

The shell's Vercel 50.17.1 lacks `ai-gateway`; the existing installed 65.9.0 CLI
successfully reconciled budgets. These are tooling differences, not exhausted
allowance or application failures.

Current-backend live generation and grounded traveler-quality acceptance remain
open. The older protected preview failed missing-meal/timing acceptance and was
deleted. New credential-bearing preview approval is bounded separately. Physical
failure/accessibility coverage, external provider flows, operational checks and
final CI/deep review remain release gates. The branch is not production-ready.
