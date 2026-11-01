# Faroway AI evaluation strategy

Optimize for a trip someone can realistically follow, with honest uncertainty and
their requirements preserved. Schema validity and fluent writing are necessary
but cannot establish itinerary quality. Treat hard failures as release blockers;
a high average score must never compensate for a violated requirement.

## Start with the production contracts

The active route uses `SearchInput` → orchestrator `SearchPlan` → specialized
hotel/activity/dining/transport results → aggregator suggestions → saved
`TripDay` records → web/native display. Evaluate those actual artifacts, including
the transformed and displayed results. Keep the existing synthetic rubric as
grader calibration rather than pretending its flat activity format is the
production output schema.

Current limits to address before promising constraint adherence:

- Saved dietary and mobility requirements now reach the search plan, specialist
  prompts and final aggregation, including fallback plans. The system does not
  independently verify venue suitability; generated plans tell travelers to
  confirm dietary safety and accessibility directly.
- Adult-only hotel and flight provider searches are skipped when children are
  explicitly present. Hotel searches that cannot represent multiple rooms are
  skipped too; age- and room-aware pricing requires the appropriate supplier flow.
- Missing supplier amounts and currencies remain unknown; model-generated day,
  activity and price-level totals are not treated as verified prices. Currency,
  party size, room configuration and quote terms still need end-to-end checks for
  each supplier and for historical records.
- The offline rubric rejects empty plans, negative prices, outside-trip dates
  and overlaps hidden by negative transfer times. Evidence strings remain
  synthetic: nonempty strings alone cannot prove a venue claim is true.

## Separate four evaluation layers

| Layer                    | What it proves                                                                                                     | Where it runs                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Deterministic contracts  | Input propagation, dates, IDs, nonnegative quantities, price units, valid lineage and displayed claim preservation | Every PR, using saved fixtures and mocked providers          |
| Frozen model comparisons | Whether a prompt/model change improves the same cases with the same permitted source snapshots                     | Bounded, explicitly scheduled model runs                     |
| Live data acceptance     | Current venue existence, opening times, routing, supplier availability and quote terms where applicable            | Small staging sample against authoritative permitted sources |
| Traveler usefulness      | Whether the plan fits the traveler, feels coherent and can be followed                                             | Human review and consented product feedback                  |

Do not score missing hours as verified hours, absent accessibility information as
step-free access, a restaurant's name as dietary suitability, a tracked click as a
booking, or a generated price as a supplier quote. A useful answer can acknowledge
unknown facts and tell the traveler what to verify. Impossible constraints should
produce an explanation or clarification rather than fabricated compliance.

## Build a representative case set

Start with 40 development briefs and 20 independently reviewed holdout briefs.
These are proposed starting sizes, not an established quality guarantee. Keep
holdout cases out of prompt tuning. Use synthetic traveler data and reference
facts whose processing and storage are permitted.

| Slice             | Examples and required failure detection                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Dates and party   | One-day trip, month/year boundary, leap day, DST/time zones, infants/children, multi-room party, per-person versus whole-party cost            |
| Geography         | Dense city, dispersed region, islands, same-name destinations, impossible inter-city transfers, misplaced coordinates                          |
| Pace              | Slow pace, midday rest, short arrival/departure days, no early starts, fatigue and excessive backtracking                                      |
| Requirements      | Step-free request, severe allergy, vegan/gluten-free needs, conflicting requests, insufficient verified information                            |
| Budget            | Tight budget, mixed currencies, unknown price, zero/free item, per-room/night totals, taxes and quote expiry                                   |
| Interests         | Family, culture, food, outdoors, lesser-known interests, repeat venues and generic suggestions that ignore the brief                           |
| Supply and faults | No hotels, empty venue list, closed attractions, weather disruption, provider timeout, truncation, malformed output, fallback and retry        |
| Product revisions | Locked activity, changed dates/party, old plan retained, stale checkout blocked, stream preview agrees with saved and native output            |
| Adversarial input | Venue descriptions containing instructions, invented IDs/URLs, claims of confirmed bookings, malicious source text and impossible user demands |

Use explicit expected properties and acceptable alternatives, not a single
verbatim reference itinerary. Record unsupported capabilities as blocked; do not
silently remove difficult cases from the denominator. Validate case definitions
before calling any model. Store failures as regression cases after review.

## Grade hard facts in code

Use deterministic checks for exact date/party propagation, day coverage, valid
time intervals, nonnegative finite costs and transfers, unique source IDs,
referenced-ID membership, locked choices and unchanged requirements after retries.
Handle arrival/rest days with explicit case-specific coverage rules.

Keep price amount, currency, unit, party, taxes, source, timestamp and expiry
together. Unknown components must remain unknown through totals and UI mapping.
Check that every confirmed factual claim points to an allowed source record with
matching fields. Geographic/temporal checks need authoritative coordinates,
opening windows and route estimates; a model's own explanation is not evidence.
Report unknown verification separately from pass and fail.

Re-run these checks on raw agent output, normalized saved output, and the relevant
web/native view models. This catches an accurate model response being damaged by
deduplication, schema defaults, pricing transforms or rendering.

## Grade usefulness with humans and calibrated judges

Use a 1–5 anchored rubric for personalization, geographic coherence, pacing,
variety, practical detail and clear uncertainty. A 1 is unusable; a 3 needs
material editing; a 5 is ready for traveler verification with only minor edits.
Require concrete reasons and cited output/source IDs for every deduction.

Have two reviewers independently label an initial sample, resolve disagreements,
and keep a separate judge-calibration holdout. Only then use an LLM judge for
scale. Blind model/prompt names, randomize candidate order, allow ties, and repeat
pairwise comparisons in reversed order. Treat inconsistent orderings and
human/judge disagreements as review cases. Do not let a generator certify its own
facts. Judge prompts must treat itinerary and supplier text as untrusted data.

This combines task-specific automation, human calibration and comparisons in the
way described by [OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).
Keep the harness provider-independent and repository-owned so comparisons and
fixtures remain usable as hosted evaluation tools change.

## Compare candidates under controlled conditions

Pin source commit, prompt/schema hashes, requested and resolved model/provider,
generation settings, tool snapshots, rubric version and judge version. Compare
baseline and candidate on the same source snapshots. Run an initial three trials
per brief to expose variability, then increase repetitions for unstable slices.
Report paired case-level outcomes, slice counts and uncertainty, not only a
single average or the best of several generations.

Count timeouts, fallback plans, empty results and unsuccessful dispatches in the
denominator. Track fallback rate and useful completion rate separately from
transport success. Measure latency to first useful content and final saved plan,
p50/p95 latency, tokens and cost per useful plan, including retries and judges.
Keep live-source drift tests separate from frozen prompt comparisons.

## Proposed release criteria

These are initial product targets to calibrate with reviewer labels, not current
measured results:

- Zero known hard-requirement violations, fabricated verification/booking claims,
  negative quantities, or unacknowledged stale pricing in the release suite.
- All deterministic contracts pass. Unknown factual evidence is visible and
  counted; a requirement that cannot be safely met blocks or limits the result.
- Human-reviewed usefulness is at least 4/5 on each essential dimension for the
  reviewed critical slices. Report the distribution and worst slices as well as
  the mean. Do not average a failed accessibility case into a successful city break.
- Candidate preference and useful completion show no material regression against
  the baseline within reported uncertainty. Set practical improvement and latency
  margins before looking at candidate results.
- Native and web render the same substantive facts, dates, source identities,
  prices and uncertainty. Include the actual native flow in release acceptance.

Zero observed failures in a small suite does not prove zero real-world failures.
Keep sample sizes visible and expand difficult slices as traffic and feedback
reveal them. Latency and cost targets should be based on measured baselines and
an agreed product budget, rather than invented performance promises.

## Run and improve within a budget

Every PR runs cheap deterministic replay and rubric calibration. For prompt,
model, schema or transformation changes, manually run a bounded paired comparison
before release. Start with a few cases to validate the harness, then spend the
agreed budget on the representative set. Do not interpret sandbox hotel quotes
as free model generations or as evidence of itinerary quality.

Estimate generation, retry and judging cost before a batch. Dispatch sequentially
with output-token limits, retries disabled or bounded, an explicit maximum case
count and a stop threshold below any soft provider budget. Cache raw outputs so
regrading does not regenerate itineraries. No paid run or provider activation is
part of this strategy write-up.

After launch, use consented, redacted samples and structured feedback reasons
(wrong facts, impractical routing, missed preference, poor value) to prioritize
new cases. Compare usefulness with edits and abandonment; a rating alone cannot
tell whether a plan's factual claims were correct. Review failures weekly and
hold back a small canary when promoting a tested candidate.

## Implementation order

1. Expand end-to-end tests from brief capture through workflow, agents and the
   native view model, including cases requiring external factual verification.
2. Add an adapter that extracts evaluation records from actual generation traces
   while retaining source/provenance and raw outputs. Reject malformed traces
   explicitly instead of silently skipping them.
3. Assemble the reviewed development/holdout cases and implement deterministic
   reference checks. Keep provider failures and unknowns visible.
4. Calibrate human labels and the pairwise judge. Validate order bias and fabricated
   evidence before trusting automated judgments.
5. With a confirmed budget, compare the current pipeline against one focused
   candidate change, then promote only after native acceptance and slice review.

## Executable trace evaluation (2026-10-31)

`uat:model-compare -- --live` now preserves each agent output and the production
itinerary bridge output in private files under `artifacts/uat/traces/<run-id>`.
The trace records source commit/dirty state, a hash of the agent/bridge/config
sources and lockfile, explicit overrides, per-step usage, timings and fallbacks.
Files are written after each step, including failed steps, so interrupted and
partial runs remain in the evaluation denominator. Trace directories must be
empty to prevent overwriting earlier trials. These are agent outputs after their
normalization; they are not raw provider responses or verified venue facts.

Bound a live experiment with `--configs baseline-flash-high`,
`--briefs lisbon-city-break`, `--cap-usd 0.5`, and an optional `--trace-dir`.
The dedicated gateway key's non-renewing $20 quota bounds cumulative live spend;
the per-run threshold only stops between steps. Reconcile gateway spend after a
run with unknown usage before starting another one. Never substitute a production
key. These flags currently select live runs; mock mode remains fixture-based.

Replay saved traces without model calls:

```sh
bun run uat:eval -- artifacts/uat/traces/<run-id> scripts/fixtures/agentic-venue-constraints.json
```

The deterministic grader checks step completion/fallbacks, dates, party,
requirements, selected source identities, whole-minute durations, time-of-day
compatibility, repeated activities, day coverage, meals, and preservation across
the app's itinerary bridge. It flags sparse restaurant variety and overloaded
slots. A contract pass does not certify usefulness, geographic feasibility,
prices, actual opening hours, or accessibility/dietary suitability. Serial agent
time must not be reported as app latency: the app parallelizes specialist calls.

The optional venue constraints are independently reviewed, dated public-source
facts. Current fixtures detect a Monday interior visit to Jerónimos and require
reopening confirmation for the National Tile Museum. A current temporary closure
does not establish closure on a future trip date. Name matching flags a review
case, including potential exterior-only visits; absence of a matching fact is not
evidence of availability. These development facts are not a general venue index.

The first Lisbon baseline cost an estimated $0.06203 and had no fallbacks, but
review found hours encoded as minutes, a closed-weekday visit, an unacknowledged
museum closure, and a dinner experience paired with another dinner. The low-
thinking pilot completed its specialists faster but timed out in aggregation;
its total cost is unknown from response usage. Neither pilot supports changing
production model defaults. The duration schema/prompt fix is being tested while
the case set, factual evidence, schedule coherence checks, repeated trials,
holdout review, and native/web experience measurements are still incomplete.

The explicit-minute follow-up pilot returned all 15 generated activity durations
as whole minutes, completed without fallback, and passed structural contracts.
It cost an estimated $0.06760 versus $0.06203 in the original pilot; one trial
cannot establish a cost or latency improvement. Correct units exposed two
four-hour-plus afternoon slots before meals and transfers. These become pacing
regressions for the next iteration. Production model defaults remain unchanged.
Local validation after this iteration: 1,194 web, 673 mobile, 136 shared-package,
and 61 script tests pass; typechecking, lint and formatting checks pass with the
existing nine lint warnings.

### Scheduling candidate: failed latency gate (2026-10-31)

The next candidate supplies activity and restaurant neighborhoods/descriptions,
explicit calendar weekdays, minute-based pacing, meal breaks, and uncertainty
instructions to the aggregator. These fields were previously absent despite
instructions to group stops geographically. A separate mapping fix adds explicit
`mealId: null` so an included-dinner experience can suppress an extra restaurant;
omitted meal IDs retain the existing fallback behavior. Contract evaluation now
also rejects restaurants scheduled outside their declared meal types.

The live batch in `artifacts/uat/traces/scheduling-pilot-20261031` loaded the
scheduling prompt **before** the nullable-meal mapping change. It requested all
three development briefs but stopped on the first, Lisbon: the aggregator timed
out at 30,038 ms, used a fallback, and produced two overloaded-slot warnings.
Total serial agent duration was 99,996 ms. Aggregator billing usage was unavailable;
the harness correctly aborted rather than assuming zero cost. Gateway budget
reconciliation reported $0.46 cumulative UAT spend against the $20 cap. Copenhagen
and Interlaken were not executed. This candidate has not passed the promotion gate
and has not been deployed. The nullable-meal change has unit coverage, not live
acceptance evidence yet.

All repository tests pass (2,067 total), including 45 itinerary mapping tests and
62 script tests. Passing these checks does not override the live latency failure.
Next: replay frozen upstream inventories to isolate aggregator prompt/model
changes, then repeat successful candidates across broader briefs and independent
holdouts. Preserve the failed trace in comparisons and measure actual application
latency separately from this sequential harness.

### Frozen-input aggregator comparison (2026-10-31)

`apps/web/scripts/aggregator-replay-live.ts` makes exactly one paid aggregator call
against saved, non-fallback upstream outputs. It requires `--live`, a staging
target, a dedicated staging key, `--input`, and a new `--out` path. Optional
`--thinking` accepts minimal, low, medium, or high. Reused upstream steps have zero
replay latency and empty replay usage; provenance records the original source and
input-file SHA-256. Replay latency is **not** complete-trip or application latency.
Unknown billing exits 3 and requires gateway reconciliation before another call.
The gateway key's $20 quota remains the cumulative billing cap.

Five trials used the identical minute-correct Lisbon inventory from
`minutes-pilot-20261031`. All used the current scheduling prompt and explicit
nullable meal mapping. Artifacts are in `artifacts/uat/traces/replay-20261031`.

| Thinking | Trials completed | Aggregator latency | Estimated replay cost | Quality observations                                                                                    |
| -------- | ---------------- | ------------------ | --------------------- | ------------------------------------------------------------------------------------------------------- |
| Low      | 2/2              | 6.36–6.44 s        | $0.00686–$0.00694     | Both overload two slots and assign two remote meals; one schedules the reported Monday closure.         |
| Medium   | 2/2              | 15.91–16.24 s      | $0.01325–$0.01388     | Zero or one overloaded slots; two or three remote meals; neither schedules the reported Monday closure. |
| High     | 0/1              | 30.01 s timeout    | Unknown               | Fallback used; second planned trial was not run after unknown billing.                                  |

All five require review of the Tile Museum's reopening before the future visit.
These are small, exploratory samples, not statistical proof of a winning setting.
**No model setting is promoted.** The next quality intervention must address
unverified venue availability and deficient geographic supply, rather than merely
lowering thinking. There were no dining candidates in Belém in this frozen input;
a planner cannot invent a nearby restaurant ID to fix the geographic defect.

The offline evaluator now flags a meal more than 3 km from every activity in its
slot, using supplied coordinates only. This is a review screen, not verified
routing; invalid/missing/placeholder coordinates remain unknown. Regrade all
saved traces with the current evaluator when comparing experiments.

`--suite development` now selects 12 authored coverage briefs; `--suite holdout`
selects six reserved cases. The default remains the original three UAT briefs.
The reserved cases have not been run or used for tuning and still need independent
review. This is initial coverage, short of the proposed 40/20 suite. Revision,
provider failure, full application/native behavior, factual grounding, and human
usefulness evaluation remain required. Latest gateway reconciliation: **$0.56 of
$20 cumulative UAT spend**.

### Rejected nearby-meal prompt experiment (2026-10-31)

A candidate added computed nearby restaurant IDs to each activity and instructions
to leave a named local-meal gap rather than substitute a distant restaurant. On
the same frozen Lisbon inventory, medium-thinking trial 1 took 17.34 s, still
selected one remote meal, overloaded one slot, and left three meal slots
unassigned (including meal experiences). Trial 2 timed out at 30.03 s and used the
fallback. The prompt change was **reverted**; its patch and traces are preserved
privately in `artifacts/uat/traces/supply-replay-20261031`. More prompt context is
not an established solution to missing local supply or scheduling reliability.

The evaluator now exposes `unassignedMealSlots` alongside meal count so reduced
restaurant coverage cannot be mistaken for a complete dining plan. This metric
requires interpretation: a meal experience may legitimately replace a restaurant,
whereas an unresolved local dining gap still requires work. The coordinate screen
is shared pure code with no network access and does not certify route feasibility.

Separately, the dining prompt no longer explicitly permits “realistic-sounding”
restaurant names. It requires fewer candidates rather than invented names, and
asks for geographic coverage. This removes a bad instruction but is not proof of
venue existence; current factual verification remains outstanding.

The subsequent full-flow `flash-low` Copenhagen family trial preserved the brief's
structured requirements but timed out in aggregation after 30,037 ms. Its fallback
scheduled 15 activities over three days and overloaded one morning, despite the
slow-pace/accessibility request. Total serial duration was 75,621 ms. The runner
stopped on unknown aggregator billing before Interlaken; do not count Interlaken
as tested. Trace: `artifacts/uat/traces/broader-20261031`. The dedicated gateway
budget was reconciled to **$0.63/$20** after this run. This extends the timeout
finding beyond Lisbon and makes fallback pacing a release concern. No production
model or timeout default was changed.

### Duration-aware fallback (2026-10-31)

The fallback scheduler is now a pure module with bounded daily activity counts
and minute budgets (relaxed: two visits/240 minutes; moderate: four/420; packed:
five/600). It spreads unused candidates across remaining days, excludes invalid
or over-budget durations, isolates longer visits in a slot, preserves time-of-day
compatibility and original IDs, and leaves unsupplied days explicitly incomplete.
These are planning heuristics, not individualized accessibility guarantees.

Fallback meal selection prefers supplied nearby coordinates and variety within
that set. If every candidate is distant, it retains the nearest candidate and
adds a specific separate-journey warning rather than pretending supply is local.
Unknown coordinates remain unknown. Draft summaries and tips now disclose the
fallback and outstanding checks.

`apps/web/scripts/fallback-replay.ts INPUT_TRACE NEW_OUTPUT` runs without model,
provider, or database calls and records source/input hashes. Replays in
`artifacts/uat/traces/fallback-pacing-v2-20261031` show:

- Copenhagen: six activities over three days instead of the failed live run's
  fifteen; no slot-overload warnings; nine meals and nine distinct restaurants.
- Lisbon: ten activities, no slot-overload warnings, nine meals; two remote-meal
  warnings remain because the inventory lacks nearby options. Explicit journey
  warnings are included in the day tips.

Both continue to fail the overall `fallback_used` gate. A better fallback does
not establish successful AI generation, factual availability, or traveler
usefulness. The change makes failure behavior less misleading and better paced;
aggregation reliability and independent factual verification remain open. These
replays made zero model calls; cumulative live spend remains $0.63/$20.

### Compact input and public-source grounding probe (2026-10-31)

Inventory JSON passed to the aggregator is now compact rather than pretty-printed;
fields, instructions, and values are unchanged. Four medium-thinking replays
(two Lisbon, two Copenhagen) completed without fallback. Lisbon input tokens fell
from 5,556 to 4,286 (22.9%). Latencies were 12.44/17.64 s for Lisbon and
5.97/21.56 s for Copenhagen. This small sample supports an input-token saving,
not a statistically established latency or reliability improvement. Original
source hashes and outputs are in `artifacts/uat/traces/compact-replay-20261031`.

A new daily pace screen catches count/minute excesses even when no individual
slot exceeds four hours. Regrading shows both Copenhagen AI outputs still exceed
the relaxed pace budget on multiple days; Lisbon still has distant meals and
unresolved venue reopening. Contract passes are not release acceptance.

`apps/web/scripts/grounding-pilot-live.ts` is an isolated, explicitly live probe
using public venue names only, the dedicated capped UAT key, and Google-only
Gateway routing. It is not connected to production planning or user trip data.
The live probe used `@ai-sdk/google` 3.0.140, whose newer utility types then
failed this repo’s type check. The dev dependency is now pinned to 3.0.33, which
uses the same provider/utility versions as installed AI SDK 6.0.90. The live
receipt predates that pin; the request’s search-tool identifier and empty options
are unchanged. SDK 7 is current; a major upgrade is a separate validation task.
The implementation was checked against installed SDK source and the official
[Gateway search documentation](https://vercel.com/docs/ai-gateway/models-and-providers/web-search).

The first search probe completed in 5.90 s, with resolved provider `google`.
Gateway metadata reports five billable searches, $0.0021255 inference cost, and
**$0.0721255 total cost**. Token-only cost estimation would materially undercount
this call. Private receipt: `artifacts/uat/grounding/lisbon-20261031.json`.

The output found the Tile Museum closure and said reopening was unknown, but
contradicted itself by labelling the monastery's proposed Monday visit both open
and closed. Its prose also named official URLs absent from the returned source
list (which includes provider redirect URLs). These findings reject unchecked
search-generated text as verification. Before integration, require structured
claims, source-to-claim linkage, calendar consistency, source quality checks,
and explicit unknown states. Preserve provider source and search metadata; do
not treat model-authored links as retrieved evidence.

Gateway reconciliation after these experiments: **$0.78/$20 cumulative UAT
spend**. No model, provider recipient list, timeout default, or product grounding
path has been changed.

### Official-page structured extraction (2026-10-31)

The isolated grounding probe now accepts `--official-pages`. It uses Google's URL
context tool against the two independently identified official eval URLs, extracts
structured closure facts, and never asks the model to declare future availability.
Temporary closure is `true` or `null`; normal opening hours cannot establish that
no temporary closure exists. The output uses explicit JSON Schema plus runtime
Zod validation to avoid excessive cross-version TypeScript inference.

The first extraction produced the expected facts but a non-verbatim monastery
quote. The provider's grounding support metadata also associated both venues with
the monastery page, despite successful URL retrieval metadata for both URLs. This
is additional evidence that retrieval success and citation presence alone are
insufficient. That first receipt remains preserved as a failing case.

A revised prompt requires one contiguous quote with no ellipses or paraphrasing.
Both the revised trial and final typed implementation linked both quotes to
independently fetched official-page text. The final call took 2.509 s and cost
$0.0029585 according to Gateway metadata, versus $0.0721255 for the earlier
unrestricted search probe. This comparison is specific to two already-known
sources: source discovery cost and broad coverage are not included.

Reproduction (network source fetch, then offline audit):

```sh
python3 scripts/uat/fetch-grounding-pages.py NEW_PAGES_JSON
bun scripts/uat/evaluate-grounding.ts STRUCTURED_RECEIPT NEW_PAGES_JSON 2026-12-07
```

The fetcher uses only the reviewed eval URLs, refuses redirects, limits response
size and time, records observation timestamps, and saves private evidence. The
pure audit rejects missing/duplicate venues, unapproved sources, absent page
retrieval, non-verbatim quotes, invalid weekdays, and invalid visit dates. It
computes calendar review flags without accepting a model-authored “open” status.
Matching unrelated text deliberately **does not verify claim semantics**. All
results retain `claimVerified: false` and `futureAvailabilityVerified: false`.

Artifacts: `artifacts/uat/grounding/official-lisbon-20261031.json` (rejected quote),
`official-lisbon-v2-20261031.json`, `official-lisbon-final-20261031.json`, and
`official-pages-v2-20261031.json`. These two cases support the extraction and
linkage mechanism, not general venue verification or production readiness. Source
discovery, semantic validation, freshness policy, wider coverage, and integration
with itinerary generation remain open. No product grounding path is enabled.

Latest gateway reconciliation after the three official-page probes:
**$0.79/$20 cumulative UAT spend**. Repository checks and 74 script tests pass.

### Schema-bounded scheduling candidate and review preview (2026-10-31)

Aggregator replay now accepts `--structured-schedule`, which uses a flat daily
activity list capped at two/four/five visits for relaxed/moderate/packed pace and
requires the expected number of days. The adapter preserves real inventory IDs
and the existing app-facing slot shape. This is an internal opt-in argument;
ordinary product calls retain their existing schema. Experimental malformed
outputs fall back rather than bypassing the cap through legacy raw-text recovery.

Four frozen-input medium-thinking trials are preserved under
`artifacts/uat/traces/structured-replay-20261031`. Copenhagen trial 1 produced six
visits but exceeded the relaxed minute budget on one day (25.26 s); trial 2 failed
schema validation and used fallback (17.35 s). Lisbon trials completed in
18.05/27.26 s; one still exceeded its daily minute budget and both retained remote
meals. The candidate is **not promoted**: limiting count alone neither guarantees
feasible timing nor improves reliability. All failed outcomes remain in the
denominator. Cumulative gateway UAT spend is **$0.85/$20**.

Work is now published in draft PR #55. The review branch is configured with its
own isolated staging Supabase values, planning paused, a nonfunctional review AI
key, and optional provider features disabled. Secrets are branch-scoped and were
not copied from production or committed. The first push preceded environment
provisioning because Vercel requires an existing remote branch; subsequent builds
must be checked on the head containing this note. Draft status is intentional:
quality gates, wider/holdout evaluations, application/native validation, and the
source-grounding integration remain incomplete.

### Deployed application baseline (2026-10-31)

Commit `2c318e7` passed GitHub CI run `41169003225` (quality checks and tests;
release verification/build jobs skipped by workflow policy). Vercel deployment
`dpl_ASLtsQUkCirB3no7utimii3vWcjw` completed its actual application build and is
ready at the branch preview. The UAT guard now explicitly allows that provisioned
alias while still rejecting production, lookalikes, paths, and query parameters.
Eight guard tests pass with 26 assertions.

Planning component Playwright tests passed 20/20 across Chromium and Mobile
Chrome, including streaming, recovery, small-screen completion, and day navigation.
Mobile screenshots were inspected. These use simulated model responses and do
not establish live generation quality or physical Android behavior.

The deployed tier-0 smoke test passed 17 checks: health, destinations, guest/cron
authorization, disabled provider states, images (79 HEAD requests), map tile,
staging sign-in, AI consent, idempotent creation, cross-account isolation, edit
conflicts, sharing/revocation, and cleanup. Two of those checks (planning-pause
and rate-limit contracts) inspect source rather than dispatching live requests.
The optional active rate-limit probe was skipped. Receipt:
`artifacts/uat/agentic-preview-smoke-auth.json`.

Initial unauthenticated and local OIDC requests reached Vercel protection rather
than application routes. The successful run used a temporary preview access link
to obtain an origin-scoped cookie, with redirects still disabled for test calls.
Protection remained enabled; access material stayed in private temporary files.
Test trips were deleted by the runner. Planning remains paused with a nonfunctional
AI key; no live model calls were made in this application check. Gateway budget
reconciliation still reports **$0.85/$20**. This is a deployed application
baseline, not a live-AI acceptance result or a production release approval.

### Explicit daily-budget hillclimb (2026-10-31)

The replay runner now accepts `--explicit-daily-budget`. This adds an explicit
per-day count and activity-minute ceiling (relaxed 2/240, moderate 4/420, packed
5/600), asks the model to sum unchanged supplied durations, and prohibits filling
days by shortening or inventing visits. It remains opt-in; production behavior
is unchanged. Frozen upstream inputs and the independent existing evaluator were
kept fixed throughout these trials.

| Candidate                                    | Trials | Aggregator latency | Outcome                                                                                      |
| -------------------------------------------- | ------ | ------------------ | -------------------------------------------------------------------------------------------- |
| Daily budget, medium reasoning               | 1      | 30.02 s            | Copenhagen timed out; batch stopped on unknown token billing                                 |
| Daily budget, low reasoning                  | 4      | 5.95–11.51 s       | All completed, but every plan exceeded daily pace limits                                     |
| Daily budget + bounded schema, low reasoning | 4      | 5.74–6.27 s        | One schema fallback; all three successful plans still had pace and/or meal-distance warnings |

The eight low-reasoning trials cost an estimated $0.04674 in token usage,
including the schema-failure trial. The timed-out medium call has unknown
per-call token cost and is not treated as free. A gateway budget check was made
before resuming paid calls. All nine trials remain in the evidence, including
failures; the fallback's empty warning list is not a quality win.

The independent frozen venue-fact audit also flagged Monday monastery visits in
both bounded-schema Lisbon trials, and reopening confirmation in all four Lisbon
trials. Short latency and schema compliance therefore do not establish usable
itineraries. Neither candidate is promoted. The evidence favors separating
deterministic scheduling constraints from model-written descriptions rather than
adding more arithmetic instructions to the prompt.

Artifacts: `artifacts/uat/traces/daily-budget-replay-20261031`,
`daily-budget-low-replay-20261031`, and `bounded-budget-low-replay-20261031`.
Repository checks and the 49 itinerary tests passed with the experimental option.

### Fresh destination baseline and safety review (2026-10-31)

Three additional development briefs ran through all five agents using `flash-low`
(low reasoning for inventory, medium for aggregation). No fallback occurred.
These are serial harness timings, not application latency, and token costs are
estimates rather than full billing receipts.

| Brief                    | Serial duration | Estimated tokens cost | Observed quality issues                                                       |
| ------------------------ | --------------- | --------------------- | ----------------------------------------------------------------------------- |
| Rome, one day            | 66.53 s         | $0.04633              | 525 activity minutes before meals/transfers despite moderate pace             |
| Tokyo, solo budget       | 59.24 s         | $0.04284              | Overfilled final day and two remote meals                                     |
| New York, peanut allergy | 68.46 s         | $0.05291              | Overfilled first day, two remote meals, unsupported premise in allergy advice |

The New York plan retained the structured allergy requirement and included
cross-contact checks, but also said to “re-verify their peanut-free kitchen
protocols” for a named restaurant. No provider evidence established such
protocols. This assistant review flags an unsupported safety premise, not a
finding about that restaurant's actual practices. The deterministic requirement
retention check currently misses this semantic defect. It must not be used as
allergy-suitability acceptance; independent evidence and careful wording remain
required.

The observed Rome failure is now a committed, projected synthetic regression
fixture (`scripts/fixtures/agentic-rome-overload.json`), with the original trace
hash and an explicit unverified-content label. CI can reproduce its pace warning
without credentials or paid calls. Only scheduled inventory and evaluator-required
mapped fields are retained; it is a negative example, not a reference itinerary.
The regression demonstrates why intact IDs and successful generation are
insufficient. Thirteen evaluator tests pass, including this actual model output.

All full traces remain in `artifacts/uat/traces/expanded-baseline-20261031`.
Five destinations now show scheduling problems (Lisbon, Copenhagen, Rome, Tokyo,
New York). Holdouts remain unused. Cumulative Gateway UAT spend after this batch:
**$1.07/$20**. No candidate from this round is promoted.

Next experiment: compile a feasible schedule before asking for narrative. The
compiler must preserve inventory IDs/durations, enforce day and slot budgets,
avoid duplicate visits, retain complete date coverage, and expose supply gaps.
Descriptions must refer only to the compiled stops; removed stops must not remain
in titles or summaries. Missing meals and unavailable evidence must remain visible
in the scorecard, so deleting difficult content cannot manufacture a quality win.
Coordinate-based clustering is only a heuristic until locations and routes are
verified. This scheduling change cannot by itself resolve venue grounding or the
unsupported allergy wording; both remain separate acceptance requirements.

### Deterministic schedule compiler experiment (2026-10-31)

`compileSchedule` now provides an experimental allocation path with no model or
network calls. It preserves inventory objects and durations, bounds activity
count/minutes per day, respects time-of-day compatibility, reports sparse supply,
and uses supplied coordinates only as a clustering heuristic. A long visit may
occupy its own slot with a timing caveat. Search is bounded to 24 candidates and a
32-state beam; truncation is reported. This is not a globally optimal route solver.
No production caller uses it yet.

Offline replay supports `--compiled-schedule` and optional `--exclusions FILE`.
Exclusions carry an activity ID, visit date, reason, source URL and observation
date. They are caller-supplied evidence, not a claim that the compiler retrieved
or verified a source. The experiment manually mapped reviewed official evidence
to inventory IDs; general source discovery/grounding remains unfinished. The
National Tile Museum was conservatively excluded pending reopening confirmation,
not asserted closed on all future travel dates. The original hotel choice and
upstream inventory were frozen, and all upstream generation costs are excluded
from this stage's zero-model-call cost.

Two adversarial tests failed before their fixes:

- Greedy selection consumed the only visit available on the final day. A
  bipartite matching check now preserves future day coverage when complete
  coverage is feasible from the candidate inventory and supplied exclusions.
- Early short visits crowded out long evening highlights. The beam now keeps
  states with different visit counts until later slots have been considered,
  and rewards literal matches to the search plan's suggested highlights.

These highlights are model-interpreted planning preferences, not necessarily
explicit user priorities. Name matching is intentionally conservative; missing
matches and unselected highlights are reported. Matching names does not establish
venue identity, suitability, opening hours, or traveler usefulness.

The final five frozen-input replays took **3–15 ms** for allocation/mapping, had
complete date coverage, and produced no pace-budget violations. This is local
stage timing, not application latency. Highlight retention increased from 11/22
to 18/22 across the same supplied plans, with important tradeoffs:

| Case       | Activities | Suggested highlights retained | Remote meal warnings |
| ---------- | ---------- | ----------------------------- | -------------------- |
| Lisbon     | 9          | 5/5                           | 1                    |
| Copenhagen | 6          | 3/4                           | 0                    |
| Rome       | 3          | 2/4                           | 0                    |
| Tokyo      | 9          | 4/5                           | 5                    |
| New York   | 9          | 4/4                           | 0                    |

Tokyo's meal warnings increased from three to five when highlight retention was
prioritized; Lisbon decreased from three to one. Rome's choice omitted the
Colosseum and Vatican Museums. Copenhagen retained the evening Christmas market
but also selected a mulled-wine experience for a family with a child; suitability
has not been established. These are **unresolved selection/suitability defects**,
not acceptable tradeoffs merely because the schedule fits its time budget.

The evaluator now checks meals in empty activity slots against the other stops
that day, closing a distance-screening gap. It also supports date-specific and
location-closure facts. Newly reviewed official sources report winter Tuesday–
Sunday hours for [Designmuseum Danmark](https://designmuseum.dk/en/besog-os/opening-hours-admission-2/)
and closure of the former [Frick Madison](https://www.frick.org/about/frick_madison)
location in March 2024. The Designmuseum fixture is limited to the reviewed
December 7 case; it is not generalized to summer or holiday exceptions. The Frick
finding matches the obsolete Madison location, not the institution's current
museum. The Frick official-page search result supplied the closure statement;
direct page retrieval returned HTTP 418. No full-page extraction receipt is
claimed for it.

With the manually supplied exclusions, the final replays have no findings for
the four listed venue constraints. That narrow result does not verify other
venues. `verified` remains false. Day descriptions currently use inventory-name
templates, not a polished narrative model; no ready-for-travel status is implied.

Artifacts: `compiled-schedule-20261031` (initial compiler),
`compiled-constrained-20261031` (reviewed exclusions), and
`compiled-highlight-20261031` (coverage/highlight corrections), all under
`artifacts/uat/traces`. The final compiler has nine tests, including the two
adversarial regressions. Full repository checks/tests passed (1,209 web tests;
78 script tests). No paid model calls were made this round; the last reconciled
UAT spend remains **$1.07/$20**. The compiler is **not promoted** until selection
quality, family suitability, restaurant supply, broader grounding, narrative
integration, and application validation are addressed.

### Family screening, fresh constraint cases, and first merged fix (2026-10-31)

The experimental compiler now defers activities with explicit adult-only labels
or alcohol-focused titles when the party includes children. Deferred IDs/reasons
are recorded in `reviewRequiredActivities`; missing highlights and supply gaps
remain visible. The title screen is deliberately conservative and incomplete:
it is not a legal age policy, does not inspect provider admission terms, and
does not establish that an unflagged activity is suitable for children. General
party-suitability evidence is still required before production promotion.

Fifteen title-screen cases and ten compiler tests pass. Cases include the observed
mulled-wine experience, pub crawls, adult-only labels, and negative controls such
as a wine-history museum and a non-alcoholic cocktail class. Replaying the same
five inventories under `compiled-family-20261031` replaced Copenhagen's
mulled-wine stop, retained its Christmas market and six total visits, and kept
the other four schedules unchanged. All five retain complete dates and no pace
violations; known meal-distance and selection defects remain.

Two fresh development briefs ran through all five agents with `flash-low`:

| Brief                                       | Serial duration | Estimated token cost | Baseline outcome                                          | Compiled outcome                                                  |
| ------------------------------------------- | --------------- | -------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Singapore, family, short walks/midday rests | 61.78 s         | $0.04753             | No fallback; three overfilled days and three remote meals | Eight visits over four days; no pace violations; two remote meals |
| Edinburgh, wheelchair access                | 56.74 s         | $0.04349             | No fallback; one overfilled day and two remote meals      | Six visits over three days; no pace violations; one remote meal   |

Compiler timings were 16/4 ms, excluding upstream inventory generation. These new
cases used no manually supplied venue exclusions, so they do not establish
opening-hour correctness. The Singapore requirement for a midday rest every day
is retained as input but is not explicitly represented by the slot-level schedule;
its fulfillment is unverified. Edinburgh venue names and descriptions include
accessibility claims without independent route/access evidence. Zero pacing
warnings must not be read as wheelchair-suitability acceptance. Full traces:
`access-baseline-20261031`; offline results: `compiled-access-20261031`, both
under `artifacts/uat/traces`. Reserved holdouts remain unused.

Full repository checks/tests passed (1,225 web, 673 mobile, 136 shared and 78
script tests). Cumulative Gateway UAT spend is now **$1.16/$20**.

The verified activity-duration correction was extracted into
[PR #56](https://github.com/stanleycyang/faroway/pull/56) and merged as
`626d9d797b14e201e55ebde723ed39db771a6daf`. Only the activity schema/prompt and its
regression test changed in that PR. An isolated checkout passed repository
checks and full tests; GitHub CI and Vercel preview build passed, and authenticated
preview health returned 200. The review preview has branch-scoped staging
credentials and planning paused.

**Merged does not mean deployed:** `apps/web/vercel.json` explicitly disables
automatic main deployments. Current production is still deployment
`dpl_3Snjh4w6yLjsB6SeA7ieBhKRx3fe`, matching the October 28 cutover receipt at
`a3eb0a01bb3a1f314364eb71a120b2a044bf8318`. Main contains additional previously
merged changes beyond this two-file fix; a production rollout needs verification
of that full release delta. The deployment hold was not changed. Experimental
compiler and grounding work stays in draft PR #55 and is not released.


### Bounded dining resupply experiment (2026-10-31)

Diagnosed compatible-meal inventory gaps against frozen compiled visits: Lisbon had one Belém breakfast gap (nearest supplied candidate 4.87 km); Tokyo had five gaps (nearest candidates roughly 6–9 km). Distances use generated coordinates and are not route evidence. Added an offline coverage analyzer and an explicit-live, staging-only runner that refuses source drift before spending, freezes visit/date/slot assignments, records one-call usage and provenance, preserves hotel selection, and aborts further paid batching when billing is unknown. Unknown coordinates request evidence rather than automatic resupply. Production callers and defaults are unchanged.

| Frozen case | Initial repair: candidates / latency / estimated USD | Focused repair: candidates / latency / estimated USD | Apparent coverage gaps |
| --- | --- | --- | --- |
| Lisbon | 11 / 9.127 s / $0.0062135 | 2 / 3.172 s / $0.0021175 | 1 → 0 in both |
| Tokyo | 12 / 14.825 s / $0.0105525 | 8 / 6.350 s / $0.0045445 | 5 → 0 in both |

All four calls recorded usage with no fallback and retained the exact selected visits. Estimates exclude the frozen upstream generation. These are one sample per case per revision, not statistically established savings. Initial repair still requested the generic city-wide meal mix and returned unrelated venues: rejected as a targeting result. Focused revision removes that conflicting paragraph and requests at most two candidates per target area (maximum 12). The model can still supply extra meal labels; no claim that prompt obedience establishes identity, availability, or suitability. Raw receipts are private ignored artifacts under `artifacts/uat/traces/dining-repair[-focused]-20261031/`.

Manual source review exposes why these results are not ready for production:

- Lisbon's selected Pastéis de Belém address agrees with its [official contact page](https://pasteisdebelem.pt/en/contact/), observed 2026-10-31. Current published hours support morning service, not a guarantee of future-date availability, dietary suitability, or queue time.
- Initial Tokyo selected “Afuri Roppongi Hills” at **6-2-31 Roppongi**. Its [official branch directory](https://www.afuri.com/findus/), observed 2026-10-31, instead lists **6-4-1 Roppongi**, METRO HAT/HOLLYWOOD PLAZA B2F. Treat the generated branch address as contradicted even though coordinate coverage passed.
- Initial Tokyo selected “Monk” at **3-21-1 Sendagaya**. Search did not establish that venue/address identity; this remains unresolved, not proof of nonexistence. Do not silently substitute a similarly named venue elsewhere.
- Focused Tokyo selections (Ippudo Roppongi, Sakura-tei, Monmouth Tea, Maisen Aoyama, Daikanyama Hyoushi) have not yet been independently verified. Both focused cases remain `qualityAccepted: false`.

Next gate: build venue identity/address/meal-service evidence checks from official sources, with explicit contradicted and unresolved outcomes, then re-evaluate repaired schedules. Do not optimize solely for generated-coordinate coverage. Existing release gates (holdouts, accessibility/allergy evidence, highlighted visit retention, narration and app latency) still apply.

Validation: workspace type/lint/format checks pass (9 pre-existing lint warnings); 1,230 web tests and 79 script tests pass. Dedicated nonrenewing Gateway budget reconciled at **$1.18 / $20** after these four calls. No production deployment or default-model change.


### Independent address evidence gate (2026-10-31)

Added `scripts/fixtures/agentic-venue-addresses.json` and an offline selected-meal address audit. Records are manually adjudicated branch/address cases from official pages, not model-produced ground truth. Exact destination, branch alias, and reviewed address variants are required. Unknown spellings, unmatched venues, duplicate/conflicting records, missing source metadata, and evidence outside a 90-day review window remain unresolved. The 90-day window is a conservative evaluation policy, not a guarantee of freshness. Supported addresses do not establish coordinates, routing, menus, dietary suitability, accessibility, or future availability.

The focused repair now grades as:

| Case | Supported address occurrences | Contradicted | Unresolved |
| --- | --- | --- | --- |
| Lisbon | 1 | 0 | 8 |
| Tokyo | 1 | 1 | 7 |

In addition to the initial AFURI conflict, focused Tokyo generated **2-33-8 Sendagaya** for Monmouth Tea. The [official site](https://monmouth.jp/), retrieved 2026-10-31, lists **1-21-2 Sendagaya**. The [official Sakura-tei page](https://www.sakuratei.co.jp/access), retrieved the same date, supports the generated **3-20-1 Jingumae** address. The fixture does not assert that unknown venues do not exist. Neither repair passes the broader evidence gate.

Replay with:

```sh
bun --no-env-file scripts/uat/evaluate-traces.ts artifacts/uat/traces/dining-repair-focused-20261031 scripts/fixtures/agentic-venue-constraints.json scripts/fixtures/agentic-venue-addresses.json
```

Known address contradictions now make this command exit 1; unresolved counts remain explicit and must not be interpreted as approval. The CLI also refuses envelopes marked `started` or `failed`, preventing failed paid-call receipts from passing on copied upstream output. Legacy receipts without a status remain supported. No new live AI calls or production changes in this iteration; budget remains last reconciled at $1.18/$20.


### Frozen official-page address extraction pilot (2026-10-31)

Added an isolated `address-extraction-live.ts` runner using the existing SDK/Gateway stack, with explicit-live, staging and dedicated-key guards, one model call, no retries, output-token/time limits, private receipts, and input/prompt hashes. `fetch-grounding-pages.py --addresses` fetches only the four reviewed official URLs, with redirects disabled and response-size/time limits. All four pages retrieved successfully. Raw page text stays in ignored private artifacts; the model receives the requested branch names and retrieved text, **not** the fixture's reviewed or rejected addresses. The runner never edits trips, coordinates, evidence fixtures, or production state.

One low-thinking Gemini 3 Flash call: **2.446 s**, 6,059 input / 430 output tokens, approximately **$0.0043195** at the existing model estimate. No search/tool charges; the four HTTP fetches are outside model latency. All four extracted address strings occur verbatim inside contiguous quotes in the supplied pages. AFURI Roppongi Hills, Sakura-tei and Monmouth Tea exactly match the reviewed source addresses. Pastéis de Belém copied the page's whitespace-separated address while the manually authored fixture inserted commas: evidence linkage passes but strict reviewed-string equality fails. This is a formatting review case, not evidence of a wrong venue. Do not loosen identity matching merely to turn this case green.

The AFURI and Monmouth extractions recover the official addresses that contradict the earlier generated recommendations. This is a useful correction capability, but not yet automatic verification: the audit deliberately keeps `branchIdentityVerified` and `coordinatesVerified` false. A genuine quote for a different branch remains possible and has a negative regression test. Tests also reject invented address fragments, mismatched sources, duplicate claims, missing pages and unknown addresses. Current official URL selection is manually reviewed; scalable discovery and branch matching are still missing.

Private artifacts: `artifacts/uat/address-pages-20261031.json` and `artifacts/uat/address-extraction-20261031.json`. Next work should connect retrieval, branch adjudication and correction into the experimental planner with explicit uncertainty and cost bounds, then evaluate on fresh destinations/holdouts. Do not present this four-page extraction pilot as end-to-end traveler acceptance.

Validation: workspace type/lint/format checks pass, and all 89 script tests pass. Dedicated Gateway budget reconciled after the extraction call: **$1.19 / $20**.


### Remaining development cases and evidence-constrained scheduling (2026-10-31)

Ran fresh `flash-low` baselines for the previously unrun development briefs. The first batch completed Interlaken and stopped at Marrakech's 30-second aggregation timeout because usage for that call was unknown. Reconciled Gateway billing before continuing the remaining cases; did not retry the timed-out call. Raw traces: `remaining-development-20261031` and `remaining-development-tail-20261031`. Holdouts remain untouched.

Frozen-supply compiler comparisons (one sample each; costs and latencies below are not full app measurements):

| Case | Baseline visits / meals | Compiler visits / meals | Daily pace violations, before → after | Remote-meal warnings, before → after |
| --- | --- | --- | --- | --- |
| Interlaken | 12 / 16 | 11 / 21 | 2 → 0 | 10 → 13 |
| Marrakech | 14 / 12 (fallback) | 12 / 12 | 0 → 0 | 0 → 0 |
| Paris | 9 / 7 | 9 / 9 | 1 → 0 | 0 → 0 |
| Reykjavik | 11 / 11 | 11 / 15 | 3 → 0 | 2 → 5 |
| Istanbul | 11 / 9 (fallback) | 9 / 9 | 0 → 0 | 1 → 0 |

Baseline serial agent durations: Interlaken 63.076 s, Marrakech 81.796 s including failed aggregation, Paris 78.535 s, Reykjavik 78.550 s. Compiler-only replays take 6–19 ms and exclude all upstream generation. More meals can create more remote-meal warnings; do not treat full slots as verified coverage. Reykjavik drops the Golden Circle because its supplied duration exceeds the current daily limit. Literal highlight matching also falsely reports an omitted Perlan Museum despite selecting Perlan under a longer inventory title; this metric is not semantic identity verification.

Independent review found consequential failures:

- Interlaken in November schedules Mürren–Gimmelwald Via Ferrata and Grimsel canyoning. The [equipment station's published via ferrata season](https://intersport-muerren.ch/via-ferrata-muerren/?lang=en) ends in October and says use outside the season is not permitted; [OUTDOOR's Grimsel product](https://www.outdoor.ch/en/outdoor-adventure/canyoning-grimsel) lists May–October. Both pages retrieved 2026-10-31. Added `reportedOperatingMonths` evidence and regression tests; this flags outside-season dates without certifying dates within the season or other providers' availability.
- The unconstrained Paris compiler regresses against the baseline: it places Orsay on Monday and Louvre on Tuesday. Official [Orsay visitor information](https://www.musee-orsay.fr/en/visit) and [Louvre hours](https://www.louvre.fr/en/visit/hours-admission/tickets-and-prices), checked 2026-10-31, report those weekly closures. Added scoped aliases and closure facts. A generated “private/VIP” tour name does not establish an exception or an actual bookable product.
- Interlaken's model-written day-one summary mentions paragliding, but no paragliding activity is selected that day. Other descriptions also mention omitted activities. Narrative-to-ID consistency remains an unsatisfied quality gate.

Connected reviewed evidence to the offline compiler through `fallback-replay.ts --compiled-schedule --venue-constraints FILE`. It evaluates every supplied candidate/date, derives source-attributed exclusions, and preserves the evidence file hash and exclusions in provenance. This is programmatic application of a manually reviewed fixture, **not** automated source discovery. No model calls or production default changes. With constraints, Paris still has nine visits/nine meals and zero pacing/remote warnings, while moving Louvre to Monday and Orsay to Tuesday. Interlaken's manual seasonal replay retains seven populated days and eleven visits while excluding both seasonal activities, but geographic and duration issues remain. Regression tests exercise the evidence-to-compiler path.

Istanbul also hit the 30-second aggregation timeout; its serial agent duration was 73.362 s. No retry was hidden from the denominator. All twelve authored development briefs now have live traces (including failed/fallback outcomes), and all six reserved holdouts remain unrun. This is still smaller than the proposed 40/20 case set and lacks independent traveler labeling.

A final evidence-enabled replay of all five new traces is in `artifacts/uat/traces/compiled-evidence-remaining-20261031/`. All five pass deterministic contracts and have zero violations of the **listed** venue constraints. Unknown venues, travel times, prices, suitability and holiday exceptions remain unknown; this is not five quality approvals. Seasonal/closure facts are small, manually reviewed fixtures and do not generalize source discovery.

Validation: 1,231 web tests and 91 script tests pass; workspace checks pass with nine pre-existing lint warnings. The previous pushed head's GitHub CI run 41171686299 succeeded. Dedicated Gateway spend reconciled after both batches at **$1.45 / $20**. Known estimates for successful full baselines were Interlaken $0.0478725, Paris $0.058643, Reykjavik $0.0579985; exact failed-call attribution remains unknown despite aggregate billing reconciliation. No production deployment or default scheduler change.


### Explain deferred long visits; reject unsafe name matching (2026-10-31)

The compiler now returns structured `deferredLongVisits` (supplied duration, daily activity limit and lexically matched suggested highlights) and adds a concise first-day explanation when an unmatched highlight only has an over-limit supplied option. Reykjavik now explains that the supplied Golden Circle/glacier excursion is estimated at 10h versus this draft's 7h activity limit, suggesting a search for a shorter alternative or a review of pace. It does not silently raise the limit, claim a shorter product exists, or treat model-interpreted highlights as explicit user requests. Alcohol-focused long visits are not offered as pace adjustments for families. Other unresolved name matches are described as potentially absent or differently titled, avoiding a false claim that a known selected venue is missing.

A broader ordered-word matcher was tried and **rejected**. It recognized Perlan under its descriptive inventory title, but also treated “Edo-Tokyo Open Air Architectural Museum” as “Edo-Tokyo Museum”, changed Tokyo's selected visits and falsely cleared the highlight gap. These are distinct locations: the [Edo-Tokyo Museum access page](https://www.edo-tokyo-museum.or.jp/en/information/access/) identifies Ryogoku, while the [Tokyo government's open-air museum listing](https://uniquevenues-en.metro.tokyo.lg.jp/venues/metropolitan/11606/) identifies the Koganei venue (checked 2026-10-31). Added a negative regression test and retained contiguous normalized phrase matching. This is still only lexical preference matching, not verified identity resolution. Perlan's alias remains unresolved by that matcher; the traveler-facing text now acknowledges this uncertainty.

The rejected trial is preserved in private `compiled-highlights-explained-20261031` artifacts. The accepted explanation-only revision is in `compiled-long-visit-explanations-20261031`: all twelve development cases pass structural checks with zero listed constraint findings, and exact date/slot/activity-ID/meal-ID signatures remain unchanged from the prior evidence-constrained schedules. Existing geography, duration and source-verification limitations therefore remain; this is an explanation improvement, not a new quality approval. No paid model calls were made; last reconciled budget remains $1.45/$20. No production callers use this compiler yet.

Validation: 1,243 web tests and 91 script tests pass; workspace type/lint/format checks pass with the existing nine lint warnings.


### Separate fixed-schedule narration pilot (2026-10-31)

Added `schedule-narration.ts` with a compact selected-stop context and an atomic application guard: one entry per date, exact activity-ID membership without duplicates, bounded title/summary text, and changes limited to those two text fields. The runner requires a passing frozen compiler trace, explicit live/staging credentials, and a new private receipt; it limits the pilot to seven days, one model call, 2,000 output tokens, 30 seconds, and zero retries. Input/prompt/source hashes, usage and latency are recorded. Every original uncertainty tip, visit, meal and hotel is preserved. This structural guard cannot prove the prose's facts or meaning; every receipt remains `semanticReviewRequired: true` and `qualityAccepted: false`.

Two initial calls (Lisbon 2.623 s / ~$0.0018015, Copenhagen 2.556 s / ~$0.0014375) showed that short narration is feasible, but Copenhagen added “coastal atmosphere” and “festive lights” while Lisbon used “castle views” in a title. These embellishments were unnecessary and not explicitly in the supplied stop names. Tightened the instructions to avoid added sensory/geographic claims, formulaic travel language and reciting every restaurant. Preserved the initial receipts rather than counting only the better revision.

| Revised case | Narration latency | Estimated narration USD | Structural preservation |
| --- | ---: | ---: | --- |
| Lisbon | 2.509 s | $0.0015545 | All dates, visits, meals and tips unchanged |
| Copenhagen | 2.582 s | $0.0013495 | All dates, visits, meals and tips unchanged |
| Paris | 3.677 s | $0.002009 | All dates, visits, meals and tips unchanged |
| Reykjavik | 3.643 s | $0.002520 | All dates, visits, meals and tips unchanged |

Manual review of the four revised outputs found no added selected visits or date/slot contradictions. The titles and summaries now describe the supplied stops more directly. Reykjavik's summary does not reintroduce the omitted Golden Circle excursion, and its original explanation remains in the tips. This is neither independent traveler review nor a guarantee that all prose claims are true: names such as “private VIP tour” and “Michelin-starred” originate in unverified inventory and still need supplier/source evidence. Do not infer bookability from narration.

Receipts: `artifacts/uat/traces/narration-pilot-20261031/` (initial) and `narration-v2-20261031/` (revised). Estimates exclude all upstream generation and compiler work. These one-sample-per-case results support investigating a compiler-plus-narrator pipeline, not a claim about delivered app latency or broad quality acceptance. No production integration or default-model change. Gateway reconciled at **$1.46/$20** after six calls. Holdouts remain unused.

Validation: 1,247 web tests, 92 script tests, and workspace type/lint/format checks pass (the same nine pre-existing lint warnings).


### Integrate the candidate at the app aggregator boundary (2026-10-31)

The shared `runAggregatorAgent` now has an explicitly gated compiler-plus-narrator path, so both inline search and the durable planning workflow can exercise the same candidate. It remains **off by default and blocked in production**. The gate requires all of:

- `FAROWAY_SCHEDULE_EXPERIMENT=compiled-narrated-v1`;
- `VERCEL_ENV=preview`, or local `NODE_ENV=development` without a Vercel environment;
- the exact isolated Supabase origin `https://omovikloadpvzijoaqus.supabase.co`, with no credentials/path/query/fragment;
- `PLANNING_THINKING_AGGREGATOR=low`, the existing Gemini 3 Flash model (unset or explicit), and the aggregator output cap unset or exactly `2000`.

The candidate applies only to one-to-seven-day trips without transport candidates and without the legacy structured-schedule/daily-budget experiment options. Other requests use the existing aggregator. Production defaults, disclosure recipients, consent checks, booking behavior and provider gates remain unchanged. The deployed preview still has planning paused and its AI key disabled; no remote environment settings were changed in this iteration.

The integrated path filters unapproved Viator content before compilation and narration; applies the manually reviewed closure/season fixture to each candidate/date; chooses the highest supplied hotel vibe score without changing its quote; and makes one bounded narration call through the existing planning-usage logger. It preserves compiler uncertainty and omitted-highlight tips. Empty-activity days skip narration and report a supply-gap fallback. Timeouts, malformed output or mismatched references return the compiled draft with an explicit explanation and an observable fallback event, **without a second AI call**. This is not general grounding: the small fixture's coverage limitations and generated coordinates remain unchanged.

Extracted the exact evaluated narration prompt into a shared helper used by the pilot and app path. Added an explicit `--compiled-narrated` mode to `aggregator-replay-live.ts`, with configuration/source hashes and safeguards against mixing legacy experiments or accidentally inheriting this mode from ambient environment variables.

| Integrated app-aggregator replay | Latency | Estimated stage USD | Result |
| --- | ---: | ---: | --- |
| Paris | 5.933 s | $0.004070 | 9 visits / 9 meals, no fallback, no listed closure violations |
| Marrakech | 3.553 s | $0.002424 | 12 visits / 12 meals, no fallback; prior baseline aggregation timed out |

These calls reuse frozen upstream inventory; they do not measure end-to-end API or device latency. Paris consumed 798 reasoning tokens despite the low setting, illustrating variation compared with the standalone narration samples. Both outputs were manually checked against the selected stops; supplier claims, vegan suitability and bookability still need independent evidence. Receipts: `artifacts/uat/traces/integrated-schedule-20261031/`. Gateway reconciled after both calls at **$1.47/$20**.

Validation: all 1,255 web tests and 92 script tests pass; workspace checks pass. Tests cover production/wrong-project/config rejection, app entry-point routing, unchanged schedule data, malformed references, stalled narration/abort, no retry, supplier-content filtering, empty supply, deterministic hotel choice, and the legacy path when disabled or over seven days. Removed unused-variable warnings from the narration tests. An isolated Next.js build in `/tmp/faroway-compiled-integration-20261031` passes with the experiment enabled, staging public-read credentials, and disabled AI/service credentials. The first build with placeholder public credentials correctly failed on blog data reads; it was not treated as a code/build success.

Next release gate: exercise a bounded consented request through the deployed staging API and inspect persisted/streamed itinerary rendering before considering broader rollout. This requires explicitly configuring the preview experiment; the current remote deployment remains paused. No production deployment or merge of PR #55 is justified by these two replays.

### Deployed durable-workflow eval exposes narration failure (2026-10-31)

Ran one consented Lisbon development brief through the actual protected preview API at commit `2ef8e378f57d39b1eb4164eab59ddca449eeb12c`, using the isolated staging database and dedicated $20-capped test key. The temporary deployment used low thinking for all five planning steps, the compiler/narrator flag, an 8,000-token global ceiling, and the existing 2,000-token narration bound. Runtime logs confirm the experiment executed, excluded one known closed candidate/date, and made five model calls. This tests the durable workflow and persistence rather than frozen upstream replays.

The API created the trip, accepted generation, returned progress through completion, and returned the saved three-day itinerary after **51.635 seconds** from the first API request (completion observed at 50.410 seconds). Deletion returned 200 at 52.290 seconds. The old smoke grader reported success, **incorrectly for experience quality**: narration failed its exact visit-reference guard (`Narration references a different selection of visits`), and the saved itinerary contained the compiled fallback titles, summaries, and explicit failure tip. The fallback protected the schedule and did not retry the model. The raw rejected narration was not retained, so the precise omitted/altered reference is unknown; do not claim a root cause or a narration fix from this run.

| Step | Model latency | Input tokens | Output tokens | Reasoning tokens (within output) |
| --- | ---: | ---: | ---: | ---: |
| Orchestrator | 6.819 s | 1,751 | 1,286 | 651 |
| Hotels | 18.009 s | 781 | 3,319 | 1,013 |
| Activities | 13.466 s | 1,056 | 2,630 | 0 |
| Dining | 21.103 s | 1,152 | 4,659 | 1,575 |
| Narrator | 2.531 s | 1,031 | 358 | 0 |

Total reported usage: 5,771 input / 12,252 output tokens, with parallel upstream steps. Gateway reconciled at **$1.51/$20** after the run (previously $1.47; displayed spend is rounded). This is one development case, not a latency distribution or cost estimate for all trips. Saved content also retains uncertain addresses/availability and two separate-journey meal warnings. No browser rendering or native Android check was performed in this iteration.

Added a sanitized regression fixture, `scripts/fixtures/agentic-deployed-narration-fallback.json`, containing only the saved day text and selected names, without accounts, trip IDs, credentials or supplier verification claims. The saved-plan grader now rejects compiled fallback summaries and explicit unavailable-narration tips, including a single affected day in an otherwise narrated itinerary. Ordinary uncertainty tips continue to pass this structural check. The original private smoke report remains preserved as evidence of the false positive; it must not be used as release approval. Private API receipts and runtime usage/fallback logs are in `artifacts/uat/deployed-compiled-20261031/`.

After the test, restored the branch alias to the prior paused deployment (`dpl_9uRDNdkzSq6XkkAQaKzYJU6niDvp`) and deleted the temporary live deployment (`dpl_Bgzo5W1U5ouFxucaMUrha5P7FK6r`, API confirmed `DELETED`). Branch configuration again pauses planning and uses a disabled AI key for subsequent builds; experiment/low-thinking settings remain branch-specific. Production is unchanged.

Next hillclimb: reproduce and reduce narration-reference failures using realistic long IDs and preserve rejected responses in private experiment receipts; then repeat the deployed eval and inspect the rendered result. Keep the exact reference guard and no-retry bound intact. The candidate remains unfit for production, and reserved holdouts remain unused.

Validation for the grader change: 93 script tests and the script TypeScript check pass. Existing app-code validation remains 1,255 web tests at `2ef8e378`; this iteration changes only evaluation code, its regression fixture and evidence documentation.

### Compact narration references and minimal-thinking trial (2026-10-31)

The deployed reference failure was not reproduced by two fresh low-thinking replays (Lisbon and Copenhagen). It remains intermittent; the original rejected response was unavailable. The private narration runner now retains parsed narration on success and rejection, and captures bounded raw text, finish reason and reported error usage for parse failures. It still stops on failure and requires billing reconciliation before more paid calls.

Changed only the narrator's request-local references from long inventory IDs to unique date/slot/position labels (`d1s2v1`). Exact per-date membership, uniqueness and complete date coverage remain mandatory. The application still clones the original schedule and changes only title/summary; inventory IDs, visits, meals, hotels and caution tips are unchanged. Tests reject cross-date substitutions and long-ID substitutions and verify original schedule preservation.

One low-thinking compact-reference pass across all 12 frozen development cases produced 11 successes and one Singapore parse failure (9.451 seconds; usage not recovered by the then-current runner). A separately retained diagnostic Singapore replay passed. Do not discard the failure or claim the compact-reference change solved reliability. A minimal-thinking trial then passed all 12 structural checks, but manual review found unverified accessibility language copied from an activity name. That variant was not accepted for experience quality.

The revised prompt forbids repeating suitability labels from unverified inventory names. A conservative lexical guard rejects those labels in titles/summaries while retaining the original uncertainty tips. It is not a semantic fact checker and deliberately errs toward fallback for these phrases, even if phrased as a caution. The revised minimal-thinking candidate passed all 12 frozen development cases: median narrator latency **2.311 seconds**, maximum **2.890 seconds**, 12,495 input / 3,477 output tokens (zero reported reasoning tokens), approximately **$0.016679 total** for this batch. No schedule data changed. These are single samples per development input, not proof of a production failure rate; upstream generation is excluded. Some generic prose embellishment remains (for example “scenic” river dining), and supplier identities, factual descriptions and suitability are still unverified.

The isolated app gate and aggregator replay now allow either measured low or minimal thinking. Production remains rejected by the gate. The 2,000-token narration ceiling, 30-second timeout, single-call/no-retry policy, default model and disclosure recipients remain unchanged. Artifacts preserve each trial separately under `narration-diagnostic-20261031`, `narration-compact-20261031`, `narration-compact-diagnostic-20261031`, `narration-minimal-20261031`, and `narration-minimal-cautious-20261031`. Reserved holdouts remain unused. Next validation is the deployed consented workflow, which previously exposed a failure missed by frozen replays.

### Resumed deployed test and real UI inspection (2026-10-31)

Revalidated the branch at `0421216a6a0124673e7131ca072473e6d6e2818e`: no remote divergence or Mini commits, CI passing, spend unchanged at $1.58. A first attempt reached the older paused alias and returned `503 PLANNING_PAUSED` before an AI request; its test trip was deleted. Redeployment alone had not advanced that alias. Explicitly assigned and reverified the live deployment and commit before the next attempt. Preserve the first attempt under `artifacts/uat/deployed-compact-minimal-20261031/` as a deployment-targeting failure, not a model failure.

The fresh consented Lisbon durable workflow used the compact-reference/cautious narrator with minimal thinking and low-thinking upstream agents. It completed at **43.807 seconds** and the saved plan was retrieved at **44.367 seconds** from the first API call. Runtime logs show all five model steps and no fallback event. Narration took 2.924 seconds, 1,034 input / 368 output tokens and zero reasoning tokens. Total reported usage was 5,781 input / 10,854 output tokens. Gateway reconciled at **$1.61/$20**. This fresh generation is not a controlled latency comparison against the previous run's different inventory.

The saved-plan evaluator passes three days without fallback text. Manual inspection confirms the selected day narration and retained planning cautions. The actual authenticated trip page rendered the saved itinerary at desktop size and a 412px phone viewport; body width matched the viewport. This is browser rendering, not a native Android or live-stream creation test. The browser automation initially clicked an off-screen sign-in button without submitting; scrolling into view resolved it. Do not classify that automation error as an application authentication defect.

The temporary inspection delay was implemented inside a private fetch wrapper, so the cleanup request's pre-existing 60-second abort signal expired while waiting. Consequently the smoke process exited 1 without its final report. The saved-plan pass does **not** make that harness run a full pass. A separate authenticated cleanup verified the owned QA trip, deleted it (200), and verified a subsequent GET returned 404. Future inspection hooks must run before creating the cleanup request's timeout. The live deployment `dpl_CN8gPabHULdXkuj82aW9GYFwd8NT` was deleted; the alias was restored to the current paused implementation deployment `dpl_69hmzKtEYEDSXxJVVC2a2BHsaCBJ`. Branch env again has paused planning and a disabled AI key. Browser session and its temporary credential profile were removed.

Private receipts, runtime logs, structural evaluation and desktop/phone screenshots are in `artifacts/uat/deployed-compact-minimal-live-20261031/`. They remain `qualityAccepted: false`: source validity, route quality, remote meals, booking suitability and broader independent acceptance are unresolved. Six holdouts remain untouched.

The actual UI exposed a missing cover: the resolver used the six-city picker and required an exact city name, while this API trip is `Lisbon, Portugal`. The existing Lisbon asset returned HTTP 200. Expanded cover resolution to the compact metadata for all 42 existing guides, accepting matching country qualifiers and known country aliases, while rejecting mismatched/multi-part ambiguous locations. No new image generation, supplier dependency or AI cost. Tests cover catalog consistency and the real resolver/header boundary on desktop and phone. The browser test mocks image bytes for deterministic decoding; the public image availability check is separate.

Validation: 1,261 web tests and workspace checks pass on the experimental branch; a clean checkout of main with only the cover fix passes 1,197 web tests, workspace checks and all 22 planning browser checks. The standalone cover fix is PR #57, independent of the experimental planner. Production's manual deployment hold remains unchanged.

PR #57 merged into main as `be5d6470aa3d2689f8f1dd2ced792bed58d0b2d7` after quality checks, CI tests and the isolated Vercel preview build passed. Reviewed final scope: five files, no deployment-config diff, no planner experiments or added dependencies. The merge was brought back into this experiment branch without code conflicts. This merges the cover fix; it does not deploy production or approve PR #55.


### Meal placement at visit boundaries (2026-10-31)

Added an independent offline comparison, `scripts/uat/evaluate-meal-geography.ts BASELINE_DIR CANDIDATE_DIR`. It requires matching nonempty trace sets, passing contracts, identical briefs/dining inventory, and exactly unchanged dated activity slots and activity objects. It measures breakfast before the first visit, lunch between morning and later visits, and dinner after the last visit. Unknown coordinates and missing meals are counted explicitly. These are supplied-coordinate screening conventions, not verified routes; hotel returns, opening hours, reservations and transfers remain unresolved.

Across 12 development traces / 126 meals, the original compiler selected six meals with a boundary leg over 3 km despite a supplied alternative within 3 km of every boundary. Ranking against the actual visit boundaries removes all six; distant meals fall from 36 to 30. Activities, dates, durations and source dining inventory are unchanged. A first candidate reduced the reuse penalty from 3 to 1, lowering summed boundary distance from 697.6 to 652.1 km but reducing summed per-trip distinct restaurants from 110 to 93. Rejected that tradeoff. Retaining the existing reuse penalty of 3 gives 675.2 km and 106 distinct restaurants, preserving all six avoidable-gap fixes. Paris improves from 20.9 to 11.8 km with eight distinct restaurants preserved; Marrakech increases from 15.1 to 16.2 km with eleven preserved. New York falls from eight to five restaurants because the closer candidates take priority. This remaining variety tradeoff requires traveler evaluation.

Regional Interlaken and Reykjavik gaps remain; these may need hotel-return context, transport verification or grounded additional inventory. The coordinate score cannot resolve them. All results remain `qualityAccepted: false`, and reserved holdouts remain untouched. No model calls or new spend: last reconciled cumulative spend is $1.61/$20. The production planner defaults are unchanged.

Evidence: `artifacts/uat/meal-boundary-comparison-20261031.json` and `artifacts/uat/meal-boundary-variety-comparison-20261031.json`, backed by matching `compiled-meal-boundaries-20261031` and `compiled-meal-boundaries-variety-20261031` trace directories. The independent comparison is committed; private traces remain ignored. Replay source hashes include the new boundary helper.

Validation: all 1,263 web tests pass, including ordered-boundary and lunch/dinner placement regressions. Workspace type, lint and format checks pass (nine existing lint warnings). Both 12-trace candidates pass the independent comparison and preserve every scheduled activity object.


### Rejected same-day dining penalty (2026-10-31)

The retained candidate repeats a restaurant within four days (one each in New York and Reykjavik, two in Interlaken). Tested an additional three-point same-day reuse penalty, preserving the existing near/far/unknown location tiers. The 12 offline replays preserve every activity and pass contracts, but only Interlaken changes: two same-day repeats disappear while summed boundary distance rises from 675.2 to 678.1 km. Total distinct restaurants remains 106, and the city repeats remain. This does not establish a better traveler experience, so reverted the compiler change. Retained `sameDayRepeats` in the independent comparison to make this tradeoff visible in later supply and scheduling experiments. Evidence: `artifacts/uat/meal-daily-variety-comparison-20261031.json` and `compiled-meal-daily-variety-20261031` traces.

Added a CLI regression verifying that empty/mismatched trace sets, altered scheduled activities, changed briefs and failed contracts cannot produce a successful comparison. The valid sparse fixture explicitly reports unknown coordinates and missing meals without accepting overall quality. All 24 agentic evaluation tests pass. No live requests or additional AI spend.


### Fresh regional and group candidate runs (2026-10-31)

Expanded the development set from 12 to 14 cases with Queenstown regional travel and a six-adult Athens budget trip. Six reserved holdouts remain untouched. The live comparison runner now has an explicit `--compiled-narrated --configs flash-low` mode: low-thinking upstream agents, deterministic compiler, minimal-thinking narrator, isolated staging environment required. Unsupported model mixes and non-staging environments fail before model calls; ordinary comparisons clear the experiment flag. Trace hashes now include compiler/narrator dependencies. The wrapper forwards the explicit flag. This is a direct agent-chain test with real bridge mapping, not a deployed workflow, browser-stream or native acceptance test.

Both fresh runs completed all five steps without fallbacks and pass structural contracts. Queenstown serial agent time was 44.5 seconds, including 2.8-second narration; Athens was 43.1 seconds with 2.0-second narration. Estimated combined model cost was $0.057122. Dedicated Gateway budget reconciliation increased from $1.61 to **$1.66/$20** (rounded provider totals); no retries or unknown-usage failures occurred. Private receipts and logs are under `artifacts/uat/fresh-candidate-20261031/`.

Manual review and the supplied-coordinate rubric reject broad quality acceptance. Queenstown has eight distant meal placements across fifteen meals, with 117.1 km of summed boundary legs; no supplied compatible alternative clears all boundaries within 3 km. It also schedules an Amisfield lunch alongside the generated “Gibbston Valley Winery Lunch & Tasting” experience. Added a deterministic **possible** duplicate-meal warning plus regression test; generated activity names do not prove meal inclusion, so no activity or meal is silently removed. `regraded.json` records the additional warning while preserving the original run receipts. This points toward grounded regional dining supply and meal-inclusion evidence, rather than another distance-weight tweak.

Athens preserves the six-adult party and yields five visits and nine meals across three days, seven distinct restaurants, no same-day restaurant repeats, no distant meal boundary legs, and 8.2 km of summed supplied boundary distance. These observations do not verify six-person reservations, room capacity, venue opening hours or traveler usefulness. Both cases remain unaccepted for overall quality. Workspace checks pass, as do all 39 agentic-evaluation/model-comparison tests and scripts type checking. Production defaults and deployment hold are unchanged.

### Queenstown source review and meal-overlap explanation (2026-10-31)

Reviewed first-party sources for the fresh regional failure:

| Source | Supported observation | Still unresolved |
| --- | --- | --- |
| [Provisions of Arrowtown](https://www.provisionsofarrowtown.co.nz/) | The business advertises breakfast and lunch; retrieved HTML gives 65 Buckingham Street, Arrowtown. | Independently sourced coordinates, January availability, reservations and suitability. |
| [Dishery](https://www.dishery.co.nz/) and its [contact page](https://www.dishery.co.nz/contact) | Brunch/lunch service and 4 Buckingham Street in Arrowtown are published. | The contact page contains conflicting closing-hour blocks. Do not select one silently or infer dinner service. |
| [Gibbston Valley booking catalogue](https://bookings.gibbstonvalley.com/obl2/gvw) | A named organic wine-and-food product describes a two-course lunch; restaurant lunch and other tasting/tour products are listed separately. | The generated “Gibbston Valley Winery Lunch & Tasting” has no matching supplier product ID. Meal inclusion must not transfer from a different product on the same winery site. No dated availability or booking was established. |

These are useful source-backed regional candidates, but not sufficient evidence to inject verified coordinates, opening windows or confirmed inclusions into the schedule. No generated meal was replaced with a guessed location. Three retrieved first-party HTML snapshots and a URL/SHA-256 manifest are retained privately in `artifacts/uat/queenstown-grounding-20261031/`; the booking-catalogue and conflicting contact-page observations above were reviewed with the browser source reader.

The experimental compiler now explains a possible overlap when an activity's name includes the scheduled meal and the slot also contains a restaurant. It retains both options, names the experience and restaurant, and asks the traveler to check the exact meal inclusions before arranging a separate meal. This converts the observed evaluator warning into actionable plan content without asserting an inclusion or silently deleting a meal. It is not a complete detector for meal-inclusive excursions.

The Queenstown frozen replay preserves every date, activity slot and restaurant, passes structural contracts, and carries the explanation through the actual saved-itinerary bridge. Evidence: `artifacts/uat/traces/compiled-meal-overlap-20261031/queenstown-regional.json`. All 17 compiler/boundary tests pass, including the positive overlap and ordinary-tour negative case. The initial test invocation from repository root failed module-alias resolution; rerunning from the web workspace passed. No additional AI calls; cumulative reconciled spend remains $1.66/$20. Production defaults are unchanged.


### Provider identity correction (2026-10-31)

Auditing the existing enrichment path found that TripAdvisor ratings and review links were copied from the first search result without checking venue identity. The existing request-cap test even accepted an unrelated result name. Changed enrichment to require exactly one name-and-full-address match after conservative case, comma and whitespace normalization. Branch names, street/unit numbers, postcode digits and diacritics remain significant. Full provider address strings are preserved; structured fallback addresses include unit and postcode fields. Missing candidate identity avoids a request; ambiguous, wrong-branch and mismatched-address results leave the original candidate unchanged.

This is an attribution correction, not verified availability, suitability or route evidence. It intentionally leaves unreviewed abbreviations and spelling differences unmatched, potentially reducing rating coverage. Existing enrichment limits/timeouts and provider external-processing restrictions remain unchanged. The official [Location Search documentation](https://tripadvisor-content-api.readme.io/reference/searchforlocations) describes ranked search results and optional identity/location filters; it does not make the first result an identity guarantee.

Isolated fix PR: [#58](https://github.com/stanleycyang/faroway/pull/58). Its final three-file diff is independent of the experimental planner. All 1,207 web tests and workspace checks pass on a clean main-based checkout; provider tests use mocked responses, with no live TripAdvisor request or added AI spend. The branch preview uses staging credentials, paused planning and a disabled AI key. Initial preview build correctly rejected the omitted approved staging-project identifier; configured that branch identifier and redeployed without weakening the isolation guard. Production deployment remains manually held.

PR #58 merged as `e3a8bd2e9e497fd750adf1df80f52bd4c06441e4` after CI Quality Checks and Tests passed and staging deployment `dpl_7eCCBhUDU13Tjuo7Bqa8AWCu3xaS` reached READY at reviewed head `7f73d024a6c61f871b2ec38293ec8e023ca7f68c`. Full-release acceptance jobs were skipped, not passed; no production deployment was performed. Cumulative reconciled AI spend remains $1.66/$20.

### Timing and rest evidence audit (2026-10-31)

Inspected the Singapore family case's explicit daily midday-rest instruction. The selected visits total 210–240 minutes per day, but `SuggestedDay` and saved `TripDay` represent morning/afternoon/evening blocks without start/end times or explicit break intervals. A visit in the afternoon neither proves nor disproves a midday rest. Do not reserve an entire afternoon or remove visits merely to make a coarse rest heuristic pass.

The contract evaluator now emits a separate timing assessment: `representation: day_parts_only`, `feasibility: unverified`, per-day scheduled activity minutes, and the missing evidence needed to assess visits, meals, transfers, hotel returns and rest intervals. `restInstructionPresent` is only a lexical review signal over traveler mobility fields, including negative instructions; it does not infer that a rest was requested or fulfilled. Generic rest tips cannot change the timing assessment.

Regraded all 14 development cases: 14 structural passes, zero verified timing assessments. Copenhagen, Edinburgh, Singapore and Queenstown contain rest/break instructions. Existing activity selections and production behavior are unchanged. Evidence is under `artifacts/uat/timing-audit-20261031/` (12 frozen development compilations plus the two fresh candidate runs). All 40 evaluator/comparison tests and scripts type checking pass. No additional AI requests; last reconciled total remains $1.66/$20.

The next timing capability needs explicit proposed visit, meal, transfer and rest intervals carried through saved and displayed plans, with sourced opening/transport constraints distinguished from estimates. Until then, daily activity-minute ceilings are useful screening but cannot certify a feasible day or fulfilled rest preferences. This audit does not claim that all current trips violate those preferences.

### Explicit timing prototype (2026-10-31)

Implemented an offline fixed-order timing solver and `scripts/uat/propose-trace-timing.ts TRACE_DIR [MIDDAY_REST_BRIEF_ID]`. It assigns local-minute start/end intervals to each visit, meal and optional rest, with explicit windows and buffers. The solver preserves all event durations and ordering; if one cannot fit, it returns the conflict and no partial accepted plan. Empty input, duplicate IDs, negative buffers and malformed windows fail validation. It does not mutate source traces or write proposed times into saved trips.

The CLI deliberately exposes experimental assumptions: breakfast 45 minutes, lunch/dinner 60 minutes, a 30-minute buffer before each subsequent non-rest event, and morning 09:00–13:00 / afternoon 14:00–18:00 / evening 18:00–22:00 windows. The optional one-hour rest must fit 13:00–15:00. These are proposed policy choices, not inferred traveler durations or verified routes/hours. Rest location and hotel return remain unknown. No free-form preference parser was introduced.

Across 14 development trips / 50 days, **37 days fit the stated policy and 13 conflict**. Conflicts include long regional excursions, several morning/lunch overruns, and evening visits pushing dinner after 22:00. They are not proof the real itinerary is impossible: the arbitrary policy itself needs traveler review and sourced operating/transfer constraints. Do not tune its windows merely to turn conflicts green. The four Singapore days also fit with explicit rest intervals: 13:00–14:00 on the first three, 13:45–14:45 on the fourth, without dropping a visit or restaurant. This is a useful counterexample to treating an afternoon visit as a rest violation.

Private reports, including input and implementation hashes, are under `artifacts/uat/timing-proposal-20261031/reviewed-v1/`. Five timing regressions plus the existing evaluator/comparison suites pass (45 tests), along with scripts type checking. This prototype is not integrated into the application or certified as a feasible timed trip; all reports retain `qualityAccepted: false` and `verified: false`. It establishes the explicit timing representation needed for subsequent joint scheduling, source constraints, saved-plan mapping and UI work. No AI requests; cumulative reconciled spend remains $1.66/$20.

### Unknown coordinate preservation (2026-10-31)

Investigated provider coordinates as potential evidence for timing. The local environment has no TripAdvisor key, and the accessible public reference did not establish a usable live coordinate response here; no provider lookup or new coordinate-verification claim was made. The existing location-evaluation/display path instead exposed a concrete inconsistency: route screening treats `(0, 0)` as the pipeline's unknown-location sentinel, but saved activity/restaurant mapping and map markers accepted it as a usable point.

Added a small shared coordinate validator that rejects the sentinel, missing/nonnumeric values, nonfinite numbers and out-of-range latitude/longitude. The saved-itinerary bridge omits those coordinates while preserving venue names and addresses. Map extraction also filters malformed historical records. Valid points on the equator or prime meridian remain accepted; the helper does not establish venue identity, opening hours or route feasibility. Experimental distance screening now reuses the helper with unchanged numeric distance behavior, and replay source hashes include its new file.

Isolated fix PR: [#59](https://github.com/stanleycyang/faroway/pull/59). The main-based branch contains only four files: shared validation, bridge integration, map integration and regression tests. All 1,208 web tests and workspace type/lint/format checks pass. Tests exercise the actual bridge and marker extraction for both activities and restaurants; Leaflet itself is mocked, so this is not a browser-rendering or native-device acceptance test. Preview settings explicitly use the staging database and approved project identifier, paused planning and a disabled AI key. No additional AI spend; last reconciled total remains $1.66/$20.

PR #59 merged as `d8e066bd02cd9cfebf302fa609c6b9bd5f44b2fb` after CI Quality Checks and Tests passed and staging deployment `dpl_HLQSBAj8dLGpRMakW5uA2zyEUjCy` reached READY at reviewed head `7f6981769b40e3a07fd5768b632b5f605c02d4fa`. The 45 evaluator/comparison/timing tests also pass after the shared-helper refactor. Full release acceptance remained skipped, and production deployment was not performed.

### Upstream thinking comparison and closure correction (2026-10-31)

Added an explicit `--upstream-thinking low|minimal` comparison option, permitted only with compiled narration and the isolated staging configuration. Low remains the default; production settings are unchanged. Invalid or silently ignored configurations fail before model calls. Ran three development pairs, alternating arm order, with the same implementation hash across all six calls. Each arm generates fresh inventories, so this is a small end-to-end screening experiment, not a controlled frozen-inventory comparison or statistically established effect. Six reserved holdouts remain untouched.

| Development case | Low / minimal serial seconds | Low / minimal estimated USD | Low / minimal distant-meal warnings | Low / minimal selected visits |
| --- | ---: | ---: | ---: | ---: |
| Singapore family | 48.862 / 38.569 | 0.035492 / 0.025574 | 2 / 3 | 7 / 12 |
| New York allergy | 52.925 / 35.053 | 0.036305 / 0.023324 | 0 / 1 | 8 / 9 |
| Queenstown regional | 54.311 / 38.578 | 0.039224 / 0.023180 | 4 / 7 | 9 / 9 |

All six runs complete with known usage, zero fallbacks and passing structural contracts. Minimal reduces aggregate estimated cost from $0.111021 to $0.072078 (35.1%) and summed serial agent duration from 156.098 to 112.200 seconds (28.1%). These durations are not deployed application latency. Existing warnings use unverified supplied coordinates and do not prove actual travel distances. Nevertheless, every minimal arm has more such warnings; Singapore changes inferred pace from relaxed to moderate despite the same short-walk and daily-midday-rest instruction. **Do not promote all-upstream minimal thinking.** Neither control nor candidate has overall quality acceptance. A future efficiency experiment should preserve orchestrator behavior and isolate specialist changes before considering broader adoption.

The six calls cost an estimated $0.183098. Dedicated Gateway reconciliation is **$1.85/$20**, inclusive of prior work and delayed settlement of the earlier batch. No retries or additional live calls were made during closure correction. Original receipts, separate regrading, source hashes and the explicit rejection decision are retained privately under `artifacts/uat/upstream-thinking-paired-20261031/`.

Manual review also found three published weekly-closure conflicts: low schedules the Met on Wednesday; minimal schedules the Morgan on Monday and the Frick on Tuesday. Reviewed [Met visitor information](https://www.metmuseum.org/plan-your-visit), [Morgan visitor information](https://www.themorgan.org/visit) and [Frick visitor information](https://www.frick.org/visit). Met content was retrieved directly; Morgan and Frick were reviewed from official search extracts after direct fetches were blocked. These are recurring published hours, not confirmed January 2027 availability. Added narrowly matched names with source/retrieval notes; branch variants and exterior walks do not inherit these rules. Regressions distinguish former Frick Madison and Pittsburgh from the Fifth Avenue museum.

Offline rescheduling of both frozen NYC inventories reduces the three listed closure findings to zero, passes structural contracts and reports no unfulfilled compiler highlights. It changes several selections and dates: low drops from eight to seven visits, while minimal retains nine with substitutions. The minimal replay still has a distant-lunch compiler warning. This correction only demonstrates handling of the reviewed constraints; it does not validate other opening hours, allergy suitability, routes, meal reservations or timing. The facts remain evaluation fixtures rather than a production availability service. All 47 evaluator/comparison/timing regressions and workspace checks pass. Draft PR #55 remains unaccepted for production.


### Isolated hotel-thinking screen and traveler-context correction (2026-10-31)

Applied the existing explicit one-hour midday-rest timing policy to both Singapore traces from the preceding paired experiment. All four low-thinking days fit; three minimal-thinking days conflict with the policy's visit windows by 15–30 minutes. These are proposed windows and buffers, not sourced opening hours or travel durations. The result strengthens the decision against the all-upstream change without proving real-world infeasibility. No explicit traveler-selected pace field exists in SearchInput; do not silently convert a mobility phrase into an authoritative pace choice.

Added `--hotel-thinking minimal` to the compiled comparison runner. It requires low upstream thinking and compiled narration; mixed, invalid and ignored configurations are rejected before model calls. A separate config ID and recorded settings distinguish the hotel-only experiment. Production model defaults remain unchanged. Three fresh development runs retain low orchestrator/activity/dining thinking and minimal narration, changing only the hotel thinking configuration. All three share an implementation hash and complete without fallback, with ten hotel suggestions each.

| Development case | Serial agent seconds | Estimated USD | Hotel step seconds | Inferred pace | Distant-meal warnings |
| --- | ---: | ---: | ---: | --- | ---: |
| Singapore family | 40.109 | 0.024075 | 9.791 | relaxed | 2 |
| New York allergy | 43.944 | 0.032081 | 9.744 | moderate | 1 |
| Queenstown regional | 57.565 | 0.038811 | 10.218 | relaxed | 5 |

All three pass structural contracts and the listed closure checks. Singapore has eight visits and all four days fit the explicit rest policy. These are single fresh generations with different inventories from the prior low controls; they do not establish a causal quality or latency improvement. Queenstown's serial duration is slower than the preceding low control and still has five geographic warnings. **Do not promote the hotel-only setting yet.** A subsequent controlled comparison should freeze the orchestrator plan and directly assess hotel outputs, after the context correction below. The six holdouts remain untouched.

This batch cost an estimated $0.094967. The latest dedicated Gateway total is **$1.94/$20**, with ordinary provider settlement lag observed during polling. No retries occurred. Private receipts, regrading, recorded effective settings and the explicit non-acceptance decision are under `artifacts/uat/hotel-thinking-minimal-20261031/`. These measurements precede the hotel prompt correction; do not attribute them to that fix.

Review found that the hotel agent discarded saved party size, adults/children, child ages, requested room count, mobility details and structured requirements, receiving only model-inferred amenities instead. Added these saved details explicitly to its prompt, preserving unknown values as unspecified and infant age zero. The system instruction distinguishes these needs from verified capacity/accessibility/dietary suitability; this remains informational hotel generation, not a verified quote or booking. Two regressions failed against the old code and pass with the correction, including omitted inferred amenities and unknown occupancy. All 1,277 web tests and workspace checks pass; the comparison harness's 16 tests also pass. The correction is separately committed for independent production review; draft PR #55 and the optimization goal remain open. No production deployment occurred.


### Hotel-context fix merged independently (2026-10-31)

[PR #60](https://github.com/stanleycyang/faroway/pull/60) isolates the saved traveler-context correction from the experimental planner. Its final main-based diff contains only the hotel agent and regression tests. The initial isolated type check caught a missing test-only SearchPlan import that existed on the experimental branch; added it and reran checks. All 1,210 main-based web tests and workspace checks pass. CI Quality Checks and Tests passed on reviewed head `046daf873f49eff5366fe8fdc27c8a3eb7fe7752`; staging deployment `dpl_A72tXLP4WR2uHt5A6nxNCq25Qbzf` reached READY at the same commit with paused planning, approved staging database settings and a disabled AI key.

Merged as `ac31abf6f60fa597355ebf8cfda5f4ed7e4bfbfb`. Full release acceptance jobs were skipped, not passed; production remains manually held. Synchronizing main into the experimental branch introduced a duplicate test-only type import, which was removed before validation and push. This fix ensures the hotel prompt receives the saved needs; it does not prove generated hotels satisfy them. No new live requests were made; latest reconciled spend remains $1.94/$20. Next efficiency evidence should compare hotel generations against identical frozen plans, including the corrected context, before any model-setting promotion.


### Frozen-plan hotel comparison and eligibility failure (2026-10-31)

Added `apps/web/scripts/hotel-replay-live.ts`: exactly one hotel-agent invocation against a completed, non-fallback frozen search plan. It requires explicit live mode, the approved staging target and dedicated key, and an explicit low/minimal setting. It rejects existing output paths and records the frozen input/plan hashes, implementation hash, model usage, fallback events and output privately. Interrupted or unknown-usage trials cannot be treated as completed comparisons. No orchestrator, activity, dining, aggregation, database or live inventory-provider request is made. This tests the corrected hotel context merged in PR #60; it does not remeasure application latency.

Ran two repetitions per arm for three development plans: Singapore family, Copenhagen family with access requirements, and Athens six-adult group. Arm order alternated. All 12 receipts share one implementation hash, retain the same frozen input within each case and contain ten suggestions, one known-usage event and no fallbacks. `scripts/uat/evaluate-hotel-replays.ts` rejects missing usage, mismatched inputs, incomplete pairs and mixed implementations before emitting a comparison; regressions exercise those refusals. Original receipts and a separately hashed assessment are under `artifacts/uat/frozen-hotel-paired-20261031/`. The six reserved holdouts were not used.

| Setting | Calls | Estimated total USD | Summed hotel-agent seconds | Reported reasoning tokens |
| --- | ---: | ---: | ---: | ---: |
| Low | 6 | 0.033499 | 50.629 | 0 |
| Minimal | 6 | 0.034210 | 48.276 | 0 |

Minimal is cheaper in three of six pairs and faster in three. Its aggregate cost is slightly higher. This small repeated sample provides no consistent efficiency advantage and no basis for promoting the hotel-only setting. It also shows why the preceding full-chain cost differences cannot be attributed solely to hotel thinking. The batch cost $0.067709 estimated; dedicated Gateway reconciliation is **$2.01/$20** inclusive of prior work. No retries or unknown-usage failures occurred.

Source review found a substantive failure in **all four Singapore trials**: each recommends Heritage Collection on Chinatown for a family with children. The property's [official FAQ](https://hericoll.com/frequently-asked-questions/) states a minimum guest age of 18 and explicitly lists Chinatown among its walk-up properties. Three trials also assert an elevator amenity. The [official Chinatown room page](https://hericoll.com/collections/chinatown-premium-loft-skylight/) independently identifies the property at 227 South Bridge Road and no lift. The current published policy is evidence for a conflict requiring review, not confirmation of January 2027 availability. The official FAQ HTML and URL/hash manifest are retained privately in the batch's `sources/` directory.

Added a development evidence fixture and `evaluateHotelConstraints`: exact property/city matching, published minimum-age conflicts and explicit positive lift claims contradicted by the source. Tests prevent transferring Chinatown's lift policy to another branch, treating negated amenity labels as positive claims, or treating unreviewed properties as verified. Regrading finds four party conflicts and three lift contradictions among 120 suggestions. Only four suggestions match this reviewed property; the other 116 remain unreviewed. This is an evaluation fixture, not a production eligibility or availability service. Neither arm has quality acceptance.

All 37 evaluator/replay tests and scripts type checking pass; workspace checks also pass for the runner. Saved-context preservation is necessary but insufficient: both settings can still generate unsuitable candidates and unsupported amenities. The next quality change needs source-backed hotel eligibility and amenity handling before ranking, evaluated on broader properties rather than a hard-coded prompt exception for this hotel. Production model settings remain unchanged.


### Source-backed hotel screening in the staging flow (2026-10-31)

Added a data-driven `screenHotelCandidates` boundary over reviewed hotel-policy evidence. In the explicitly enabled staging experiment, the hotel agent applies it before returning suggestions to streaming/persistence consumers; the compiled aggregator also applies it before ranking, covering callers that reuse an earlier inventory. AI ideas with a published all-guests age conflict or a contradicted lift claim are withheld rather than relabeled as verified. Original objects are not mutated. Provider quotes and legacy records with unknown provenance are outside this experimental screen. A surviving candidate is still unverified.

Age evidence now requires an explicit `all_guests` scope before it can exclude a property. Missing/unknown scopes, check-in age requirements and shared-room rules do not become property-wide child bans. This distinction matters: [Arp-Hansen's published terms](https://www.arp-hansen.com/our-policies/terms-and-conditions) permit guests under 18 when accompanied by a responsible adult, while [Steel House's room guidance](https://www.steelhousecopenhagen.com/vaerelser-og-senge) requires private rooms with a parent/guardian for under-18s. Neither is evidence that an entire property refuses families. These examples inform the scope boundary, not new verified hotel matches in the current fixture.

When raw inventories are screened at aggregation, the draft retains a source/date explanation for withheld candidates. If no hotel remains, it returns no hotel choice and an explicit accommodation-planning notice instead of silently restoring the excluded top-scoring candidate. Existing narration preserves those notes. Before-agent filtering keeps known conflicting ideas out of the hotel list as well as the top-hotel choice. Telemetry records counts without adding a model request. This integration is disabled in production by the existing exact staging/experiment gate.

Offline replay of all 12 frozen hotel trials with the real screening and saved-itinerary bridge removes four candidates and reduces the seven reviewed policy/amenity findings to zero. Singapore retains nine candidates in each run; the other eight trials retain ten each, for 116 remaining suggestions. These 116 suggestions have not been independently verified, and no broader quality acceptance is claimed. Private mapped results and implementation/input hashes are in `artifacts/uat/frozen-hotel-paired-20261031/policy-screen-reviewed.json`. Visit selections are reused, not regenerated; no deployed/browser/native acceptance or current booking availability was established.

Five new web regressions exercise source conflicts, nonmutation, lower-scoring replacements, empty results with notices, provider/legacy boundaries, scoped age rules, the actual agent → aggregator → saved-mapping handoff, and production opt-out. All 1,282 web tests pass, along with the evaluator/replay suites and workspace checks. Raw hotel-comparison runs explicitly clear the policy experiment so future generation measurements cannot accidentally include filtering; source hashes now include the policy dependencies. No new live AI calls; reconciled spend remains $2.01/$20.

This implements the negative-evidence decision boundary, not scalable evidence discovery. Production release still requires broader exact-property/source adjudication, freshness handling, additional destinations and complete end-to-end acceptance. One reviewed property is insufficient coverage. Draft PR #55 remains open and unaccepted for production.


### Hotel evidence review deadlines and scoped room guidance (2026-10-31)

Hotel evidence now includes an explicit `reviewAfter` date and is evaluated against a recorded as-of date, separate from the travel dates. The pilot uses an editorial recheck deadline of 2026-11-30 for observations reviewed on 2026-10-31; this is a maintenance choice, not a claim that the property policy remains valid until that date. Missing/invalid date ranges, future observations and due reviews cannot produce current exclusion findings. They produce visible review requirements and count as unchecked evidence. Offline comparison and policy replay accept explicit as-of dates so historical results do not silently change with the clock.

An initial expiration replay revealed that merely ignoring stale constraints could automatically promote the previously conflicting property again. Corrected this before accepting the change: stale/invalid/future evidence keeps the idea visible with an idempotent review notice, but places it in `selectionPendingReview`, outside automatic top-hotel selection. It is not a permanent property ban and does not assert the old policy is still true. If no selectable hotel remains, the draft says no hotel has been selected. Fresh all-guests or amenity contradictions continue to withhold the AI idea entirely. Original objects and provider quotes remain untouched.

Added a second reviewed property, [Steel House Copenhagen's official room page](https://www.steelhousecopenhagen.com/vaerelser-og-senge), retrieved directly. It requires under-18s to stay in private rooms with a parent/guardian. The scoped rule produces a visible request to check the exact room and check-in arrangement; it does not exclude the property as adults-only or certify any available room. The source HTML and URL/hash metadata are retained in `artifacts/uat/hotel-policy-freshness-20261031/`. This property was not present in the earlier 120 generated hotel suggestions, so it expands the scope regression coverage without pretending to improve their factual-review denominator.

Two explicit-date offline replays cover all 12 frozen hotel trials. As of 2026-11-01, four conflicting ideas are withheld and 116 remain. At the 2026-11-30 review deadline, those four ideas become visible review items among 120, but all four are pending recheck and none can become the automatically selected hotel. Their source policy was not revalidated by this counterfactual test. Revised mapped artifacts are `reviewed-replay-2026-11-01.json` and `reviewed-replay-2026-11-30.json`; earlier intermediate results are retained separately. This is not a deployed/browser/native acceptance test.

All 1,285 web tests, 39 evaluator/replay tests and workspace checks pass. Tests cover the exact deadline, future/invalid/missing dates, preserved unknown status, nonduplicating notices, unchanged source objects, scoped room guidance in the app draft and the automatic-selection regression at expiration. No new live AI requests; cumulative reconciled spend remains $2.01/$20. The change remains staging-only in draft PR #55. Scalable official-source discovery, property adjudication and refresh execution are still required before claiming broad hotel grounding or production readiness.


### Bounded hotel source refresh review (2026-10-31)

Extended the existing public-source fetcher with `--hotels`, using only the reviewed fixture URLs. The fetcher rejects non-HTTPS or credential-bearing URLs, does not follow redirects, limits response size to 1 MB, uses a 15-second request timeout and at most two concurrent requests, and refuses to overwrite earlier receipts. It sends no traveler details and makes no model calls. Its entry point is now import-safe so source parsing and preflight behavior can be checked without fetching.

Added `review-hotel-source-refresh.ts` and a pure refresh auditor. A review packet requires exactly one successful receipt for each approved URL, a valid nonfuture retrieval timestamp within an explicit 24-hour review window, and the short previously reviewed policy anchors in normalized extracted text. Missing, duplicate, failed, stale, malformed or changed receipts produce investigation items. Anchor presence is only a review aid: an old sentence can coexist with a newer exception elsewhere. Neither a successful fetch nor matching snippets renews `observedAt`/`reviewAfter`, certifies policy scope, changes an itinerary or enables a pending hotel selection.

Both approved hotel pages retrieved successfully. Both packets are ready for policy review, with no missing anchors. Their normalized extracted page-text hashes also match the separately retained prior snapshots. This is HTML text extraction, not browser-rendered visibility or an independent semantic check; the report explicitly retains `policyVerified: false`, `evidenceUpdated: false` and `canRenewAutomatically: false`. No fixture review dates were advanced. Review source identity, scope and contradictions before recording any new policy observation.

Private receipts and input/evidence/implementation hashes are under `artifacts/uat/hotel-source-refresh-20261031/`, including `review-validated.json` and `baseline-comparison-reviewed.json`. All 49 grounding/evaluator/replay tests and scripts type checking pass, as do workspace checks. Additional direct preflight checks confirm non-HTTPS refusal and preservation of an existing receipt. No additional AI spend; the last reconciled total remains $2.01/$20. This automates bounded retrieval and review preparation for approved sources; general official-source discovery and production refresh execution remain incomplete.

### Hotel source discovery: reject mixed policy extraction (2026-10-31)

Added an isolated `--hotel-discovery` mode to the bounded grounding probe. One call covers three development properties: Village Hotel Albert Court, Hotel Alexandra Copenhagen and A for Athens. No traveler details, database writes or trip edits are involved. Receipts record prompt/implementation hashes, finite token-usage status and the need to reconcile search fees separately. Conflicting probe modes are rejected before a paid request.

The first combined discovery/policy prompt completed in 6.297 seconds (216 input / 910 output tokens, $0.002838 estimated tokens only). It returned plausible official homepages but also an image file as an official source, attributed third-party material to hotel policy and made unsupported accessibility claims. Grounding supports pointed accessibility assertions at third-party sources. Rejected the policy output in full; no evidence fixture was changed. Receipt and hashed assessment: `artifacts/uat/hotel-source-discovery-20261031/`.

Narrowed the next prompt and structured output to one homepage URL or null per property, with no policy fields. This single follow-up completed in 2.596 seconds (179 input / 131 output tokens, $0.0004825 estimated tokens only). All three URLs matched independently reviewed official pages: [Village Albert Court](https://www.villagehotels.asia/en/hotels/village-hotel-albert-court), [Hotel Alexandra](https://www.hotelalexandra.dk/) and [A for Athens](https://aforathens.com/). The provider reported three search queries, but zero SDK sources and no grounding supports. Thus this is a useful identity-lead result, not source-grounded policy or quality acceptance. Different output scope and one repetition prevent treating these timings as a controlled model performance comparison. Receipt and hashed assessment: `artifacts/uat/hotel-source-discovery-urls-20261031/`.

Added a reusable shape auditor after the trial: rejects extra policy fields, unexpected/duplicate/missing hotel identities, credentials, non-HTTPS URLs, query/fragment URLs and common asset paths. Passing this check never authorizes URL fetching or establishes source ownership, safe destinations, policy or suitability. It deliberately retains independent review requirements even for well-formed URLs; a separate approved-source retrieval boundary is still required. Tests cover both valid leads and these refusal paths. No additional paid run was needed to test the auditor.

All 22 grounding/preflight tests and workspace checks pass. Latest provider reconciliation is $2.10/$20; the most recent search-call fee may still be settling. Token-only estimates exclude search charges and must not substitute for the provider budget. Production defaults remain unchanged and draft PR #55 remains unready for production. Next: independently reviewed source retrieval and scoped extraction on a broader development set, followed by end-to-end evaluation before using reserved holdouts.

### Frozen hotel fact extraction and scope correction (2026-10-31)

Added an eight-question development benchmark over five independently reviewed official hotel pages. Cases cover Heritage Chinatown's all-guests age minimum and branch lift absence; Steel House's shared-room age restriction; Village Albert Court's check-in age and named Family Room capacity; A for Athens' named Gaia Suite capacity; and two accessibility questions whose supplied pages do not establish an answer. Missing evidence must remain unknown, never a negative amenity claim. These are targeted questions, not an evaluation of autonomous discovery of every relevant policy. Expected values, scopes and quote anchors are excluded from model input.

`fetch-grounding-pages.py --hotel-facts` retrieves only the committed benchmark URLs with the existing no-redirect, bounded-body/request behavior. The five frozen page receipts are under `artifacts/uat/hotel-fact-extraction-20261031/pages.json`. `hotel-fact-extraction-live.ts` makes one explicit staging-only, no-retry call against those local pages with no search tools, URL resolution or itinerary writes. It records implementation, benchmark, prompt and source-input hashes, usage and extracted claims. `evaluate-hotel-facts.ts` regrades completed, known-usage receipts against matching source bytes without model calls. It preserves original and current audits and benchmark hashes; unsupported model pricing and mismatched sources are refused.

| Prompt | Reviewed facts passing | Latency | Input / output tokens | Estimated token cost |
| --- | ---: | ---: | ---: | ---: |
| Initial | 7/8 | 3.114 s | 15,848 / 508 | $0.009448 |
| Branch-versus-room clarification | 8/8 | 3.583 s | 15,889 / 635 | $0.0098495 |

The initial output correctly reported no lift at Heritage Chinatown but classified the hotel branch as a named room. Clarified generally that named rooms are accommodation categories and hotel branches are properties. The refined output corrected the scope and retained null answers for unsupported accessibility claims. Its original automated score was still 7/8 because it selected a different, valid age-policy passage. Independent source review confirmed that passage explicitly names families with children and an age minimum of 18. Added it as a reviewed alternative conjunction of evidence anchors rather than accepting any mention of “18.” Regraded both saved outputs, preserving original results and hashes: initial remains 7/8, refined becomes 8/8. No paid rerun was needed for the grader correction.

The evaluator checks exact source association, unique expected identities, typed reviewed values, scope, named room and contiguous copied evidence with relevant anchors. Regressions reject property-wide interpretations of shared-room restrictions, branch/room confusion, fabricated or context-free quotes, duplicate receipts and inferring true/false from absent amenity statements. Anchors are a development scoring mechanism, not a general semantic policy verifier. Room capacity does not prove a room is available or that an entire party can be accommodated. No published-policy fixtures or product selections were updated from these outputs.

All 120 script tests pass, along with workspace checks. The two calls cost $0.0192975 estimated combined; latest dedicated Gateway reconciliation is **$2.12/$20** including prior work. Raw receipts, original audits and the hashed `regraded-assessment.json` are retained privately. One successful revised run on eight development questions is insufficient for a production promotion or reliability estimate. Next: repeated extraction on broader source cases, source-change/contradiction handling, and staging integration measured against complete trip quality and latency. Reserved holdouts remain unused.

### Full-chain infant/multi-room coverage and access-conflict replay (2026-10-31)

Found an evaluation-harness coverage gap: `UatBrief` could not represent child ages or room count, and the live input adapter omitted both. Added optional `childAges`/`roomCount`, propagation to actual `SearchInput`, and deterministic checks for their preservation. Explicit age zero and empty age lists are distinct from unknown. Invalid party sums, inconsistent age counts, out-of-range/noninteger ages and invalid room counts are rejected before paid steps. Historical briefs remain unchanged; two new development briefs cover Singapore with ages 0 and 7/two rooms and Athens with six adults/three rooms. The development set is now 16; six reserved holdouts remain unrun.

Ran both through actual orchestration, hotel/activity/dining generation, compiled scheduling, narration and itinerary mapping using low upstream thinking and minimal narration. Vendor credentials were removed, the approved staging target and dedicated key were used, and the run cap was $0.50. Both completed all five steps without fallbacks, preserved party details and passed deterministic contracts. Each produced three days, six visits and nine assigned meals. Serial agent durations were 49.732 seconds (Singapore) and 46.114 seconds (Athens); these are harness durations, not production latency or time to first useful content. Estimated combined cost was $0.066928; latest provider reconciliation is **$2.19/$20**. Receipts and reports are private under `artifacts/uat/party-context-full-chain-20261031/`.

Output review exposed a failure outside those contract checks: the Singapore plan scheduled The Battlebox despite the supplied activity description saying it has stairs and the saved request explicitly requiring stroller access. Added a narrow staging compiler screen for explicit supplied access contradictions when structured step-free requirements or directly stated stroller/wheelchair/step-free requests are present. It recognizes explicit stair/access-obstacle wording, handles common negations, leaves unknown/optional access unclassified, and does not certify surviving activities as accessible. Deferred activities receive a traveler-facing explanation that survives itinerary mapping. This is an internal consistency check over supplied descriptions, not independent accessibility verification or comprehensive free-text understanding.

Offline replay removed The Battlebox but initially selected Sun Yat Sen Nanyang Memorial Hall. Reviewing the [official restoration notice](https://www.sysnmh.org.sg/en/whats-on/events/closure-notice) found an ongoing closure and no confirmed reopening for the trip. Added an exact-name temporary-closure fixture requiring reopening review, without interpreting its event-calendar end date as confirmed availability or applying it to offsite programmes. The [official Battlebox FAQ](https://battlebox.sg/faqs/) separately confirms lack of wheelchair access but welcomes accompanied children; no child-age ban or stroller policy was inferred from that source. Both reviewed pages were retrieved into the private artifact directory.

The combined access/closure replay removes both problematic candidates, retains three-day coverage with five visits and nine meals, preserves the access explanation in mapped tips, and passes contracts without a model call. Athens selections remain unchanged by the access screen. Singapore still has meal-distance warnings, unverified routes/hotel capacity and no explicit rest intervals. This is not whole-trip quality acceptance. Original and intermediate replay outputs remain preserved rather than being replaced by the improved result.

All 1,295 web tests and the script regression suite pass, with additional regressions for pre-spend party validation, infant-age preservation, access negation handling, unchanged inventory and restoration scope. Workspace checks pass. The compiler change and evidence remain experimental in draft PR #55; production defaults are unchanged. Next full-flow quality work should address meal geography and explicit rest/timing feasibility, while broadening sourced venue review rather than relying on these few known exclusions.

### Distinguish restaurant shortages from separated visit boundaries (2026-10-31)

The latest Singapore replay has three genuine supplied-inventory gaps: Tanglin breakfast, lunch between Tanglin and Marina Bay, and Marina Bay breakfast. Its lunch anchors are approximately 5.70 km apart on generated coordinates, so a 3 km-per-leg candidate is not mathematically excluded. Existing restaurants do not meet that boundary screen. No ranking adjustment alone creates missing nearby supply, and the earlier dining repair experiments already showed that invented addresses can make apparent coverage improvements misleading.

Broader offline review of 12 saved meal-boundary traces found four different transitions whose anchors exceed 6 km: Lisbon Belém-to-castle (7.58 km), Tokyo museum-to-design-museum (7.18 km), and two Interlaken transitions (8.50/7.74 km). By the triangle inequality, a restaurant cannot be within 3 km of both supplied anchors. Added `separated_visit_anchors` to the coverage diagnosis and exclude these gaps from automatic restaurant-resupply targets. They require checking locations, choosing which area to eat in, allowing the transfer, or changing visits. The staging compiler now explains this in its tips. Distances remain straight-line screening over unverified input locations, not walking routes or transfer times.

The audit preserves input and implementation hashes in `artifacts/uat/meal-coverage-diagnosis-20261031/report.json`: four separated-boundary gaps across 12 traces, with 16 area targets still actionable elsewhere. No paid resupply was run, so this is a demonstrated elimination of inappropriate repair targets, not measured API savings or a complete trip-quality improvement. Tests preserve actionable close-anchor shortages, unknown-coordinate handling and the traveler-facing explanation.

Source review for a possible Singapore breakfast replacement found another stale-identity trap. An older [Bee's Knees page](https://www.beesknees.sg/bees-knees-at-the-garage) remains discoverable while the [current operator page](https://www.wildseedcafe.sg/the-garage/) and [park dining directory](https://sbg.nparks.gov.sg/visit/dine---shopping/) list Wildseed Café at The Garage. Those current sources disagree on weekday opening (07:30 versus 08:00). The linked menu exceeded the web retrieval size and was not reviewed. Recorded this lead and uncertainty in `botanic-source-review.json`; did not inject coordinates, certify breakfast service at a future visit time, or automatically replace the meal. An official-looking URL alone is insufficient freshness/identity evidence.

The web suite passed 1,297 tests; the subsequent focused compiler/coverage suite passed all 22 tests including the added explanation regression. Workspace checks pass. No additional model spend; latest reconciled total remains $2.19/$20. Production defaults are unchanged. Remaining work includes source-backed nearby dining supply, actual route/timing feasibility and broader end-to-end acceptance.

### Visible provisional midday-rest timing in staging drafts (2026-10-31)

Connected the existing fixed-order timing solver to the experimental schedule compiler for narrowly recognized affirmative daily-midday-rest requests. The matcher handles the current explicit development wording and common negations; it is not a general language interpreter or a new authoritative traveler-selected pace/duration field. Suggested policy: breakfast 45 minutes, lunch/dinner 60 minutes, 30-minute buffers before subsequent meals/visits, and a one-hour rest within 13:00–15:00. Visit windows remain morning 09:00–13:00, afternoon 14:00–18:00 and evening 18:00–22:00. These are plainly labeled planning assumptions, not sourced opening hours, transit durations or reservations. Rest is assumed near lunch; hotel-return travel is unresolved.

For a fit, day tips now begin with a proposed local-clock sequence and its assumptions. These tips survive the actual itinerary bridge and use existing web/native tip fields; this turn did not verify browser/native rendering. For a conflict, the draft reports that the rest request remains unresolved, emits no partial timetable and preserves all visits and durations. The compiler records structured proposals and conflict details in replay artifacts. Existing structural trace contracts still classify the activity representation as day parts; those contracts are not timing-quality acceptance. Product persistence/editing remains text-based for these timing notes: a production design needs structured times and revalidation after trip changes before promotion.

Replayed the current Singapore infant/two-room inventory: all three days fit the proposed policy with explicit rest intervals. Selected visits, meals and dates are byte-equivalent to the preceding access/closure replay. The first day's rest is proposed at 13:00–14:00, with an additional 30-minute buffer before the afternoon visit. Replayed the earlier overloaded Singapore minimal-upstream inventory: one day fits and three report conflicts, with zero partial events on failed days. Athens receives no added rest timetable because no daily midday rest was requested. No model call, silent visit deletion or duration shortening was used.

Private evidence is under `artifacts/uat/party-context-full-chain-20261031/`: `singapore-rest-timing-recorded-replay.json`, `singapore-overloaded-rest-replay.json`, and the earlier preserved intermediate replays. Timing implementation dependencies are included in live/replay source hashes. All 1,311 web tests, 124 script tests and workspace checks pass; tests cover request negation, explicit infant-family wording, rest non-overlap, conflict behavior, unchanged selection and mapped-tip preservation. No additional AI spend; latest reconciled total remains $2.19/$20. Production defaults remain unchanged. Real routes/hours, structured editable timing, app rendering and broader acceptance remain required.

### Structured timing lineage, native preservation and edit invalidation (2026-10-31)

Added optional `timingProposal` metadata to agent/saved day types and the native day model. It carries the proposed policy version, unverified status, event IDs/kinds/durations/local times, buffers, conflict details and a deterministic basis over the date and ordered visit/meal identities (including names and visit durations). The basis is a change-detection key, not a security signature or proof of real-world feasibility. Shared validation lives in the dependency-free types package and rejects stale bases, missing/extra/reordered events, overlaps, incorrect durations/buffers, out-of-policy windows, partial conflict schedules and claims of verified timing.

The web bridge preserves valid structured timing. Native normalization preserves actual slot metadata and numeric durations while flattening activities, allowing validation again after a cache reload. Changed dates, visits, durations or meal selections invalidate the proposal; a changed cached duration label also cannot retain an old numeric timing basis. Mapping boundaries remove the corresponding stale timetable/assumption text and request a fresh timing review while retaining unrelated tips. Existing server activity swaps already cleared affected-day tips; they now delete structured timing too. Lock/unlock operations preserve it because they do not alter the schedule. No automatic recomputation or booking changes occur during edits.

The trace evaluator now validates timing metadata on both generated and mapped days. Missing/changed mapped metadata fails the contract, and an explicit unresolved midday-rest conflict is a failure rather than a structurally passing day. Untimed historical traces retain their original contract treatment; missing timing does not become verified feasibility. This strengthens the previous turn's distinction between fitting and overloaded examples.

Replayed the saved Singapore cases without a model call. The three-day fit preserves identical metadata through the agent-to-saved bridge, native flattening and serialized native cache reload, with all contracts passing. The overloaded four-day replay preserves its conflict metadata through the same boundaries and fails on days 2, 3 and 4. `structured-timing-assessment.json` records receipt/validator hashes and regraded outcomes under `artifacts/uat/party-context-full-chain-20261031/`; earlier receipts remain unchanged. This verifies mapping/cache behavior, not an actual database/network write or rendered Android screen.

All 1,316 web tests, 125 script tests, eight targeted native normalization tests and workspace checks pass. Replay source hashes include the shared timing validator. No additional AI spend; latest reconciled total remains $2.19/$20. Production defaults are unchanged. Timing edit controls, broader brief-change revalidation, sourced routes/hours and actual browser/native end-to-end acceptance remain required before production promotion.

### Render provisional timing in web and native trip details (2026-10-31)

Added a shared presentation adapter and dedicated proposed-timing panels to owned/shared web itineraries and native trip details. Valid proposals show local times, named visits/meals and a distinct midday-rest row. Planning assumptions and unverified routes/opening hours remain visible. Conflicting proposals show a review message with no partial timetable. Existing validation runs before presentation; stale metadata retains a fresh-review tip, and valid panels suppress only the corresponding legacy timing paragraphs while preserving unrelated advice.

Reviewed desktop and mobile browser screenshots for fit and conflict states. The long Singapore garden name wraps without horizontal overflow, and the rest row remains legible. Two Playwright viewport cases pass, covering visible uncertainty, rest timing, duplicate-note removal, retained advice and conflict behavior. All 1,316 web tests, 26 targeted native component/trip-detail tests and workspace checks pass. Native component tests use mocked React Native primitives and do not prove device layout. ADB reports no connected device; physical Android rendering remains unverified. Browser fixtures exercise the actual itinerary component but do not prove authenticated persistence or network end-to-end behavior.

No additional AI calls or spend; latest reconciled total remains $2.19/$20. These changes remain in draft PR #55 with the experimental timing flow. Actual route/opening-hour validation, edit controls, broader acceptance and physical-device checks remain outstanding before production promotion.

### Keep native meal cards consistent with proposed timing (2026-10-31)

Reviewed brief-change presentation: existing `planNeedsRefresh` handling suppresses the current web timetable and clears native days when API preferences require regeneration. This was a code-path review, not a new staging database acceptance run. Found a separate traveler-visible contradiction: native restaurant cards hardcoded “1–2 hours,” including breakfasts allocated 45 minutes by the proposed schedule.

Native normalization now derives meal duration labels only from validated matching meal events and explicitly labels them “planned.” Missing, stale or conflicting proposals produce “Duration not set.” Labels are rebuilt on cache reload so previous timing assumptions do not survive invalidation. Native trip details render those normalized activities, keeping the cards and timing panel consistent. No restaurant service duration is inferred from the policy.

The complete native suite passed 676 tests across 67 suites, and workspace checks passed. Extended normalization assertions cover the 45-minute breakfast, cache preservation, date edits, absent/stale/conflicting proposals and untimed plans; the final focused suite passed all eight tests. No paid model calls; latest reconciled total remains $2.19/$20. Physical-device and broader full-flow acceptance remain outstanding.

### Full development replay and rejected dining-aware ranking (2026-10-31)

Replayed all 16 current development briefs through the current compiler and reviewed venue-closure exclusions, using frozen upstream inventories. The input manifest and hashes are recorded in `artifacts/uat/compiler-development-audit-20261031/report.json`; each separate receipt records compiler/evaluator implementation hashes and mapped output. Inputs comprise the 12 meal-boundary traces, two fresh candidate traces and two infant/multi-room traces. All 16 pass structural contracts, with 127 visits and 168 meals in total. There remain 43 compiler distant-meal warnings and 14 unmatched suggested highlights. These counts do not measure confirmed street routes, hotel eligibility, availability or whole-trip usefulness. Existing hotel choices were frozen. No holdouts or paid calls were used.

Tested an experimental beam-ranking penalty for meal boundaries whose nearest compatible supplied restaurant exceeds 3 km. The candidate uses the same generated coordinates, caps each boundary penalty and caches daily calculations. On the same 16 inputs, distant-meal warnings fall from 43 to 38, with unchanged aggregate visit/meal counts and unmatched-highlight counts. Structural contracts still pass and neither run reports explicit rest-timing conflicts. However, Reykjavík worsens from five to six distant-meal warnings. Tokyo removes three visits—including SunnyHills by Kengo Kuma and Daikanyama T-Site/Hillside Terrace—in favor of food/history options despite the brief's architecture interest. Queenstown also exchanges a winery lunch for a restaurant tasting. Equal counts and highlight-name matches fail to capture these personalization changes.

Rejected and reverted the candidate. Its exact patch, before/after receipts, selection differences, source hashes and rejection assessment are preserved privately under `artifacts/uat/compiler-dining-rank-20261031/`. A five-warning aggregate improvement is insufficient evidence of a better agentic experience when individual cases and interest coverage can regress. The next optimization needs an independently reviewed interest-coverage comparison and/or fixed-selection reordering before changing visit selection, alongside sourced dining supply. No production code change or additional AI spend; latest reconciled total remains $2.19/$20.

### Fixed-selection geography opportunity search (2026-10-31)

Added the offline `refine-fixed-visits.ts INPUT_PATH_ARRAY_JSON NEW_OUTPUT` evaluation tool. It only exchanges already-selected visits with equal supplied durations within the same time-of-day slot. Thus selected identities, daily visit counts, per-slot duration sequences and meal assignments remain unchanged. Explicit locks and caller-supplied date exclusions prevent moves; the CLI applies reviewed closure fixtures. Each changed day must have known supplied coordinates and cannot worsen its distant-meal count, meal-boundary distance or visit-to-visit distance. A bounded deterministic search accepts only a measurable meal-distance reduction. It returns placement proposals rather than saved days, avoiding stale timing metadata or narrative reuse. These are offline experiments, not app edits or an authoritative route optimizer.

Ran all 16 baseline development receipts with no model calls. Only Marrakech has an accepted move: reverse two equal-duration morning visits on day four. Supplied straight-line meal-boundary distance decreases by approximately 0.162 km and visit-to-visit distance by 0.219 km. The other 15 cases have no accepted move under these constraints. All 43 distant-meal warnings remain. This demonstrates that this restricted ordering search does not resolve the current meal coverage problem; it does not prove no better arrangement exists. The original selection-changing experiment remains rejected.

Private input manifest and hashed final report: `artifacts/uat/fixed-visit-refinement-20261031/`. Six regressions cover immutable input/identity preservation, locks, closure exclusions, duration/time-slot preservation, unknown geography, individual-day regression refusal, ambiguous IDs and bounded search. All 131 script tests pass, workspace task checks pass, and the final scripts type check passes. No production scheduling integration or additional AI spend; latest reconciled total remains $2.19/$20. Next work should prioritize sourced nearby dining supply and independently reviewed interest coverage rather than further optimizing the existing distance proxy alone.

### Source-backed Singapore breakfast alternative (2026-10-31)

Reviewed nearby dining supply for the infant/two-room Singapore plan's first breakfast. The [park directory](https://sbg.nparks.gov.sg/visit/dine---shopping/) and [Bloomhouse operator page](https://littlefarmscafe.com/pages/the-bloomhouse-by-little-farms) agree on a Ginger Garden location and daily 07:30–20:00 opening. The operator's linked food menu has a breakfast section available until 14:00, but does not separately specify breakfast service start. Its children's menu covers ages 12 and below; that does not establish infant seating or suitable infant food. Menu prices exclude prevailing GST and service charge, so no party total was inferred.

Added the exact reviewed Bloomhouse branch/address to the existing address-evidence benchmark. A regression confirms that matching this address leaves meal service, future availability and route feasibility unverified. The operator's embedded map identifies Ginger Garden, not a verified restaurant entrance; its viewport coordinates were deliberately not inserted as restaurant coordinates. January availability, stroller/step-free access and the actual walk remain unresolved. This is a sourced alternative for review, not an approved automatic replacement or a claimed reduction in the 43 distant-meal warnings.

Private evidence under `artifacts/uat/singapore-dining-source-review-20261031/` contains the bounded retrieved operator/park HTML, food and children's PDFs, source URLs, final URLs, content hashes and structured review. All four sources were retrieved successfully. All 35 agentic-evaluator tests and scripts type checking pass. No model call or additional spend; latest reconciled total remains $2.19/$20. Product generation and saved itineraries remain unchanged. Next: represent partially supported dining alternatives in the experimental flow without inventing coordinates, ratings or suitability, and validate their display before using them as replacements.

### Represent partial dining evidence without factual placeholders (2026-10-31)

Made dining price level, rating, review count and coordinates optional in the shared result type; restaurant display types now accept an absent price level too. A source-reviewed name/address can therefore enter mapping without fabricated numeric fields or the `(0, 0)` sentinel. The bridge also omits a price band when `priceStatus` explicitly says unknown. Existing known values remain supported. Model prompts and generated-object schemas are unchanged: this prepares the source-backed candidate path rather than claiming live generation now retrieves or verifies restaurant facts.

Added a typed Bloomhouse candidate regression with no rating, review count, price band or coordinates. The actual bridge preserves its address and cautionary description; server rendering displays “Price unknown” without stars or dollar-band claims. A separate native normalization/cache test preserves absent ratings and prices and the instruction to confirm service/access. An initial cross-app test import pulled native timer declarations into the web type-check; split the platform tests to keep their type environments isolated. Neither test is an authenticated persistence or physical-device acceptance run.

All 1,318 web tests and 132 script tests passed. After separating the platform assertions, the final focused web tests (2), native normalization suite (9) and workspace checks pass. No paid calls, production deployment or automatic dining replacement; latest reconciled spend remains $2.19/$20. Source provenance, review alternatives and the remaining dining gaps still need integration and end-to-end acceptance.

### Staging dining review notes with readable source links (2026-10-31)

Connected the reviewed Bloomhouse lead to the existing staging-only compiled/narrated flow. `appendReviewedDiningOptions` adds a planning note only for a matching destination, exact reviewed visit anchor and compatible meal gap. It requires a valid review window and HTTPS sources without credentials, skips separated-anchor gaps, and does not add a lead when local compatible supply already covers the meal. The fixture review deadline is editorial, not a claim about the venue's future opening. This small manually reviewed catalog is not automatic source discovery or a general recommendation service.

The note states what the source supports, asks the traveler to check service time/access/the walk, shows the source review date, and explicitly says the alternative is not scheduled. The existing traveler-confirmation panel remains separate. No restaurant, visit, date, duration or timing proposal is replaced. Notes survive narration and the saved bridge. Web tips now use a neutral “Before you go” presentation with compact clickable HTTPS source links; unsupported URL schemes and credential-bearing links remain plain text. Native receives the existing plain-text note; native source-link interaction and physical layout remain unverified.

A frozen Singapore infant/two-room replay adds exactly one breakfast review option while preserving all non-tip day fields byte-for-byte. The note survives the bridge, native normalization and serialized cache reload, and structural contracts pass. Hashes and both pre-copy-edit/final receipts are preserved in `artifacts/uat/dining-review-integration-20261031/`. Live-run source hashes now include the review module, coverage analyzer and source fixture. No paid generation was used.

All 1,333 web tests passed. Final focused tests (29), desktop/mobile Playwright checks (2) and workspace checks pass. Reviewed both browser screenshots, shortened the original verbose note and removed the old alarm-colored tips styling. No authenticated persistence or physical-device acceptance is claimed. The 43 distant-meal warnings remain unresolved; these are review options, not verified replacements. Latest reconciled AI spend remains $2.19/$20, with production generation defaults unchanged.

### Fresh difficult-case batch and explicit contract failure exit (2026-10-31)

Ran four fresh full-chain staging cases at committed source `57370fc`, with low upstream thinking, minimal compiled narration, vendor credentials removed and a $0.50 batch stop threshold. All 20 steps completed with known usage and no fallbacks. Estimated combined token cost was $0.118824; the dedicated Gateway budget reconciles at **$2.31/$20**. These are fresh trials against earlier examples, not a repeated same-source reliability estimate or independent traveler acceptance. No reserved holdouts were used, and no second paid batch was started after the failures were identified.

| Brief | Serial agent time | Estimated token cost | Structural result |
| --- | ---: | ---: | --- |
| Singapore infant/two rooms | 38.706 s | $0.0256615 | Fails: midday-rest conflicts on days 1 and 2 |
| Tokyo solo/budget | 40.333 s | $0.0266045 | Passes contracts; four meal-distance warnings and an unsupported event candidate |
| New York allergy | 45.576 s | $0.030191 | Passes contracts; one meal-distance warning; allergy suitability still unverified |
| Queenstown regional | 50.416 s | $0.036367 | Passes contracts; meal-distance and possible duplicate-dinner warnings |

Singapore's orchestrator preserved the daily rest request but chose moderate pace. The compiler scheduled two morning visits totaling 210 minutes on each failing day; breakfast and buffers push each sequence 15 minutes beyond the morning window. Rest feasibility is checked after selection, so the run exposes the need to incorporate the existing timing policy during selection rather than merely flagging the finished draft. The three-day plan has nine visits and nine meals; it is not accepted just because day coverage succeeds.

Tokyo schedules “The Takenaka Carpentry Tools Museum Exhibition (Check Local Schedules)” at a generated Tokyo Station Gallery-area address. Its own description says the permanent museum is in Kobe and vaguely refers to satellite exhibitions. The [museum's visitor information](https://dougukan.jp/information) places the permanent museum in Kobe; the [official Tokyo exhibition page](https://plantsandcrafts.dougukan.jp/en/tokyo/) found during review describes July–September 2025 at the National Museum of Nature and Science in Ueno. Those sources do not substantiate the proposed January 2027 event/location. This is an unsupported candidate needing event-specific evidence, not proof that no other exhibition can exist. Structural pass does not detect this quality failure.

The run also exposed an acceptance-reporting gap: the comparison report's `ok` and exit status reflected completion under the spend threshold even when saved trace contracts failed. Added a report adapter that records expected cases, failed contracts and unrun cases explicitly. Live reports now separate `executionOk` from combined `ok`, always leave `qualityAccepted: false`, and exit 4 for contract failures/missing results. Billing/spend aborts retain exit 3 precedence. Duplicate/unexpected case evaluations are rejected. All expected cases remain in the denominator.

Private original traces/reports are preserved under `artifacts/uat/repeatability-20261031-round1/`. `contract-regraded.json` applies the new reporting logic without paid calls: execution succeeds, combined `ok` is false, three of four contracts pass, and traveler quality remains unaccepted. Source review and file/grader hashes are recorded separately. All 137 script tests, workspace checks and final scripts type checking pass. GitHub CI run 41263470037 succeeded for the pre-change head; full release/build verification was skipped, not passed. Next: make daily-rest timing feasibility constrain the compiler's selection, then re-evaluate this failing frozen inventory and the full development set before another paid repeat.


### Enforce provisional rest feasibility during selection (2026-10-31)

The experimental compiler now checks visit combinations against the existing proposed rest/meal/buffer policy during beam selection. It reserves compatible supplied meals, caches timing checks by ordered slot durations, and removes individually impossible visits from coverage reservations. Deferred visits retain their supplied durations and receive a review explanation; a lack of feasible inventory remains a supply failure. This is provisional scheduling, not verified opening hours, routes or hotel-return feasibility. Production generation defaults remain unchanged.

Zero-call replay of the 16 frozen development inventories plus the four fresh inventories passes all 20 structural contracts. The previous 16 selections and three other fresh selections are unchanged. Fresh Singapore removes both rest conflicts and moves from nine to eight visits while retaining nine meals. However, selection also changes: the river cruise moves to day 1, Malay Heritage Centre moves to day 2, and the aquarium enters day 3; the civic walk and Fort Canning leave the plan. Singapore Botanic Gardens remains unfulfilled. Day 3 now has two meal-distance warnings on unverified coordinates, versus none previously. This is a hard-constraint improvement with a geography tradeoff, **not traveler-quality acceptance or production readiness**. Nearby dining and attraction evidence still require work.

Private replay inputs, hashes, per-case before/after selections and warnings are recorded under `artifacts/uat/rest-selection-20261031/`. Four regression tests cover combination feasibility, impossible-visit coverage reservation, insufficient supply and negated requests; all 21 compiler tests and all 1,337 web tests pass. Workspace checks pass with existing lint warnings. No additional paid calls; reconciled spend remains $2.31/$20.


### Keep explicitly speculative events out of dated experimental plans (2026-10-31)

Added a narrow title screen for events explicitly marked “check local schedules”, “dates TBC”, “if available/running/scheduled”, or “subject to schedule/confirmation”. These candidates remain review leads with an organizer/date/venue confirmation note rather than being scheduled. The screen does not ban institutions, infer availability from an unflagged title, or verify normal performances. Production generation defaults are unchanged. The evaluation separately warns when selected titles identify concerts, performances, festivals or exhibitions: these need date and venue evidence even if generated wording sounds confident. Warnings do not prove nonexistence and do not change structural pass into quality acceptance. English title patterns are deliberately limited; paraphrases, other languages and misleading descriptions remain uncovered.

The same 20 frozen inventories still pass all structural contracts. Only fresh Tokyo changes selection: the unsupported Takenaka exhibition is absent, nine visits remain, and meal-distance warnings decrease from four to three. Kyu-Asakura moves to day 1; Meiji Jingu and Yebisu Garden Place leave the selected plan; Imperial Palace East Garden Walking Tour, Yanaka Ginza and Asakusa Cultural and Tourist Information Center enter day 3. Those replacements have not received independent venue/date/route validation. This is not a traveler-quality win claim merely because the warning count falls. The wider evidence warning also identifies outstanding event review in both New York inventories and the earlier Singapore-family inventory.

Private comparison receipts are in `artifacts/uat/event-review-20261031/`; `regraded.json` preserves before/after evaluations under the new grader with its source hash. Original artifacts remain untouched. Live and replay source hashes now include the screening module; live runners also include the contract grader. All 1,349 web tests and 138 scripts tests pass, workspace checks pass with existing warnings, and final scripts type checking passes. No paid model calls; spend remains $2.31/$20. Current production acceptance remains incomplete, including event evidence, dining routes, independent usefulness review, repeatability and physical-device acceptance.


### Expand authored case coverage and align preflight selection (2026-10-31)

The catalog now contains 40 development briefs and 20 reserved holdouts. Added 24 development and 14 holdout requests covering leap day, month boundaries, DST and destination-local dates; same-name cities; island/transit constraints; arrival/departure and late-start limits; infant and multi-room parties; celiac and multiple allergies; design/music interests; longer stays; negated rests and conflicting pace demands. The added fixture records explicit review checks and `reviewStatus: unreviewed` for each case. These are synthetic authored requests, not reviewed reference itineraries, verified venue facts or evidence of successful behavior. Holdout model outputs have not been generated or used for tuning. Independent holdout review remains required.

Several new requests deliberately exceed current scheduling capabilities, including arrival/departure windows, working-hour exclusions and impossible pace demands. Keep them in the denominator as unrun until evaluated; a structural pass alone cannot establish that these instructions were honored. Existing deterministic date/party checks apply, but the new case-specific review checks still need independent execution and calibrated grading. Supply faults, revision sequences and malicious retrieved content require separate harness scenarios; this brief expansion does not claim those are covered.

Found and fixed a preflight discrepancy: `--dry-run` and `--mock` previously ignored suite, brief and configuration selections. Preflight and live now share selection, compiled-candidate naming/thinking settings and cap validation. Unknown/duplicate case IDs, missing values, incompatible compiled configuration and invalid caps fail before comparison. Zero-call preflight enumerates exactly 40 development and 20 holdout planned rows, with no case counted as passed and $0 spend. Reports are private under `artifacts/uat/expanded-suite-20261031/`. Live source hashes include the catalog fixture and shared selector. All 141 script tests, scripts type checking and workspace checks pass (existing lint warnings remain). No additional live calls; reconciled spend remains $2.31/$20.


### Fresh leap-day and arrival trials; reference availability grading (2026-10-31)

Ran two fresh compiled/minimal full-chain development cases at committed source `f53059a` using the dedicated staging key and a $0.25 batch stop threshold. Both completed all five steps without fallback. London preserves February 28, February 29 and March 1, 2028 through the saved itinerary, with eight visits, nine meals and one meal-distance warning. Serial agent time was 47.405 seconds. Madrid takes 53.854 seconds and preserves the arrival instruction but schedules Prado Museum in the morning, Thyssen-Bornemisza in the afternoon, breakfast and lunch on the first day despite arrival at 18:00. Both originally passed structural contracts. These serial durations are not app latency. Combined estimated token cost is $0.0696305; the provider budget display reconciles at $2.38/$20 after initially showing $2.36 while billing caught up. Rounded provider spend is distinct from token estimates.

Added authored `expectedDayAvailability` reference windows for six arrival/departure/late-start cases. These are evaluation-only expectations and are not injected into the planner as a hidden extra input. The grader validates dates/bounds and rejects visits or meals in day parts wholly outside the reference window (morning before noon, afternoon noon–18:00, evening thereafter). An overlapping day part without valid structured timing produces an explicit clock-time uncertainty warning, not a feasibility claim. Valid provisional timing is checked by event start/end; stale timing cannot satisfy the reference. An empty travel day is allowed only by an explicit case-specific reference, while date coverage and other checks remain required. This is not a general natural-language constraint parser or proof of routes/hours.

Offline regrading preserves the paid receipts, checks the original brief is unchanged apart from the added reference, and records grader/fixture hashes. London still passes; Madrid now fails both out-of-window day parts and keeps evening timing unresolved. Private evidence is under `artifacts/uat/expanded-live-20261031/`, including `availability-regraded.json`. Production scheduling is unchanged and the Madrid bug is not yet fixed. Next: carry explicit traveler availability into the experimental scheduler and replay this saved inventory before any further paid trial. All 147 scripts tests, scripts type checking and workspace checks pass (existing lint warnings remain). Holdout outputs remain unused; traveler quality and production acceptance remain incomplete.


### Constrain experimental scheduling by explicit traveler availability (2026-10-31)

Added a deterministic interpreter over preserved traveler mobility fields for explicit first-day arrival, final-day departure and daily “no starts before” local-clock instructions. It accepts bounded 24-hour and am/pm forms; ambiguous times, negation, working-hour instructions and other unsupported wording remain review issues rather than guessed bounds. Intersections preserve conflicting requests instead of silently choosing one. This is a limited English grammar, not general preference understanding or an extraction model. It does not read evaluation reference windows or venue text.

The experimental compiler now applies those windows during visit selection, reserves supplied meals plus provisional 30-minute buffers within each day part, and excludes meals outside available periods. Coverage reservations account for which remaining visits can fit later days. Day-part planning envelopes remain provisional (08:00–12:00, 12:00–18:00, 18:00–22:00); arrival does not establish airport/station transfer duration or venue opening hours. Notes expose the interpreted local bounds and ask for exact-time/transfer review. The midday-rest proposal is also bounded by traveler availability: a rest before an evening arrival now produces an unresolved conflict with no partial timetable. Unsupported or conflicting cases are not claimed as solved.

The final zero-call replay passes structural and authored availability checks for all 22 saved inventories. Only Madrid changes visit selection. Its first-day morning and afternoon now have no visits or meals; evening holds Plaza Mayor Walking Tour, San Ginés Chocolatería and dinner. Prado and Thyssen-Bornemisza move to day 2. Total inventory allocation moves from nine visits/nine meals to eight visits/seven meals; omitted breakfast/lunch are intentional for the arrival day. Other selections also change as recorded in the private receipts, so this is not a minimal-move edit guarantee. Exact evening clock times, route/transfer feasibility and venue evidence remain unverified; the grader retains that timing warning. All other 21 inventories retain their selected visits. Production generation defaults remain unchanged.

Private receipts, source hashes, before/after selections, review notes and final grading are under `artifacts/uat/arrival-selection-20261031/` (`final-report.json` plus `final/`). Tests cover clock forms, noon, ambiguous/negated wording, contradictions, coverage preservation, meal/buffer capacity and arrival/rest conflicts. All 1,367 web tests and workspace checks pass with existing lint warnings. No paid model calls; reconciled spend remains $2.38/$20. General availability extraction, exact editable schedules, source-backed feasibility, fresh repeatability, independent review and end-to-end product acceptance remain open.


### Render the saved arrival plan and expose its constraint early (2026-10-31)

Rendered the actual final mapped Madrid replay through `ItineraryDay` in the isolated desktop and Pixel 7 browser fixtures. Morning/afternoon visits and meals remain absent, the evening allocation survives, and no overflow or page errors occur. Visual review found the arrival limit buried below the itinerary and a truncated hotel name. Web now moves the existing canonical availability note into a “Your available hours” region above visits, retaining its exact provisional/transfer caveats and removing the duplicate from general tips. This is display ordering of an existing note, not a new validation of clock times. Hotel names wrap; mobile price and amenity lines have separate room.

The local browser harness accepts an optional `FAROWAY_E2E_ARRIVAL_TRACE` path for a private mapped replay without embedding it in the committed bundle. Its ordinary CI case uses a clearly synthetic fixture. Both real-replay viewport checks pass; six synthetic arrival/timing/dining browser regression checks pass. Final screenshots were inspected and retained privately with input/image hashes under `artifacts/uat/arrival-display-20261031/`. Existing web display tests pass (41). Native normalization/cache tests pass (10); the actual mapped Madrid input also round-trips through native normalization and JSON cache with exactly three evening items and the original availability note. That receipt is `artifacts/uat/arrival-selection-20261031/native-display.json`.

This is component/browser and native-data-path verification, not an authenticated save/reload or physical Android acceptance run. Native presentation has not been visually verified here. No new model calls or production generation changes; spend remains $2.38/$20. Broader grounded feasibility, independent quality review and end-to-end acceptance remain outstanding.


### Extract published event facts without a model call (2026-10-31)

Reviewing the fresh New York inventory exposed a generic “Performance at Carnegie Hall” scheduled on January 12, 2027, described as a classical performance with a generated 150-minute duration. The organizer publishes [On the Town in Concert on January 11](https://oslmusic.org/calendar/2027/01/11/on-the-town-in-concert-7pm/) and [January 12](https://oslmusic.org/calendar/2027/01/12/on-the-town-in-concert-2-7pm/), at 19:00 in Stern Auditorium/Perelman Stage. This supports a named musical-in-concert listing, not the generated description, duration, ticket availability or suitability. Ticketing links could not be inspected through the source reader; no purchase or reservation was attempted.

Built `extract-published-events.ts`, an offline, zero-model-call extractor for approved local page receipts. It checks source hashes and explicit approved HTTPS URLs, bounds page size/script count/structure traversal, parses supported Event JSON-LD types without executing scripts, keeps destination-local date/time and source provenance, and refuses invalid or timezone-free starts. Cancellation/postponement status is preserved when published. Duplicate nodes are flagged rather than counted as corroboration. Offers do not become prices or availability claims. Repeated unclosed script tags are scanned forward without repeated whole-page regex backtracking. Missing or malformed data remains visible; prior output is never overwritten. The caller's approval manifest does not itself prove source ownership, and the result explicitly retains that limitation.

Both official pages yield the expected named event, venue and local start. Both also publish an end equal to the start, so the extractor deliberately leaves duration unknown rather than generating a zero-minute event. No supplied itinerary is changed and no source-grounded replacement is claimed. A verified duration or an explicit traveler-reviewed duration assumption is still needed before this event can enter the duration-based scheduler; semantic identity, freshness and ticket checks remain separate. This extraction does not resolve all generic venue or event claims.

Private HTML, manifests, source/extractor hashes, extracted facts and the visible-page comparison are under `artifacts/uat/event-source-extraction-20261031/`. Observation timestamps are actual UTC retrieval times (November 1 UTC, October 31 locally). Eight new tests cover local dates, invalid bounds, cancellation, zero-duration metadata, duplicate identity, malformed/instruction-like content, bounded traversal, source-hash mismatch and receipt preservation. All 155 script tests and scripts type checking pass. No paid AI calls; reconciled spend remains $2.38/$20. Next: use these scoped published fields in a reviewable event candidate path without carrying over fabricated duration or ticket claims.
