# Protected preview acceptance — 14 November 2026

**Result: incomplete; not a production acceptance pass.** No merge or production
deployment was performed. Device QA was excluded by request.

The committed application candidate `7be26db` built successfully in an isolated,
protected preview using the staging Supabase project and a dedicated capped
Gateway key. The later documentation-only commit did not change application code.
Only committed source was uploaded; local credentials and private receipts were
excluded. Shared branch environment settings were not changed.

Tier 0 passed health, destinations, anonymous/cron authorization, consent,
password authentication, idempotent creation, cross-account API and database
isolation, optimistic edit conflicts, 79 image checks and the map-tile check.
Places/weather returned their intentionally disabled states. Pause/rate-limit
contracts were source checks, not live enforcement proofs; the rate-limit probe
was skipped.

Sharing failed because the preview omitted its public base URL and returned a
production-origin link. The harness refused to follow it. The test trip was
deleted successfully. The original report also contains a misleading duplicate
cleanup failure, now covered by a regression and corrected in the harness.

One Lisbon generation was dispatched. The authenticated CLI transport terminated
without a response during polling; its wrapper did not retain sufficient process
diagnostics to establish the underlying cause. The harness then deleted the trip
while remote work was still active. Logs show four completed model steps
(orchestrator, hotels, dining, activities), followed by the stale-attempt guard
stopping progress before aggregation. There is no saved itinerary quality pass,
and this run is unsuitable for application latency measurement. No second paid
request was dispatched.

The repaired harness reports transport failures, blocks later briefs, and
preserves trips when no terminal workflow state has been observed. Terminal
runs still clean up, and failed cleanup cannot silently pass. Original evidence
is retained privately in `artifacts/uat/live-preview-20261114/`; do not publish
that directory wholesale.

The last budget snapshot records $0.05808750 for the replacement key, plus
$9.71708035 historical spend: **$9.77516785 cumulative**, within the original
$20 allowance. Billing can arrive late; reconcile again before any subsequent
paid request. The credential-bearing preview was deleted, and a follow-up lookup
returned 404. The QA credentials remain stored privately for future authorized
tests.

Validation after the harness repairs: `bun --no-env-file test scripts/__tests__`
passed 251 tests; `tsc -p scripts/tsconfig.json --noEmit` and `git diff --check`
passed. This does not replace the earlier full release run or prove live
acceptance. Remaining gates include corrected live staging acceptance, actual
saved-plan factual/suitability review, unresolved dependency security findings,
and operational recovery/alerting/email evidence.
