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
