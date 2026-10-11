# Faroway release approval checklist

Prepared 2026-10-04. **No merge, production SQL, deployment configuration change, production canary, or provider activation is executed by this checklist.** The request to merge PR21/22 does not authorize prerequisite PR20 or database/security changes.

Current frozen integration and final verification are tracked in [release-integration.md](release-integration.md). The baselines below preserve the original phased rollout review.

## Verified release identity

| Item                    | Exact reviewed source                      | State at inspection                                                                    |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Production / `main`     | `4f68fe54eac618395a8ebb23d0d124f3799adb28` | Vercel `READY`, production alias verified                                              |
| PR20 price trust        | `9e4983aa2ac4a65e297ffb51611958eff7aedc73` | Open draft, targets `main`; not merged                                                 |
| PR21 recovery/sharing   | `a736aa36c17ab41b2b205098b3326bfc8ec10db8` | Open draft, targets PR20 branch; exact-head CI including build passed                  |
| PR22 editable brief     | `cd83a8ecce2927b9d721d215fcc3107cbebb6e96` | Open draft; timestamp-trigger correction tested locally; renewed exact-head CI pending |
| PR23 activity revisions | `9046c0f13ab841e327d49a09fb9d59c08e9284c9` | Separate draft under further review; excluded from the PR21/22 merge request           |

These are code-review baselines, not an instruction to deploy a moving branch. Re-resolve and record the final release/merge SHA, database target, and tested artifact immediately before approval. A later commit needs renewed exact-head verification.

Vercel target verified through the connected app: team `Testimonio` (`team_idxL5WtlJ0ci1y7tBwPL6AhC`), project `faroway` (`prj_fC34YwwfPMXckMb4vVpfkawHM17P`). `www.faroway.ai` resolves to deployment `dpl_5fXdSvLR7FA8D8ojFVapUQvuva6w`, production SHA above. Git branch pushes are producing automatic previews, and recent `main` commits have production deployments. The connector's normalized metadata does **not** expose the production auto-deploy policy or current runtime feature-flag values; a merge must be treated as potentially deploying immediately until an operator verifies a hold.

The parent thread's authorized read-only database review verified Supabase project `jcnephijkxgtprsutgsf` (`ACTIVE_HEALTHY`, `us-west-2`) and the Vercel production URL binding. The migration ledger ends at `20260725006000`; all six proposed migrations are absent. It includes `20260725002000_lock_down_tracking_and_search_rls`, so older checked-in policies alone do not describe current production permissions. Actual policies/functions are being reviewed separately. Backup/PITR, staging readiness, external workflow inventory, and controlled deployment hold remain unverified.

**Preview is not staging.** Read-only configuration metadata shows production, preview, and development use this same Supabase project, with service-role variable metadata scoped to all three. No Supabase development branches were found. Do not run preview write tests/canaries or use these environments for migration rehearsals. Existing tests use disposable local PostgreSQL and synthetic local browser services. An isolated staging target needs separate approval and verification; no keys were read or printed.

The database has 62 trips (47 planned, 15 failed), 59 searches (45 completed, 14 error), zero `workflow_runs` rows, and no recorded workflow-run bindings at inspection. This does **not** establish an external durable-job drain. Existing cleanup still marks old generation failed after one hour; 004000 remains required. Environment metadata lists neither `FAROWAY_PLANNING_PAUSED` nor `FAROWAY_PLAN_EDITING_ENABLED`; deployed artifact values and hold behavior still require verification.

The live `update_trips_updated_at` trigger calls transaction-stable `NOW()` after `protect_trip_brief`. A disposable reproduction demonstrated accepted stale edits inside one transaction. PR22's corrected 005000 replaces only this trip trigger binding with a strictly advancing timestamp (`max(clock_timestamp(), previous + 1 microsecond)`), preserving the shared function used by other tables. The regression now passes with the existing trigger setup. This is part of the explicit 005000 review, not an already-applied production fix.

## Safe production sequence for PR20 → PR21 → PR22

1. Obtain explicit approval for PR20 and the six SQL files below, their permissions/triggers, the maintenance controls, and a controlled deployment. Independently confirm the production auto-deploy hold/pause mechanism before any merge. The current production build does not honor the new planning-pause flag.
2. Rehearse against an isolated staging database using the actual deployed schema/roles and job definitions. Confirm backup/PITR and bounded DDL timeouts (proposed lock timeout 5 seconds, statement timeout 60 seconds). Inventory old HTTP writers, cron jobs, direct deployment URLs and durable runs. Positive workflow-backend evidence is required; elapsed time cannot establish a drain.
3. Apply only `20261003001000_fence_trip_generation.sql`, `20261003003000_protect_search_run_binding.sql`, and `20261003004000_require_terminal_generation_evidence.sql`, in controlled transactions. These install the service-only attempt RPC, protected server-verified search bindings, and non-mutating timeout cleanup. Historical bindings stay unverified. **Do not run a blanket migration push:** numeric order installs 002000 too early.
4. With deployment controls prepared, merge approved PR20 into `main`. Retarget PR21 to `main`, recheck review/CI, then merge PR21. Deploy/promote the reviewed PR21 artifact with `FAROWAY_PLANNING_PAUSED=true`; verify the production alias and new service-role share/revoke handlers. The merge/deployment mechanism must not briefly serve an unpaused or schema-incompatible artifact.
5. Positively drain old deployments, HTTP writes and durable jobs. Only then apply `20261003002000_protect_trip_lifecycle.sql`. It restricts authenticated lifecycle/sharing changes; old production share handlers are incompatible with it.
6. Keep brief editing unavailable during the next phase. Apply `20261003005000_version_trip_briefs.sql` and `20261003006000_version_checkout_handoffs.sql` before PR22 is served. 005000 restricts brief writes to the versioned RPC (including service-role old PATCH writers); 006000 adds the ledger trip revision and atomically checks it when publishing/revalidating a handoff. Old clients without a revision receive an unsupported-edit response with a website fallback. Planning pause alone is not an editing pause.
7. Retarget PR22 to `main`, recheck review/CI, then merge and serve its tested artifact under the same pause controls. Verify migration/function identities, grants and read-only health observations. Ask separately for any production write canary and for unpausing planning after staging and acceptance checks pass.

There is no fixed interruption estimate until run/queue inventory is known. New planning and brief writes are intentionally unavailable during cutover; saved-trip reads and sharing should remain available on a compatible paused release. DDL lock contention aborts its phase. Unidentified durable runs can extend the pause; do not reset them by age or blindly retry them.

## Required acceptance evidence

- Exact-head quality, unit, disposable PostgreSQL, full browser/compiled Workflow tests and normal production build pass. Current local SQL tests use a representative schema; they do not replace real-schema staging.
- Authenticated search binding/status/ownership/verification mutations, inserts and deletes are rejected; historical unverified bindings never release a generation claim. Only positive terminal SDK evidence permits retry.
- Concurrent generation claims have one winner; stale progress/final writes are rejected; interrupted creation and reads recover without another paid dispatch.
- Sharing requires consent, cancel explains remaining public access, revoke invalidates the token, and an older enable cannot revive it.
- Brief edits reject stale versions and active generation; direct service-role edits outside the RPC fail on planned/draft trips. Untouched legacy forms make no write. Previous plans remain saved, but all obsolete hotel/flight/activity actions and sharing are blocked.
- Deferred provider responses cannot publish checkout after a brief change. An already-open provider page cannot be revoked; the traveler still checks dates, party and final price at the provider. Clicks/handoffs are never counted as confirmed bookings or commissions.
- Supported mobile clients retain conflict edits and allow explicit compare/reapply/discard; native-device accessibility/layout still needs validation. Older clients have a website/upgrade path without a forced account change.

## Flags and separately gated increments

| Flag                                                      | Release intent                                                                                  | Current production value      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| `FAROWAY_PLANNING_PAUSED`                                 | `true` during cutover; separate approval to unpause                                             | Unverified                    |
| `FAROWAY_PLAN_EDITING_ENABLED`                            | Remain off; PR23/007000 require separate review and rollout                                     | Unverified; code defaults off |
| `VIATOR_CONTENT_ENABLED` + approval reference             | No activation in this release                                                                   | Unverified                    |
| `VIATOR_EXTERNAL_PROCESSING_ENABLED` + approval reference | No activation or expanded content processing                                                    | Unverified                    |
| `VIATOR_HOSTED_CHECKOUT_ENABLED`                          | No activation; also requires approved content, production provider configuration and partner ID | Unverified                    |
| `GOOGLE_PLACES_LIVE_ENABLED`                              | No activation; live display only                                                                | Unverified                    |
| `MET_WEATHER_ENABLED`                                     | No activation; verified public contact required                                                 | Unverified                    |

PR23's `20261003007000_revision_safe_plan_edits.sql` and any subsequent booking-checklist schema are **not** part of the six-file approval above. Neither flights nor optional provider features are a prerequisite for launching saved planning and approved experience handoffs.

## Rollback limits

Prefer a compatible paused application retaining new RPCs/protections. Rolling back directly to `4f68fe54` with 002000 installed breaks share/revoke; removing it reopens the old lifecycle-write vulnerability and requires explicit risk approval plus an independent ingress maintenance control. 005000 rejects older unversioned PATCH writers; do not silently remove that barrier. Keep generation RPCs while queued compatible workflows may resume, keep timeout cleanup non-mutating, and preserve accepted itineraries and revoked share tokens. Database restore/PITR and destructive cleanup are separate operations. A planning flag cannot cancel or retroactively fence old running code.

## Proposed owner approval wording

“Approve prerequisite PR20, followed by PR21 and PR22 into `main` in dependency order, only after final review and exact-head CI. Approve staging rehearsal and the six specifically named SQL migrations in this checklist's order, including service-only RPCs, authenticated lifecycle/search restrictions, the brief-write barrier and revision-bound checkout ledger. Approve a controlled planning/editing maintenance window and deployment pause/hold configuration on the verified Faroway target. Require the database operator to confirm the Supabase target, backup, schema/grants and old-run drain before each phase. Keep provider flags unchanged. Ask me separately before production write canaries, unpausing, PR23/schema007000, any destructive rollback, or provider activation.”

That wording is a proposed bounded approval request, not received authorization. Read-only database access does not authorize production SQL or canaries.

## Separate existing security prerequisites

The read-only database review found `get_user_push_tokens(uuid)` and `deactivate_push_token(text)` executable by `anon`/`authenticated` while `SECURITY DEFINER` and without caller ownership checks. Their checked-in definitions in `20260220100000_push_tokens.sql` match that mechanism. The token table currently has zero rows; neither RPC was invoked. `affiliate_stats` is an owner-security aggregate view with client SELECT grants; its definition in `20260206_affiliate_tracking.sql` aggregates all clicks. Current table RLS from the July lockdown does not by itself make an owner-security view safe.

Propose a separate focused migration, outside the six-file rollout: revoke these RPCs from PUBLIC/anon/authenticated and grant only service_role, with fixed search_path and schema-qualified table references; revoke client access to affiliate_stats and allow service_role only. No application callers of these named RPCs/view were found in apps or packages. Confirm external jobs before changing access; any future traveler-facing aggregate endpoint needs explicit owner scoping. Local regression coverage should seed two users, reject anonymous/authenticated token reads/deactivation and view reads, permit service operations, and confirm ordinary owner-scoped token management remains functional. Require explicit production approval for this additional permission change. Do not describe production as secured by the six planned migrations alone.
