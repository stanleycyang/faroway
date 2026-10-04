# Faroway release verification and cutover checklist

Verified on 2026-10-04. The runtime candidate is **`68e1b247db430b8650bdeeb74a24364f6beba2c2`** in [draft PR33](https://github.com/stanleycyang/faroway/pull/33). The parent relayed independent clearance of this exact SHA for SQL/concurrency and mobile consent/recovery/push. This document is a separate documentation-only change; it does not change that reviewed runtime identity or authorize deployment.

## Verified evidence

[Push CI 37237140588](https://github.com/stanleycyang/faroway/actions/runs/37237140588) and [PR CI 37237143510](https://github.com/stanleycyang/faroway/actions/runs/37237143510) both passed quality checks, tests and web build at the runtime SHA above:

- 604 web, 226 mobile and 103 shared-package tests; 28 hosted-checkout and 28 full-app desktop/mobile recovery browser checks.
- Disposable PostgreSQL tests: generation and privilege boundaries, frozen bootstrap rehearsal, deletion/write serialization, service-role parent-first itinerary cascade, two-device recovery proof retention/expiry/cap, token ownership/order and dispatch claims.
- Mobile delayed-removal tests preserve another account's writes, including partial removal failure. Category grants require submitted current consent; local recovery proof survives failed cleanup. Ordered push revocation persists when registration is disabled.

These use synthetic browser/provider responses and disposable databases. They do not establish actual supplier prices, booking/commission confirmation, live model quality, Apple revocation, OS push delivery or signed-device readiness.

## Production and unresolved code scope

PR20 and PR24 were independently cleared and merged with merge commits. Main is **`5a8eadf06f596f81e8bcc0f4d90d3e58518c83eb`**. Vercel production deployment `dpl_2RFYSiq4ynRTt67okcCFkBTUwfyV` is READY and assigned to `faroway.ai` / `www.faroway.ai`. Aggregate telemetry showed successful function responses and no logged 5xx/error/fatal entries in the checked 30-minute window. Direct HTTP verification remains blocked by this environment's 403 restriction; no bypass was used. No production SQL was executed, so PR24's live database privilege changes are **not applied** by its code merge.

No blocker remains reported within the two independent review scopes. A separate [PR18 read-only audit](pr18-reconciliation.md) found an unresolved truthfulness defect outside those scopes: the mobile loader invents a count of ten hotels from one preview. Selectively fix that before calling the full candidate production-ready. Other PR18 UX improvements are recorded there; PR18 remains open, unmerged and unmodified. PR33 is not yet safe to merge into auto-deploy main: generation, brief editing and checkout have schema prerequisites even with optional feature flags off.

## Minimum staging approvals

1. **Already approved original bootstrap:** [bootstrap.sql](../supabase/staging/approval/bootstrap.sql), SHA256 `09b820436a77967f95024abf4f724f4f2f1bb1d3378ee33b73656593ba729939`, exclusively for `faroway-staging` / `omovikloadpvzijoaqus`. [Approval identity](../supabase/staging/approval/approval.json) and [manifest](../supabase/staging/manifest.json) pin its schema, guards, grants and synthetic content. Approval is not proof of execution. Reconcile the operator's execution receipt and fresh target/schema checks; do not rerun a fresh-install bundle on a populated target. It is never a production migration.
2. **New approval needed:** apply [account-and-push.sql](../supabase/release-candidate/account-and-push.sql) as one separately reviewed transaction to that isolated, successfully bootstrapped target. SHA256 **`f40d6c7509005fde86b0c8b5c1b9304fc774db6148017447150868a91e4d8eb6`**. This adds private deletion receipts/proofs, account-write fences, category consent, unique/ordered push registration and dispatch claims. It invalidates legacy grants and ambiguous token ownership. The original bootstrap approval does not cover it. Preserve all unexpired device proofs (up to 32, 30 days each) and push tombstones. Do not alter the frozen bootstrap to include it.
3. **Configuration approval needed:** bind non-production web URL/key metadata and server-only `SUPABASE_SERVICE_ROLE_KEY` exclusively to the isolated project; set `FAROWAY_STAGING_SUPABASE_PROJECT_REF=omovikloadpvzijoaqus`. Native staging must use matching `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and the isolated `EXPO_PUBLIC_API_URL`. The guard checks project URL identity; an operator must separately verify key provenance, scopes and absence of production hooks. Never transmit secret values in reports.
4. Keep `ACCOUNT_DELETION_ENABLED`, `PUSH_CONSENT_V2_ENABLED`, `PUSH_DELIVERY_ENABLED`, `FAROWAY_PLAN_EDITING_ENABLED`, `FAROWAY_BOOKING_CHECKLIST_ENABLED` and provider activation flags off initially; keep `FAROWAY_PLANNING_PAUSED=true`. Approve synthetic staging writes separately. Staging AI evaluation needs approved Gateway access and a bounded spend allocation within the owner's total $200/month ceiling; budget approval alone does not activate providers.
5. To test Apple deletion, separately approve server configuration of `APPLE_DELETION_CLIENT_ID`, `APPLE_DELETION_CLIENT_SECRET` and `ACCOUNT_DELETION_ENCRYPTION_KEY`, plus secure custody/rotation, then enable deletion only after schema checks. Enable push consent only after schema checks; delivery stays off until separately approved real-device testing. Existing Apple/Expo access does not itself prove these bindings or authorize new agreements/credentials.

## Production cutover approval still required

The approved fresh staging bootstrap must never be applied to production. Reconcile the live migration ledger first, then approve the exact outstanding migration files, maintenance controls, backup/rollback artifact and measured lock bounds described in [release-integration.md](release-integration.md) and [release-approval-checklist.md](release-approval-checklist.md). Their old merge/branch snapshots are historical; this report supplies current status.

- Before compatible new writers: `20261003000000_met_weather_cache.sql`, `20261003001000_fence_trip_generation.sql`, `20261003003000_protect_search_run_binding.sql`, `20261003004000_require_terminal_generation_evidence.sql`.
- Only after compatible service handlers and positively verified old HTTP/job drain: `20261003002000_protect_trip_lifecycle.sql`.
- Before versioned brief/checkout handlers: `20261003005000_version_trip_briefs.sql`, `20261003006000_version_checkout_handoffs.sql`.
- Reviewed optional-feature schema: `20261003007000_revision_safe_plan_edits.sql`, `20261003008000_trip_booking_checklist.sql`; keep gates off until acceptance.
- Separately approved security change: `20261004001000_restrict_privileged_database_helpers.sql`.
- Separately approved account/push candidate above, after its actual-schema staging rehearsal. Register it through the migration workflow without modifying its reviewed SQL or the frozen bundle.

Do not run a blanket migration push: numeric order enables lifecycle restrictions too early. The old production app cannot provide the new planning pause; establish deployment/ingress controls first, hold brief writes too, and positively drain durable jobs. Returning to an incompatible old binary is not a safe rollback after restrictive SQL. Merge/deploy PR33 only when its schema and controlled cutover are ready; approve production write canaries and unpausing separately. Signed-device and partner checkout/attribution evidence remains outstanding. No external setup is authorized by this document.
