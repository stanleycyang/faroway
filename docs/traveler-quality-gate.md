# From successful generation to a useful trip

`evaluateSavedPlan` is a saved-plan contract check. Named invented venues can
pass it. Never use its `ok`, a successful workflow, or a green release build as
traveler-quality acceptance. Its report explicitly leaves that acceptance
unevaluated. The richer trace, grounding, routing and reviewed-source evaluators
must be applied to the same candidate's actual saved output, not unrelated
fixtures. See `ai-evaluation-strategy.md` for the full evaluation protocol.

## Implementation priorities

1. **Capture the evidence once.** Retain a redacted receipt connecting the exact
   traveler brief, provider responses, model/fallback events, selected product
   and venue IDs, saved itinerary and displayed result. Respect supplier data
   retention terms. Regrade receipts without paying to regenerate them.
2. **Make unsupported facts visible.** Join selected items to independent source
   records. Report verified, contradicted and unknown separately for identity,
   date availability, location, route duration and requested suitability.
   Unknown critical accessibility or allergy suitability cannot pass as met.
   A generic disclaimer does not repair a contradictory recommendation.
3. **Test the graders before tuning the planner.** Mutate retained cases to add
   a closed venue, impossible transfer, repeated stop, ignored work block,
   unsupported step-free claim, missing supplier response, wrong affiliate ID
   and broken image. The relevant gate must fail or explicitly block acceptance.
   Preserve legitimate sparse arrival days and intentional skipped meals as
   positive controls. Do not reward filling every slot or increasing stop count.
4. **Plan from evidence.** Retrieve relevant inventory first, screen constraints,
   cluster nearby stops, allocate visit and travel time, then let the model
   explain the choices. Repair only failed portions. If suitable supply is
   insufficient, offer fewer honest options or ask a useful question instead
   of fabricating a full day. Distinguish verified supplier inventory from
   unsourced suggestions throughout persistence and rendering.
5. **Measure usefulness independently.** Blind-review baseline and candidate on
   the same frozen briefs and source snapshots. Score fit, pacing, coherence,
   variety and actionable detail with reasons tied to stop IDs. Calibrate any
   model judge against independent human labels; do not let it verify facts
   from generated prose. Use a separate holdout and count unsuccessful runs.
6. **Verify the money path separately.** For briefs requesting bookable
   experiences, require relevant provider-backed items, working photos and
   correctly attributed handoffs in the actual app. Confirm conversions through
   the supplier's supported attribution process. A link or click is not revenue.
   Preserve high-quality free options; commission must not override traveler fit.

Release reports must show contracts, factual grounding, requirement fit,
traveler review, supplier handoff and device rendering as separate outcomes.
Missing evidence is blocked or not evaluated, never silently green. Start with
the real disappointing trips and observed failures before expanding synthetic
coverage. Production readiness requires closing the critical gaps, not adding
more tests that assert the current implementation.

## Runtime failures that must stay visible

Supplier requests can outlive a generic short HTTP timeout while still fitting
inside parallel specialist generation. Viator uses a ten-second deadline
(`ITINERARY_VIATOR_TIMEOUT_MS`, bounded to 1–30 seconds), including body reads,
with no automatic retry. Verify both delayed success and stalled bodies; do not
infer invalid credentials from a client-side timeout.

The default composer deadline is sixty seconds. The sequential orchestration,
parallel specialists and composer budgets total at most 150 seconds before
workflow/persistence overhead. This trades a longer worst-case wait for a chance
to finish a real plan. Interactive generation requires generated composition:
an unrecoverable composer failure must mark generation failed, preserve the
brief and allow retry, without sending an itinerary-ready notification.
Explicit offline fallback callers may still construct a backup draft.
The composition step sets Workflow `maxRetries = 0`; AI SDK `maxRetries = 0`
alone does not prevent Workflow from repeating a paid call. Review both layers
whenever changing error handling, and verify the deployed step configuration.

Retained backup drafts must fail acceptance even when their dates and meal
slots are complete. Preserve observed failure formats as regression fixtures;
renaming fallback prose must not make quality reports green. Relevance scoring
is a selection heuristic, not evidence of venue existence or suitability.
