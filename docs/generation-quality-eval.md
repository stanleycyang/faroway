# Itinerary quality and affiliate evals

Offline only. The command does not call a model, Viator, GetYourGuide, LiteAPI,
or any other paid API.

```bash
bun --no-env-file scripts/uat/traveler-holdout-eval.ts
bun --no-env-file scripts/uat/generation-quality-eval.ts
```

Both commands run in the CI test job on pull requests, including this eval
branch, and in `scripts/verify-release-local.sh`. `live_model_quality_measured`
stays false.

## What the generation rubric scores

Each dimension is 1–5. A positive result must be at least 4. The baseline is
the old generic filler ("neighborhood spot", "Dining idea") scored with the
same function, so a regression that restores that copy fails specificity.

| Dimension      | What a 5 requires                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Grounding      | Planning prompts stay labeled as prompts and are not scheduled as venues.                                                |
| Preference fit | The prompt names the requested neighborhood and cuisine and points at saved dietary needs without claiming they are met. |
| Feasibility    | The compiled day fits the timing policy.                                                                                 |
| Specificity    | Copy names a place or a concrete search, includes the destination, and avoids filler labels.                             |
| Diversity      | The prompts are not copies of one another.                                                                               |
| Safety claims  | No dietary, access, or "already booked" claim is stated as fact.                                                         |

The compiled case must select a nearby supplier product over a slightly higher-scored generic stop, and it must leave a far supplier product off the day. That boost is 0.5 points. Highlights, reviewed sources, and distance still outrank it.

## Affiliate readiness

Where a recorded supplier product is a fit, the day includes it. The activity card's booking URL is that product's https deep link, the hotel button is only on the hotel, and a restaurant does not inherit an activity link. The click row uses `affiliate_clicks` columns (`affiliate_partner`, `affiliate_url`, `item_id`), not the old `partner` / `tracking_id` names. GetYourGuide links are omitted when no partner id is configured. They are not given a made-up partner id.

## Negative controls

The suite fails if any of these is accepted: generic filler, a dietary or access claim, a reserved-table claim, an http affiliate URL, a Viator link for a different product, the same product link copied onto several cards, a legacy click row, an invented GetYourGuide partner, or a booking URL on a planning prompt that has no partner.

## Optional live mode

Live mode does not run in CI and does not start a paid call.

```bash
FAROWAY_LIVE_QUALITY_EVAL=1 \
FAROWAY_LIVE_EVAL_BUDGET_USD=2 \
FAROWAY_LIVE_EVAL_TRACE=path/to/recorded-trace.json \
bun --no-env-file scripts/uat/generation-quality-eval.ts --live
```

The budget must be greater than 0 and at most 5. Without the flag, the budget, and a local trace path, the command exits 2. Even when the gate is open, this harness only records that a trace may be graded. It does not call a model or a supplier.

## Before and after

Measured by `generation-quality-eval.ts` on this change. Baseline is the previous filler copy. Current is the planner output the script builds with no network.

|                      |                                    Baseline |                                                 Current |
| -------------------- | ------------------------------------------: | ------------------------------------------------------: |
| Grounding            |                                           3 |                                                       5 |
| Preference fit       |                                           2 |                                                       5 |
| Feasibility          |                                           4 |                                                       5 |
| Specificity          |                                           1 |                                                       5 |
| Diversity            |                                           5 |                                                       5 |
| Safety claims        |                                           5 |                                                       5 |
| Affiliate dimensions |                                  not scored |                                            5 on all six |
| Planner case         | filler could outrank a nearby bookable stop | nearby bookable selected, far bookable left off the day |
| Negative controls    |                            not in this gate |                                        10 / 10 detected |

Traveler holdout on the same tree: 11 / 11 planner cases, 9 / 9 negative controls, recorded supplier decision kept.

The numbers are whatever the script prints. Re-run it after further prompt or ranking edits. The traveler holdout remains a separate gate.
