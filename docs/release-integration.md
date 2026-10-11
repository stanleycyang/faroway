# Frozen release integration

This draft combines the reviewed trip stack with the independent database-access and preview-isolation changes. It adds release evidence and an offline evaluation CI step, not new product features. It does not authorize main-branch merge, deployment, infrastructure, settings changes, production SQL or bookings.

## Exact source history

| PR                                                    | Reviewed head                              | Original base | Exact-head CI                                                              |
| ----------------------------------------------------- | ------------------------------------------ | ------------- | -------------------------------------------------------------------------- |
| [20](https://github.com/stanleycyang/faroway/pull/20) | `9e4983aa2ac4a65e297ffb51611958eff7aedc73` | main          | [passed](https://github.com/stanleycyang/faroway/actions/runs/37156312866) |
| [21](https://github.com/stanleycyang/faroway/pull/21) | `a736aa36c17ab41b2b205098b3326bfc8ec10db8` | PR20 branch   | [passed](https://github.com/stanleycyang/faroway/actions/runs/37161507844) |
| [22](https://github.com/stanleycyang/faroway/pull/22) | `cd83a8ecce2927b9d721d215fcc3107cbebb6e96` | PR21 branch   | [passed](https://github.com/stanleycyang/faroway/actions/runs/37164369659) |
| [23](https://github.com/stanleycyang/faroway/pull/23) | `452607275af21ae9f28e8444b9c5f5426978db97` | PR22 branch   | [passed](https://github.com/stanleycyang/faroway/actions/runs/37164445913) |
| [24](https://github.com/stanleycyang/faroway/pull/24) | `69258fb5200981a6e9b6bff607ac629ecbf00eec` | main          | [passed](https://github.com/stanleycyang/faroway/actions/runs/37164860701) |
| [25](https://github.com/stanleycyang/faroway/pull/25) | `e54c285da1927267a2758cc11b256caca2416aa2` | PR23 branch   | [passed](https://github.com/stanleycyang/faroway/actions/runs/37165716834) |

`codex/release-integration` starts at PR25 and merges PR24 with a merge commit, preserving every original branch/history/dependency. Integration merge `1f9a4cb` retains both PostgreSQL CI steps and PR24's Next configuration guard. The integration PR records its final exact head and CI result; source-head passes above do not substitute for integrated-head CI. Main remains unchanged at `4f68fe54eac618395a8ebb23d0d124f3799adb28` at preparation.

## Verification and its limits

- The source stack passed 811 unit/script tests, 26 production-build desktop/mobile recovery cases, 28 hosted-checkout cases (54 browser cases total), typecheck/lint/formatting, disposable PostgreSQL invariants and production builds. PR24 adds four isolation unit cases and its separate privileged-database suite; integrated expected unit/script count is 815.
- [Fixture journey](release-evidence/fixture-journey.json) maps capture/recovery, constraint assessment, brief editing, locks/swaps, sharing, stale checkout prevention and booking-report recovery to executable tests. The phases use independent fixtures, not one continuous live-model/supplier purchase trace.
- Run `python3 scripts/planning-quality-eval.py`. [Fixtures](../scripts/fixtures/planning-quality.json) and [recorded results](release-evidence/planning-quality-results.json) cover family, step-free and dietary/slow-paced constraints. All 3 acceptable fixtures pass and all 10 adversarial fixtures fail the expected check. The CI step verifies these exact outcomes.
- This is rubric calibration on synthetic plans. It does not measure actual model output quality, supplier inventory, prices, accessibility, menus, opening hours or travel time. Model-quality evaluation with actual generations remains separately approval-gated; no paid calls ran.
- Real PostgreSQL tests cover ownership, immutable history, observed revisions, race winners, exact replay, generation isolation and unchanged commission state. Browser persistence/provider replies are synthetic and independently tested from SQL.
- Parent reports scoped PR24/25 review found no new blocking authorization, concurrency or false-booking defect. Native-device UI and actual-schema staging remain unverified.

## Environment boundary

The integrated source contains PR24's preview/development build guard. **It is not proof of staging isolation.** Read-only inspection found production, preview and development configurations point to Supabase `jcnephijkxgtprsutgsf`, and service-role variable metadata spans all three. Existing built previews retain their configuration and are not protected by a later source change. Do not run write tests against those URLs.

The guard requires a separate approved project reference matching the public Supabase URL. The operator must independently verify credential provenance/scopes, immutable deployment bindings and absence of production hooks/cron before staging writes. The guard does not inspect secret values or create infrastructure. A build blocked by today's shared settings is acceptable and must not be bypassed.

PR24 deployment `dpl_BS2nG7m56mQLBnE8AW13T6Si5qND` is ERROR with `BUILD_UTILS_SPAWN_1`. Metadata proves only that the build command failed. The advertised build-log connector returns Unknown tool, including on retry, so isolation rejection remains an expected but unverified cause. No access expansion or settings changes were attempted.

## Nine migration files and ordering

Never run a blanket migration push. [Detailed six-file approval sequence](release-approval-checklist.md) and rollback limits still apply.

| Phase                                              | Migration                                                 | Condition                                                                           |
| -------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Before new writers                                 | `20261003001000_fence_trip_generation.sql`                | Service-only attempt fence                                                          |
| Before new writers                                 | `20261003003000_protect_search_run_binding.sql`           | Server-verified workflow bindings                                                   |
| Before new writers                                 | `20261003004000_require_terminal_generation_evidence.sql` | Disable age-based claim release                                                     |
| After compatible app and positive old-writer drain | `20261003002000_protect_trip_lifecycle.sql`               | Old user-scoped sharing is incompatible                                             |
| Before brief editing                               | `20261003005000_version_trip_briefs.sql`                  | Corrected monotonic timestamp trigger from cd83a8e                                  |
| Before versioned handoffs                          | `20261003006000_version_checkout_handoffs.sql`            | Atomic observed-revision handoff publication                                        |
| Separate feature approval                          | `20261003007000_revision_safe_plan_edits.sql`             | Corrected005 first; plan-editing flag initially off                                 |
| Separate feature approval                          | `20261003008000_trip_booking_checklist.sql`               | Corrected005 and007 first; checklist flag initially off                             |
| Independent security approval                      | `20261004001000_restrict_privileged_database_helpers.sql` | Restrict token helper/global-view client grants; preserve legitimate server callers |

All are unexecuted in production. [008000 decision record](release-evidence/migration-008-rollout.txt) requires actual itinerary count/bytes and lock-duration evidence. The volatile UUID default may rewrite existing rows. Proposed bounds are 2-second lock timeout and 30-second statement timeout for that phase, with transaction abort and no automatic retry; these are approval proposals, not a guaranteed interruption duration. A nullable-column/batched-backfill/validated-constraint alternative is documented but not implemented or tested and needs a revised migration review if selected. Do not infer itinerary size from trip counts. [PostgreSQL's volatile-default guidance](https://www.postgresql.org/docs/16/ddl-alter.html).

## Bounded remaining decisions

1. **Next decision: approve isolated staging setup only.** Specify the Supabase target/region, owner/operator, spending limit and retention; authorize removing production configuration inheritance from non-production scopes and using separately issued staging credentials. Separately decide how to restrict already-built previews. No production SQL or main merge is included.
2. Verify the resulting immutable staging deployment's URL and credential scopes, disable live paid providers/outbound notifications and production hooks, then authorize synthetic staging writes. Rehearse actual schema/roles, including already-deployed July RLS, against the exact integrated artifact.
3. Confirm backup/PITR, maintenance and deployment hold controls, measured DDL bounds, and positive external durable-job drain. Empty workflow tables/bindings do not prove a drain; unknown dispatch identity remains fail-closed. The old production app does not honor the new planning-pause flag.
4. Obtain explicit approval for main merge, controlled cutover and the named SQL/security phases after rehearsal/review. Keep feature/provider gates off initially. Separately authorize production canaries and unpause/enablement; preserve restrictions during rollback.
5. Before commercial checkout launch, verify partner/content/processing approvals, production attribution, live price and final supplier checkout behavior. No prepared URL, click, traveler report or return visit proves booking or commission.

## Smallest launchable scope and remaining gaps

Launch saved planning with honest estimates, editable briefs, reliable recovery and explicit sharing. Add reviewed activity locks/swaps and the traveler checklist only after their separate gates. Offer only approved supplier-hosted handoffs with explicit consent and final provider price review.

AI-generated alternative suggestions, hotel/flight/dining editing, native checklist UI, independently verified booking/cancellation/refund ingestion and commission reconciliation remain out of scope. Flights and universal bundled checkout are not prerequisites for this bounded launch. Product quality beyond deterministic fixtures still needs the separately approved generation evaluation described above.
