# Itinerary quality and affiliate evals

Offline only. The command does not call a model, Viator, GetYourGuide, LiteAPI,
Tavily, or any other paid API. It asks enrichment for the deterministic prompts
even when `TAVILY_API_KEY` is already set. `--no-env-file` does not clear
inherited keys, so the eval does not rely on that flag to stay offline.

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

The suite fails if any of these is accepted: generic filler, a dietary or access claim, a reserved-table claim, an http affiliate URL, a Viator link for a different product, the same product link copied onto several cards, a legacy click row, an invented GetYourGuide partner, a lookalike GetYourGuide host, a longer activity id sharing the expected id as a prefix, or a booking URL on a planning prompt that has no partner. A GetYourGuide deep link must use `getyourguide.com` or a subdomain, and the path must be exactly `/activity-t{id}`.

## Optional live mode

Live mode does not run in CI. It generates one development brief (`rome-single-day`) through the aggregator and grades that output with the release rubric. It does not read the holdout briefs.

```bash
FAROWAY_LIVE_QUALITY_EVAL=1 \
FAROWAY_LIVE_EVAL_BUDGET_USD=2 \
FAROWAY_STAGING_AI_GATEWAY_KEY=... \
bun --no-env-file scripts/uat/generation-quality-eval.ts --live
```

`AI_GATEWAY_API_KEY` is accepted in place of `FAROWAY_STAGING_AI_GATEWAY_KEY`. The budget must be greater than 0 and at most 5. Without the flag, a budget in that range, and one of those keys, the command exits 2 and does not call a model. The call is also refused when the list-price ceiling for 20,000 input tokens and 8,000 output tokens is above the budget, and the aggregator output for that call is limited to 8,000 tokens. If the recorded spend still exceeds the budget, the grade is not accepted. `live_model_quality_measured` stays false until that call returns a grade.

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
| Negative controls    |                            not in this gate |                                        12 / 12 detected |

Traveler holdout on the same tree: 11 / 11 planner cases, 9 / 9 negative controls, recorded supplier decision kept.

The numbers are whatever the script prints. Re-run it after further prompt or ranking edits. The traveler holdout remains a separate gate.
