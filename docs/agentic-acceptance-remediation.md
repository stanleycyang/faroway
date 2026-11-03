# Agentic acceptance remediation

Owner: Codex. Started 2026-11-03 UTC. Baseline: `b691926`, twelve completed
runs; repaired Melbourne/New York runs are separate. Acceptance is currently
rejected. Evidence: `artifacts/uat/six-scenario-local-20261103/report.md`.

## Delivery contract

Deliver a usable itinerary that respects the brief, with traceable venue facts,
feasible scheduling, readable Android presentation, and measured cost/recovery.
A warning does not satisfy a hard mobility, allergy, availability or timing
constraint. An explicit unresolved option is acceptable only as an unresolved
option; it does not count toward a completed usable itinerary. Do not make an
empty plan pass by filtering every stop. Do not label restaurant food allergy-safe
from a menu or a generic dietary tag.

## Ordered deliverables

| ID | Deliverable and code boundary | Acceptance evidence | Dependency |
|---|---|---|---|
| D1 | Reusable source-evidence gate at `staging-schedule-experiment.ts`: exact venue/branch/visit scope, source URL, retrieval/review dates, applicable trip dates, claim type, supported/contradicted/unknown state. Preserve source metadata through saved and streamed output. | Replay all twelve saved cases; stale, wrong-branch and partial evidence cannot certify a claim. Each scheduled venue has a claim ledger. Unsupported hard constraints produce an explicit unresolved option and replacement search. | First |
| D2 | Repair identified venue/season defects: Lisbon generic Fado and branch identity; Edinburgh Stone of Destiny description; Interlaken Harder Kulm, Brienz boats and Magic Park identity/date/location. Add source-backed alternatives, including actual winter-open choices. | Operator evidence attached to each correction; two affected runs per destination. Verify St Beatus remains available where supported. New candidates are audited too, not only the original defects. | D1 |
| D3 | Mobility and dietary suitability: exact entrance/internal-route/boarding evidence for Copenhagen and Edinburgh; separate unresolved restaurant confirmation for severe peanut allergy. | No full Round Tower or unverified boat boarding presented as meeting step-free needs. No inferred 65 cm clearance or allergy guarantee. Enough reviewed alternatives for a useful day; unresolved gaps visible. | D1 |
| D4 | Feasible schedule and route audit: one chronological sequence including meals, travel and requested rest; detect duplicate venues and distant excursions. Use source-backed transit routes/times where available, conservative planning estimates clearly labeled otherwise. | No meal during Melbourne meetings; no duplicated bakery experience without distinct intent; no unbudgeted Almada/Kilchberg/Rigi transfer; totals include meals/travel and fit opening windows. Unknown route feasibility cannot pass. | D1–D3 |
| D5 | Android presentation: breakfast before morning visits, lunch before afternoon visits, retain evening order; omit absent meal-duration metadata without fabricating it. Trace missing images through provider → saved output → native card; use licensed venue imagery with attribution and truthful destination fallbacks. Shorten repeated cautions while keeping critical warnings visible. | New QA APK; screenshots of every day in the six scenarios, including narrow screen, missing/broken-image fallback, offline and reopened states. Compare to baseline. No unrelated stock image labeled as the venue. | Start in parallel with source work; no extra agents required |
| D6 | Reproducible acceptance runner and final report: fixed candidate commit/APK, fresh request IDs, two runs per scenario, source audit, stream/save checks, actual cost/latency, Android/recovery evidence. Retain failed receipts and separate repair builds. | Twelve runs on one final build; all critical quality gates pass. Affected cases rerun twice after any subsequent fix. Report pending physical-device evidence separately. | D1–D5 |

## Milestones and concrete artifacts

1. **Source and failure ledger:** tracked sanitized fixtures plus one row per venue
   and required claim; record source, applicability, verdict and correction.
   Retain raw pages privately. Start with Round Tower, Fado, Harder Kulm, Brienz,
   Magic Park and Stone of Destiny. Broader evidence gate must also catch novel
   unsupported candidates, rather than only memorizing those names.
2. **Backend repair candidate:** code + representative failed-case replay tests;
   reviewed alternatives; output distinguishes scheduled, unresolved and excluded.
   Review all changed paths and run relevant suites/type checks.
3. **Android repair candidate:** versioned APK, image coverage diagnostics,
   before/after screen evidence and correct chronological display. Existing
   consent, sources and booking-review behavior must remain intact.
4. **Final acceptance packet:** commit/APK hashes, all twelve briefs and receipts,
   venue ledger, schedule audit, screenshots, failure recovery, cost ledger,
   timing summary and explicit pass/fail per case. Keep PR #55 draft until this
   packet supports release. Physical Android is a separate pending gate if absent.

## Budget and measurement

Last billed total: **$5.91607985 of $20**, remaining **$14.08392015**.
Do source review and offline replay before more live generation. Allocate up to
$4 to targeted repair runs and $4 to the final twelve-run round; retain the
remaining ~$6.08 for retries and reconciliation. These are spend ceilings, not
promises to spend them. Stop paid dispatches at $18 cumulative, leaving $2 for
in-flight/billing lag; never reset the key or bypass its $20 cap. Investigate
unexpected per-run cost before another dispatch. Count source/provider costs if
any are introduced. No new paid service is assumed.

Measure first useful streamed content, durable completion, Android rendering,
input/output tokens and billed aggregate deltas. Compare warm local runs with
warm local runs; measure hosted performance separately. Initial performance guard:
median warm completion <=35 seconds and no unexplained >60-second run. Quality
remains a hard gate even if cost/latency improve. Preserve cold compilation and
recovery runs as separately labeled observations.

## Current status

- Existing repairs: Melbourne meeting parser and Café Sabarsky Tuesday closure;
  two live repeats each completed. Broader suitability remains unresolved.
- D1–D4: pending implementation and authoritative verification.
- D5: chronological normalization and absent-duration cleanup in progress.
- D6: pending final candidate; do not reuse baseline successes as final evidence.

No calendar completion date is asserted before the evidence/provider gaps are
resolved. Progress is reported at each artifact milestone, with failed gates and
remaining budget, rather than treating additional unit checks as acceptance.

## First implementation checkpoint — 2026-11-03

Implemented (not yet deployed or validated in a rebuilt APK):

- Native day-part normalization now places breakfast and lunch before their
  visits, with evening visits before dinner, matching the existing planner's
  sequence. Cache reload preserves the order. This does not invent clock times.
- Unknown meal duration is omitted from the card instead of displaying
  “Duration not set.” Valid proposed durations remain explicitly labeled planned.
- Generic Fado performance/show/experience titles, including the two observed
  Alfama failures, enter the existing deferred-event review path. Named events
  still require evidence; passing this lexical filter is not verification.
- Reusable receipt replay command:
  `bun --no-env-file scripts/uat/replay-acceptance-presentation.ts artifacts/uat/six-scenario-local-20261103`.
  All twelve saved cases pass presentation ordering/cache checks; both observed
  generic Fado titles are detected. Receipt output is retained in
  `artifacts/uat/remediation-20261103/presentation-replay.json`.

### Source-review queue and required correction

| Claim | Authoritative evidence reviewed 2026-11-03 | Required action / status |
|---|---|---|
| Full Round Tower route is step-free | [Operator access page](https://www.rundetaarn.dk/en/visit-us/) describes stairs/no lift for full ascent | Contradiction: block full ascent for this requirement; find reviewed accessible replacement. Runtime repair pending. |
| January Harder Kulm railway visit | [Operator page](https://www.jungfrau.ch/en-gb/harder-kulm/) currently advertises 2026 season information | January 2027 operation unresolved. Seek dated timetable; defer until established. Do not turn 2026 dates into invented 2027 closure dates. |
| Ice Magic at the old location | [Organizer](https://magicpark-interlaken.ch/) identifies successor Magic Park in Kursaalgarten, December 18, 2026–February 28, 2027 | Correct entity/location and dated hours; replacement must preserve explicit visit scope. Runtime repair pending. |
| Stone of Destiny at Edinburgh Castle | [Perth Museum](https://perthmuseum.co.uk/the-stone-of-destiny/) identifies it at Perth Museum | Remove the incorrect Castle highlight; do not silently add an unplanned Perth excursion. Runtime repair pending. |

This queue is not the complete venue ledger. D1 requires every final scheduled
venue and relevant claim, including newly generated alternatives, to be covered.

Checkpoint validation: all 710 mobile tests pass; 86 focused backend tests pass;
mobile and web TypeScript checks pass. Existing React test-renderer deprecation
messages remain. No paid AI calls were made for this checkpoint. New APK and live
affected-case reruns remain pending; none of D1–D6 is declared fully complete.
