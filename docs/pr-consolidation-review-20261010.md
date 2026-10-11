# Outstanding PR review and consolidation — 2026-10-10

The recommended release path is one reviewed candidate through PR33, followed by retirement of the superseded stack. Do not merge all historical PRs into production first. PR33 is structurally mergeable and its existing GitHub checks pass, but database prerequisites and a controlled cutover still block production release.

This review fixes confirmed recovery and account-boundary defects on `review/pr-consolidation-20261010`, based on candidate `4825851cc38d61c6c0c378a7d51b67712f7945af`. Its PR should target `codex/release-candidate`, not auto-deploying `main`. No existing PR was merged, closed or rewritten; no external SQL, release configuration, provider activation or production write test was performed.

## Repository and review scope

- Main: `5a8eadf06f596f81e8bcc0f4d90d3e58518c83eb`.
- Open PR inventory: all 13 PRs, including metadata, bases, heads, checks, comments and review threads. No review threads or submitted reviewer approvals were present at inspection. Checks are snapshots, not deployment approvals.
- The integrated candidate differs from main across 176 files. Source review focused on changed behavior: creation and generation claims/reconciliation, owner-scoped reads and sharing, versioned briefs/plans/checkout/booking reports, native consent/recovery/outbound links, deletion and push ownership, privileged SQL and rollout controls. Complete local quality/unit suites and disposable SQL/browser suites supplement that source review. This is not a line-by-line audit of every unchanged application file.
- All 11 open stack heads (#21–23, #25–32) are ancestors of PR33. PR18 is not an ancestor. Refresh immediately before merge if any head changes.
- Original working directory: branch `fix/production-review-regressions-20260904`, head `bf19f60`, with 53 modified tracked paths and 52 untracked files. It has one unique committed change against main and is five commits behind main. Against PR33 it has one unique commit and is 46 commits behind. 44 of its 53 modified tracked paths overlap the candidate.
- Original work was preserved in `/Users/stanley/Workspace/mobile/faroway-review-backup-20261010/` (`tracked.patch`, `untracked.tar.gz`, `head.txt`) before creating the separate review worktree. Selected deadlines and creation-recovery ideas were reconciled; the rest of the September journals, pricing changes and evidence remain preserved for a separate comparison. This review does not claim that every local change has been integrated.

## Per-PR disposition

| PR                                                                                 | Reviewed head  | GitHub state at inspection                             | Disposition / next action                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [18](https://github.com/stanleycyang/faroway/pull/18) Trip-planning UX             | `f5c6cfab2692` | Conflicts with main; format fails; tests/build skipped | Replace through selective salvage in this review. Do not merge the stale automatic-generation/draft implementation. Retire after retained improvements land and omitted structural work is explicitly deferred. |
| [21](https://github.com/stanleycyang/faroway/pull/21) Recovery/sharing             | `a736aa36c17a` | Draft, clean; CI and preview pass                      | Included in #33; retire after consolidated release lands.                                                                                                                                                       |
| [22](https://github.com/stanleycyang/faroway/pull/22) Editable brief               | `cd83a8ecce29` | Draft, clean; CI and preview pass                      | Included in #33; revision/schema rollout is still required.                                                                                                                                                     |
| [23](https://github.com/stanleycyang/faroway/pull/23) Plan revisions               | `452607275af2` | Draft, clean; CI and preview pass                      | Included in #33; optional gate stays off until acceptance.                                                                                                                                                      |
| [25](https://github.com/stanleycyang/faroway/pull/25) Booking checklist            | `e54c285da192` | Draft, clean; CI and preview pass                      | Included in #33; optional gate stays off until acceptance.                                                                                                                                                      |
| [26](https://github.com/stanleycyang/faroway/pull/26) Release integration          | `39e18f404941` | Draft, conflicts; CI passes, preview fails             | Superseded by #33; do not spend effort repairing this historical main integration.                                                                                                                              |
| [27](https://github.com/stanleycyang/faroway/pull/27) Staging bootstrap            | `ceda7873a706` | Draft, mergeable; CI passes, preview fails             | Included in #33. Frozen bootstrap approval is not proof of execution.                                                                                                                                           |
| [28](https://github.com/stanleycyang/faroway/pull/28) Native outbound safety       | `8a3a7ac438f3` | Draft, mergeable; CI passes, preview fails             | Included in #33; signed-device handoff evidence remains required.                                                                                                                                               |
| [29](https://github.com/stanleycyang/faroway/pull/29) Web outbound safety          | `629b68227ca8` | Draft, mergeable; CI passes, preview fails             | Included in #33; supported handoffs remain server-reviewed; unsupported links stay inert.                                                                                                                       |
| [30](https://github.com/stanleycyang/faroway/pull/30) Native AI consent            | `166f5f9a1056` | Draft, mergeable; CI passes, preview fails             | Included in #33; deadline and cancellation regressions fixed here.                                                                                                                                              |
| [31](https://github.com/stanleycyang/faroway/pull/31) Push opt-in                  | `d68eafc04368` | Draft, mergeable; CI passes, preview fails             | Included in #33; separate account/push schema and real-device verification remain required.                                                                                                                     |
| [32](https://github.com/stanleycyang/faroway/pull/32) Apple revocation preparation | `b0fd4a9f9f0d` | Draft, mergeable; CI passes, preview fails             | Included in #33; preparation does not establish live Apple revocation readiness.                                                                                                                                |
| [33](https://github.com/stanleycyang/faroway/pull/33) Integrated candidate         | `4825851cc38d` | Draft, clean; CI and preview pass                      | Keep as the single release PR. Accept these fixes, review the new SQL, obtain staging evidence and establish a controlled schema/API cutover before main merge.                                                 |

The failed historical previews were not retested or repaired independently; the maintained candidate already has a successful preview. No current external deployment or database configuration is inferred from that success.

## Confirmed issues fixed

### Creation identity and deletion recovery — high

The old keyed create path used a trip UUID as the only durable identity. Deleting the trip removed that identity, so a delayed retry could recreate it. A private receipt now survives trip deletion, atomically creates the trip, rejects changed-input reuse, returns current state on replay, and returns HTTP 410 for deleted trips. Missing schema returns a retryable 503 instead of silently falling back to an unsafe insert. Existing keyed trips are adopted without overwriting edited briefs. Cross-owner UUID collisions do not expose a trip.

Native planning now persists an account-specific request and frozen choices before I/O, reuses it after lost replies/restarts, restores unfinished choices, and provides an explicit fresh-trip action. Corrupt or changed requests are retained. Completed startup clears only the matching receipt. Account deletion clears that account's receipt.

Offline creates also persist a request UUID in the queue. New mutations retain their account owner; requests use that owner's session and reject account changes before and after response reading. Late trip lists cannot publish after a detected account change. Older requests without a verified owner or safe creation identity stay blocked for review instead of being automatically uploaded. A reviewed older brief edit can be explicitly reapplied through the current authenticated, versioned server route.

### Interrupted requests and cancellation — medium

Native timers previously ended after headers, leaving stalled JSON bodies unbounded. The shared request helper now bounds headers and response reading, settles even when a transport ignores abort, rejects canceled/late results and removes timers/listeners. Planning disclosure, dispatch, recovery, polling, API and offline sync use it. Polling cancellation throws rather than returning a false completion; stale XHR callbacks cannot update a replaced stream.

Web creation, disclosure, brief/plan/booking saves, checkout history, status, sharing and retry actions now have bounded requests. Pending commands remain available after uncertain responses; the deadline does not imply that a server write failed. Invalid/null disclosure metadata fails before consent.

### Offline edit retention — high

After three failures, the queue previously removed a mutation. It now retains and blocks it for explicit review/discard, reports a failed sync, and does not record partial failure as successful. Malformed creation responses do not remove the local request. Creation conflicts/deletion tombstones stop automatic replay.

### Retained PR18 UX — medium/low

Ported contextual login/signup copy while preserving current redirect validation; missing destination/date guidance and “Keep editing”; clearer interrupted generation/auth messages; traveler-facing phase labels; valid store-listing checks and removal of unavailable rating actions. Landing copy now explicitly describes sign-in and AI-sharing review before generation. Placeholder IDs, credentials and unsupported store URL schemes are rejected. Existing consent, account binding and generation fences remain in place.

The previous PR18 salvage of truthful generation counts/prices remains in the candidate. Optional landing/generation component extraction and PR18's alternate draft format/automatic post-login dispatch were not transplanted. PR18's existing CI failed formatting in `storeReview.test.ts`, `useStreamingItinerary.ts` and `tripRequirements.ts`; the retained versions pass current formatting checks here. Its original branch remains unchanged.

## SQL review and release boundary

New SQL: [trip-creation-recovery.sql](../supabase/release-candidate/trip-creation-recovery.sql), SHA256 `5d297725a25557476903f0e69d792c520168896f95a086e7bfa3884630520939`.

This is a separate review candidate transaction, not an applied or registered migration. It must be reviewed/promoted through the migration workflow and installed before the updated keyed-create route or native client. The table is RLS-enabled; clients cannot read/write it or execute its RPC; the service role cannot directly mutate receipts. The RPC has a fixed search path, an account-write advisory lock, uniqueness serialization and account-cascade cleanup. Receipts retain fingerprints rather than deleted trip inputs. Tombstones must remain while delayed/restarted clients can replay; do not introduce an arbitrary TTL that permits recreation.

The frozen staging bootstrap and its manifest are unchanged. Bootstrap SHA256 remains `09b820436a77967f95024abf4f724f4f2f1bb1d3378ee33b73656593ba729939`. Existing separate account/push SQL remains `f40d6c7509005fde86b0c8b5c1b9304fc774db6148017447150868a91e4d8eb6`. Creation rehearsal also installs the account/push transaction and verifies deletion/write exclusion and Auth cascade cleanup.

## React audit scope and coverage

Mode A, three files: native route `app/create/index.tsx`, custom hook `useStreamingItinerary.ts`, and web client component `ItineraryGenerationLoader.tsx`. Categories swept in order: 1 concurrent rendering, 2 server components, 3 actions/forms, 4 data fetching, 5 state, 6 memoization/performance, 7 effects/events, 8 component patterns, 9 shared code hygiene. Files were read in full; rules were assessed by behavior, not solely by identifier searches. React 19.2-only APIs were not introduced into this React 19.1 application.

| Category                  | Native create route                                                                         | Streaming hook                          | Web loader                     |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------ |
| 1 Concurrent rendering    | clean                                                                                       | clean                                   | clean                          |
| 2 Server components       | n/a (native)                                                                                | n/a (native)                            | clean client boundary          |
| 3 Actions/forms           | 1 finding fixed: explain validation                                                         | n/a                                     | n/a                            |
| 4 Data fetching           | clean asynchronous storage recovery                                                         | 1 finding fixed: bounded/canceled reads | n/a                            |
| 5 State management        | 1 finding fixed: recovery owner checks                                                      | clean functional stream updates         | clean derived display          |
| 6 Memoization/performance | clean within small inventory                                                                | clean callback/input identity           | clean bounded step calculation |
| 7 Effects/events          | 1 finding fixed: account dependency and late callbacks                                      | cancellation fix shared with category 4 | n/a                            |
| 8 Component patterns      | clean                                                                                       | n/a                                     | clean structured display props |
| 9 Codebase hygiene        | full three-file inventory: no duplicate/dead component finding; production callers verified | clean                                   | clean                          |

The recovery account callback finding is in the create screen's restore/fresh-trip handlers; async effects depend on `userId` and ignore obsolete owner results. The streaming finding is in the startup/XHR/poll lifecycle. These apply the [effect cleanup rule](../../../../.agents/skills/react/references/effect-cleanup.md) and [functional state update rule](../../../../.agents/skills/react/references/rstate-functional-updates.md); rule files are local skill references, not repository dependencies. This scoped React sweep does not claim whole-app accessibility, performance profiling or signed-device coverage.

## Verification

Final local results: 616 web tests, 315 mobile tests, 103 shared-package tests, 8 script tests; 32 full-app recovery browser cases; disposable creation SQL rehearsal passed all four groups. All 11 quality tasks and all 28 checkout/places browser cases also passed. Hosted checks are tracked in the accompanying PR. Local logs are retained in the backup directory; they are not uploaded as production evidence.

Executed baseline checks: all 11 quality tasks; 604 web / 255 mobile / 103 shared-package unit tests plus 8 script tests; 13 planning-rubric fixtures with 13 expected classifications; four PostgreSQL suites; 28 checkout browser cases and 28 full-app recovery cases. These established the candidate baseline before fixes.

Final verification includes the complete unit/quality suites, the new durable-creation PostgreSQL rehearsal, and desktop/mobile browser cases for existing recovery journeys, deleted-trip tombstones and stalled creation. Recovery browser tests compile the actual app/workflow using isolated synthetic credentials and services. Initial missing Chromium and test-fixture auth errors were corrected; only subsequent successful runs qualify as final evidence.

Disposable PostgreSQL coverage: generation CAS/stale claims and publication fences; strict revisions and editing/checkout/booking races; privileged API denial; deterministic frozen bootstrap; account-write/deletion ordering and independent device proofs; push owner/revision/dispatch claims; concurrent creation replay/backfill/rollback/deletion tombstones. No SQL was executed on a hosted database.

## Next steps, in order

1. Review and merge the focused fix PR into `codex/release-candidate`; refresh #33's head/checks and obtain reviewer acceptance for the consolidated change. Keep the release draft until operational prerequisites are satisfied.
2. Reconcile the actual isolated staging bootstrap execution receipt and current target/schema. Separately review the exact account/push and creation-recovery SQL and register the approved follow-ups. Do not modify or rerun the fresh-install bootstrap on a populated database.
3. Verify staging API/key provenance and native API/Supabase bindings without exposing secrets. Existing documentation's environment findings are historical and need fresh operator confirmation. Keep planning paused and optional/provider/push-delivery gates off initially.
4. Rehearse the combined schema/API artifact and recovery paths in staging. Obtain signed iOS/Android consent, account-switch, offline/restart, push and Apple-deletion evidence; real supplier checkout/attribution and live model quality remain separate acceptance work. Synthetic fixtures do not prove these outcomes.
5. Prepare the exact production migration ledger/order, deployment hold, backup/compatible rollback, write pause and positive old-workflow drain. Core generation/brief/checkout schema is required even with optional features disabled. Do not run a blanket migration push or merge into auto-deploying main before this is ready. Obtain approval for the concrete cutover and canaries/unpause.
6. Merge/deploy the reviewed #33 artifact through that controlled cutover. After it lands, close the superseded stack and PR18 with links to the retained work; create fresh branches from main for genuinely new work.
7. Compare the preserved September local work against the landed candidate in small feature groups. Do not overwrite the current dirty tree or blanket-cherry-pick overlapping journal/pricing code.

Until steps 2–5 are evidenced, no outstanding release PR is recommended for an independent production merge. Code consolidation and production readiness are separate checkpoints.
