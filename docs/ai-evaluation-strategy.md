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
