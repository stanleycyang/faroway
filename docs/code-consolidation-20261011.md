# Code consolidation — 2026-10-11

This consolidation merges reviewed code while holding automatic production deployments. `apps/web/vercel.json` disables Git deployments from `main`; other branches retain preview deployments. The live production artifact and hosted databases are unchanged. Removing this hold requires a separate reviewed database/application cutover. CLI production deployments also require that cutover; the Git hold is not a general deployment lock.

## CI and local verification

CI runs quality and unit checks on pull requests targeting main/release-candidate and on main pushes. Feature-branch push runs no longer duplicate PR checks. PostgreSQL, browser and production-build checks require a manual dispatch with `full_verification=true`; all jobs have bounded timeouts and Bun is pinned to 1.3.9. The monthly Apple-secret rotation remains active.

Run `bash scripts/verify-release-local.sh` from a worktree without dotenv files for quality, unit, rubric, five disposable PostgreSQL suites and both synthetic browser suites without GitHub Actions usage. This workspace retains its existing ignored dotenv configuration, so the script refuses it before executing tests. The separate `/Users/stanley/Workspace/mobile/faroway-review` worktree has no dotenv files and is available for isolated verification. These tests use no hosted database or paid provider calls. Local checks do not establish signed-device, live supplier, Apple revocation or production readiness.

## Registered SQL

The exact reviewed account/push and creation-recovery transactions are registered as `20261011045031_account_and_push.sql` and `20261011045040_trip_creation_recovery.sql`. Their content hashes match the review artifacts. The separate follow-up inventory in `supabase/release-candidate/migrations.json` is validated by the bootstrap renderer, but is never incorporated into the frozen fresh-install SQL. Its bootstrap hash stays `09b820436a77967f95024abf4f724f4f2f1bb1d3378ee33b73656593ba729939`.

Read-only hosted inspection found the isolated staging project active on PostgreSQL 17.11, its bootstrap registered as `20261004223055`, zero Auth users and no creation/deletion receipts. Production's migration ledger still ends at `20260725006000`. Neither project received SQL writes in this consolidation. Do not blanket-push migrations: the older release lifecycle migrations require the existing runbook's dependency order and old-writer drain.

The Vercel staging URL/ref, separately scoped server credential metadata, planning pause and activation-off values are configured only on `codex/release-candidate`. Consolidating PR34 into that branch uses those existing settings; its separate review-branch preview is expected to reject inherited configuration. No credentials were copied and no feature flag was activated.

## Local work reconciliation

The original local work is preserved in stash `b43c4370af240ba8f761af70b5c463a0a2f14ab2` (named "Preserved local September work before PR consolidation 2026-10-11") and the sibling `faroway-review-backup-20261010` archive. Its 53 tracked changes and 52 untracked files were compared individually with the candidate. The stash tracked diff matches the original backup SHA-256, and all 52 untracked files were verified. The workspace now follows consolidated `main`; the original branch `fix/production-review-regressions-20260904` is retained. Do not blindly apply the old stash onto main: use that preserved branch or a separate worktree for the deferred reconciliation.

Retained now: provider price/currency normalization and decimal preservation; AI hotel schema stripping unverified prices, ratings and outbound URLs; prevention of an invented cross-currency complete trip total; CORS support for idempotency/cache headers; accessible checked/disabled vibe choices. The earlier PR34 already retained bounded body reads, durable creation identities, account-scoped recovery and offline mutation retention.

Deferred with source preserved: the September alternate web/native planning journals and global store recovery, old generation transaction framework/migration, Expo fixtures, live Places autocomplete, broad streamed-renderer rewrites, and historical launch journals/evidence. The candidate uses account-bound creation receipts, versioned APIs, independent destination facts and disabled unchecked handoffs. The live Places and tracked-link renderer versions would undo those choices; they cannot be copied wholesale. Additional currency-display improvements can be ported separately while preserving those boundaries. Candidate browser/SQL coverage replaces the older incompatible fixtures; their evidence is not claimed as final release evidence.

## Remaining production release work

Rehearse the registered follow-ups on approved staging, validate server credential provenance without exposing values, and obtain signed-device acceptance. Prepare a production-specific migration ledger and backup, controlled pause, positive old-workflow drain and compatible rollback. Apply reviewed SQL in dependency order and deploy a paused compatible artifact before removing the Git hold or unpausing planning. Optional booking, push delivery, Apple deletion and live paid-provider gates stay off until their separate acceptance checks pass.

## Completed code checkpoint

PR34 merged into the candidate at `3b9d8a6a0efa3349ae116daf0423f15bc95869d8`; its configured, protected staging preview is READY at deployment `dpl_JA8K3gXkCNSbbrcMZ3w1tkRdTSsx`. PR33 merged the identical tested tree into main at `06f1c0d5b34a3cc22fcd38e5195f6f308921517d`. The superseded PR stack and PR18 are retired; source branches remain available.

Validation passed: all 11 quality tasks; 621 web, 315 mobile, 115 shared-package and 8 script tests (1,059 total); all five disposable PostgreSQL suites; 28 checkout/Places and 32 full-app recovery browser cases. Frozen dependency installation required no changes in the review worktree. The consolidation commits use `[skip actions]`, so hosted Actions are not claimed as validation and consume no runner minutes for these pushes.

The production deployment remains `dpl_2RFYSiq4ynRTt67okcCFkBTUwfyV`, source `5a8eadf06f596f81e8bcc0f4d90d3e58518c83eb`. The main Git deployment hold prevents this code merge from releasing the schema-dependent application. Hosted schemas and activation settings were not changed.
