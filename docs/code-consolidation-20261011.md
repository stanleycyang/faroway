# Code consolidation — 2026-10-11

This consolidation merges reviewed code while holding automatic production deployments. `apps/web/vercel.json` disables Git deployments from `main`; other branches retain preview deployments. The live production artifact and hosted databases are unchanged. Removing this hold requires a separate reviewed database/application cutover. CLI production deployments also require that cutover; the Git hold is not a general deployment lock.

## CI and local verification

CI runs quality and unit checks on pull requests targeting main/release-candidate and on main pushes. Feature-branch push runs no longer duplicate PR checks. PostgreSQL, browser and production-build checks require a manual dispatch with `full_verification=true`; all jobs have bounded timeouts and Bun is pinned to 1.3.9. The monthly Apple-secret rotation remains active.

Run `bash scripts/verify-release-local.sh` for quality, unit, rubric, five disposable PostgreSQL suites and both synthetic browser suites without GitHub Actions usage. These tests use no hosted database or paid provider calls. Local checks do not establish signed-device, live supplier, Apple revocation or production readiness.

## Registered SQL

The exact reviewed account/push and creation-recovery transactions are registered as `20261011045031_account_and_push.sql` and `20261011045040_trip_creation_recovery.sql`. Their content hashes match the review artifacts. The separate follow-up inventory in `supabase/release-candidate/migrations.json` is validated by the bootstrap renderer, but is never incorporated into the frozen fresh-install SQL. Its bootstrap hash stays `09b820436a77967f95024abf4f724f4f2f1bb1d3378ee33b73656593ba729939`.

Read-only hosted inspection found the isolated staging project active on PostgreSQL 17.11, its bootstrap registered as `20261004223055`, zero Auth users and no creation/deletion receipts. Production's migration ledger still ends at `20260725006000`. Neither project received SQL writes in this consolidation. Do not blanket-push migrations: the older release lifecycle migrations require the existing runbook's dependency order and old-writer drain.

The Vercel staging URL/ref, separately scoped server credential metadata, planning pause and activation-off values are configured only on `codex/release-candidate`. Consolidating PR34 into that branch uses those existing settings; its separate review-branch preview is expected to reject inherited configuration. No credentials were copied and no feature flag was activated.

## Local work reconciliation

The original dirty workspace remains intact. Its 53 tracked changes and 52 untracked files were compared individually with the candidate, with per-file diffs and an inventory retained in the sibling backup directory.

Retained now: provider price/currency normalization and decimal preservation; AI hotel schema stripping unverified prices, ratings and outbound URLs; prevention of an invented cross-currency complete trip total; CORS support for idempotency/cache headers; accessible checked/disabled vibe choices. The earlier PR34 already retained bounded body reads, durable creation identities, account-scoped recovery and offline mutation retention.

Deferred with source preserved: the September alternate web/native planning journals and global store recovery, old generation transaction framework/migration, Expo fixtures, live Places autocomplete, broad streamed-renderer rewrites, and historical launch journals/evidence. The candidate uses account-bound creation receipts, versioned APIs, independent destination facts and disabled unchecked handoffs. The live Places and tracked-link renderer versions would undo those choices; they cannot be copied wholesale. Additional currency-display improvements can be ported separately while preserving those boundaries. Candidate browser/SQL coverage replaces the older incompatible fixtures; their evidence is not claimed as final release evidence.

## Remaining production release work

Rehearse the registered follow-ups on approved staging, validate server credential provenance without exposing values, and obtain signed-device acceptance. Prepare a production-specific migration ledger and backup, controlled pause, positive old-workflow drain and compatible rollback. Apply reviewed SQL in dependency order and deploy a paused compatible artifact before removing the Git hold or unpausing planning. Optional booking, push delivery, Apple deletion and live paid-provider gates stay off until their separate acceptance checks pass.
