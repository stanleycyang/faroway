# Production launch status

Goal: a verified mobile-and-web release candidate with attributable affiliate revenue. Last updated: September 4, 2026.

Status terms: **actionable** = implementation or local verification remains; **partial** = some listed checks pass but the gate remains open; **external** = access, approval, or a real environment/device is required; **verified** = the listed evidence directly establishes that gate. No gate is complete based only on intent or mock results.

| Gate                                       | Status                | Required evidence / next action                                                                                                                                   | Owner                                        |
| ------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Viator URL attribution                     | Partial               | Local GET/POST, URL validation and rendering regressions pass; partner-side campaign recognition and real reconciliation remain unverified                        | Codex + partner account owner                |
| Generation timeout and recovery            | Partial               | Same-trip retry/reconnect, deadline, cancellation, polling and SSE regressions pass; persistent recovery across restart remains open                              | Codex                                        |
| Atomic generation and stale-run protection | Partial               | 12 real PostgreSQL transaction tests pass; target rollout, durable dispatch recovery, stable client keys and deployed runtime verification remain open            | Codex; target migration approval: Stanley    |
| Truthful itinerary presentation            | Actionable            | No invented prices, ratings or currencies; unavailable values are explicit; booking CTAs use verified URLs                                                        | Codex                                        |
| Core web/mobile journeys and accessibility | Actionable            | Signed-in/out auth, draft restore, edits, saving/sharing, deletion, offline sync, empty/error/loading states, responsive/accessible interactions                  | Codex                                        |
| One production affiliate partner           | External              | Production approval, live inventory, account attribution, controlled booking/cancellation or partner-approved equivalent                                          | Stanley / partner account owner              |
| Real conversion reporting                  | Actionable + external | Select actual partner-supported reports/postback/webhook, implement adapter, reconcile real partner and Faroway records                                           | Codex + Stanley / partner account owner      |
| Release environment                        | External              | Confirm target environment and securely supply rate-limit salt, cron secret, web/mobile monitoring and selected reporting credentials; rerun release checks       | Stanley / deployment owner                   |
| Database and deployed workflow security    | External              | Approved migration deployment; verify ownership/RLS, RPCs, cleanup, durable execution and stale/failure handling in the target project                            | Stanley approves; Codex verifies with access |
| Observability, usage controls and recovery | Actionable + external | Error alerts, funnel metrics, AI/provider usage limits, backup/restore and rollback exercise                                                                      | Codex + deployment owner                     |
| Dependency/security assessment             | Actionable            | Fresh audit completed: 64 advisory entries (41 high, 21 moderate, 2 low) across 10 packages; transitive dependency remediation and reachability assessment remain | Codex                                        |
| Automated release gates                    | Partial               | 826 unit/integration tests, 12 PostgreSQL tests, 11 quality tasks, web production build and all-platform Expo export pass; native release verification remains    | Codex                                        |
| Native device release QA                   | External              | Installed iOS/Android builds: auth/deep links, background/resume, offline persistence, booking handoff, notification permission/taps                              | Stanley / device QA owner                    |
| Final go/no-go                             | Not ready             | All required gates evidenced; known blockers closed; approved deployment and rollback instructions                                                                | Codex report; Stanley release decision       |

## Evidence baseline

The preceding review follow-up recorded 725 unit/integration tests, 72 production-browser cases, 11 quality tasks, and a successful production build. Those results predate this goal's changes and do not prove live partner attribution, deployed Supabase behavior, or native-device readiness. See [the prior follow-up](../artifacts/bug-audit-2026-09-03/review-followup-2026-09-04.md).

The local web environment check most recently reported missing `IP_HASH_SALT`, `CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, and `VIATOR_WEBHOOK_SECRET`. The latter is an existing checker requirement, not evidence that Viator supplies a compatible webhook. The real reporting contract must determine which credentials are required. Local configuration is not proof of Vercel/EAS production configuration.

## Current implementation evidence

September 4 first goal pass:

- Viator provider parameters are preserved; click correlation uses `campaign`, not `mcid`. No fabricated fallback product URLs. Shared validation rejects malformed attribution; booking renderers keep invalid legacy activities informational.
- Mobile request deadlines settle the loading state and report a recoverable error. The trip ID is retained before the generation request. Cancelled requests cannot start generation from a late create response or report late polling completion. This is not yet persistent recovery across app restarts.
- Behavioral regressions reproduced two attribution failures and six generation lifecycle failures before their fixes. The full suites now pass: 458 web + 178 mobile + 116 shared + 3 script tests = 755, with 11/11 formatting/lint/type tasks passing.
- The fresh dependency audit is **not clean**. See [the initial dependency assessment](../artifacts/bug-audit-2026-09-03/production-dependency-assessment-2026-09-04.md). Audit severity is not proof of application-level exploitability; unresolved findings remain on the launch checklist.
- No production deployment, migration, partner account change, booking or external communication was performed.

September 4 generation transaction pass:

- Initialization, quota consumption, compatibility tracking and preview now commit together; keyed retries return the original attempt without dispatching again. Fenced workflow progress/failure/completion prevents older attempts from overwriting the current trip. Completion rolls back entirely on persistence failure and is safe to retry without duplicating notifications or overwriting later edits.
- The migration also corrects itinerary activity/meal ID columns to hold provider strings, preserving existing UUID values as text. The previous UUID-only columns rejected valid provider IDs.
- A fresh isolated PostgreSQL 18.4 cluster passed 12 transaction tests, including eight actually lock-contending starts, replay/quota races, injected write failures, ownership/privileges, stale workers and legacy cleanup. CI now requires a PostgreSQL 16 transaction test job before building; that hosted job has not yet been observed.
- The full suites pass: 472 web + 178 mobile + 116 shared + 3 script tests = 769. The mobile parallel run emitted a worker-teardown warning; a subsequent `jest --runInBand --detectOpenHandles --coverage=false` run passed all 178 tests and exited cleanly without reporting open handles. That rerun does not establish the cause of the earlier warning. These totals exclude the 12 database tests.
- All 11 formatting/lint/type tasks passed on a forced uncached rerun, with the newly introduced lint warnings removed. `git diff --check` passed.
- A fresh `next build` compiled and type-checked successfully, built the durable workflow bundle, generated all 1,414 pages, and exited 0 with zero `getAllPostMetas` errors. The usual edge-runtime static-generation notice remains. This successful run does not explain the previous transient blog failures.
- Against that production build on a separately started local server, the targeted CI regressions passed 15/15 with zero retries across Chromium, Mobile Chrome and Mobile Safari: unauthenticated trip/workflow/account endpoints and long-note backup export/restore plus oversized upload rejection. An isolated browser also confirmed that `/blog` rendered populated article listings. These are not authenticated end-to-end generation, partner attribution or installed-device tests.
- The migration is local and unapplied. Mixed-version workflow rollout, target Supabase schema/RLS and deployed runtime behavior are unverified. See [the generation rollout/recovery runbook](GENERATION_RELEASE_RUNBOOK.md).

September 4 four-regression follow-up:

- Fixed retained-trip retry after rejected dispatch, legacy Booking.com conversion matching, Expo web confirmation/navigation, and Google-status-error autocomplete fallback. Existing authentication, signature, allowlist, timeout, cancellation and zero-result behavior remain covered.
- Full unit/integration suites pass 826 tests; real PostgreSQL tests pass 12; all 11 quality tasks pass. Fresh Next.js build generated 1,414 pages without blog metadata errors. Expo web/iOS/Android exports all pass; they are not installed native builds.
- The full production-browser suite passes 78/78 with zero retries. This includes six confirmation/popup regressions across Chromium, Mobile Chrome and Mobile Safari, using the actual Expo checkout helper with native/transport boundaries isolated. CI includes these regressions. See [the detailed follow-up](../artifacts/bug-audit-2026-09-03/review-regressions-2026-09-04.md).
- The code is prepared for review branch `fix/production-review-regressions-20260904`, not a production deployment. The migrations still require approved rollout.

Next implementation priorities: durable dispatch recovery and same-trip recovery across restart; truthful price/rating/currency presentation; targeted dependency updates followed by full release verification. The new transactions do not yet close the process-crash gap between initialization and workflow dispatch or provide persistent client idempotency keys. Live partner attribution/reporting and installed-device QA still require external evidence.

## Additional blocker found during the production build

`bunx next build` compiled and type-checked successfully and exited 0, but static generation repeatedly logged `getAllPostMetas error` with large response bodies. The current blog loader returns an empty list on those errors, so a successful build can hide degraded blog/related-content output. Treat this build as **degraded**, not clean release evidence. Owner: Codex. Required work: reproduce with bounded diagnostics, distinguish database failure from a legitimate empty result, bound/sanitize error logging, verify all relevant generated pages, and repeat a clean build. No backend root cause or production impact beyond the observed local build has yet been established.

A subsequent read-only query using the same public client, selected columns, published filter, ordering and 1,000-row limit returned HTTP 200, 1,000 rows and no error. This does not reproduce or explain the build-time failures; investigate build-time concurrency/caching and transient responses without assuming a permanent database outage.

The September 4 generation-transaction build rerun completed all 1,414 pages with zero metadata error logs, and the production-mode blog listing rendered real articles. The earlier failure is not currently reproduced. Silent empty-list fallback and unbounded upstream error logging still need hardening; do not mark that resilience issue fixed solely because a later build passed.

## Authority

Local implementation and safe diagnostics may proceed. Production deploys/migrations/data changes, account changes, purchases/cancellations, and external communications require explicit authorization. Do not put secret values in this document or chat. An intermediate web beta does not complete the mobile release goal.
