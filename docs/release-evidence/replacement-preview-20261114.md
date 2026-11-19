# Replacement protected preview acceptance — 14 November 2026

**Result: failed traveler-quality acceptance. Do not merge.** Device QA was
excluded by request. Production was unchanged.

The authorized replacement preview built committed source `ee8b08f` against
staging, using the same dedicated capped Gateway key. A unique staging alias
provided the public share origin. Deployment Protection remained enabled;
unauthenticated health redirected to authentication. Shared environment settings
were not changed. The installed CLI was invoked directly with asynchronous
process handling and private transport diagnostics.

Tier 0 passed 17 checks, including authenticated health, sign-in, consent,
idempotent creation, cross-account API/database isolation, optimistic conflicts,
share/revoke, and verified cleanup. The rate-limit probe was skipped. Pause and
rate-limit source contracts are not live enforcement evidence. Image and tile
checks passed; disabled vendor endpoints returned their expected states.

One Lisbon generation for 7–9 December completed and saved three days. The
saved result failed quality acceptance: **Monuments of Belém has no meals**.
Days 1 and 3 also explicitly warned that visits did not fit the proposed meal
and buffer windows. Their structured timing proposals were missing from the
saved result, so the evaluator did not originally report those timing failures.
Upstream completion and successful persistence do not establish usable plans.
The test trip was deleted with HTTP 200 after terminal completion. No further
paid generation was dispatched.

Investigation found that the workflow's persistence projection omitted
`timingProposal`. The follow-up patch preserves it and tests both a fitting day
and a conflicting day through JSON persistence and the trip loader. The quality
evaluator now rejects timing notes without their structured proposal. This
patch has automated evidence only; the deleted preview ran the earlier source.
Do not repair the missing meals by inventing venues or relaxing distance limits.
Sufficient grounded nearby dining and a feasible schedule remain acceptance
requirements. Opening hours, suitability and actual travel times are not
established by this run.

The final budget snapshot records $0.11735150 on the replacement key and
$9.71708035 historical spend: **$9.83443185 cumulative** of the original $20.
The replacement key retains its $10.28 nonrenewing cap. Reconcile billing before
any separately authorized retry. The preview and unique alias were deleted;
both follow-up API lookups returned 404. Private receipts and runtime logs are
retained under ignored `artifacts/uat/replacement-preview-20261114/`.

Remaining release gates include a passing saved-plan evaluation, factual and
suitability review, unresolved dependency security findings, and operational
recovery, alerting and email-delivery evidence. No production-readiness or merge
claim is justified by this run.

Follow-up validation: `vitest run` passed 1,717 web tests; five local-server
tests could not bind loopback inside the sandbox. Rerunning
`vitest run __tests__/scripts/itinerary-measure-runtime.test.ts` with local-server
access passed all six tests in that file. Together these cover all 1,722 web
tests, including the two new persistence regressions. `bun --no-env-file test
scripts/__tests__` passed 252 tests. Web and scripts `tsc --noEmit`, focused
ESLint, formatting and `git diff --check` passed. The local Bun test declarations
were updated for the parameterized tests and partial-object matcher already
used by the harness. Native, browser and production builds were not repeated
for this follow-up; earlier release evidence applies to its recorded source.
