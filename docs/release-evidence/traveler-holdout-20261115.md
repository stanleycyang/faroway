# Traveler holdout — 15 November 2026

Offline only. `bun --no-env-file scripts/uat/traveler-holdout-eval.ts` runs the
schedule compiler, dining repair, aggregator mapping, and recorded supplier
decisions. It does not call a model or a paid API.
`live_model_quality_measured` stays false. The saved-plan structure check and
`scripts/planning-quality-eval.py` are unchanged and are not this gate.

The same command is in `scripts/verify-release-local.sh` and in the Full
Release Verification job, next to the existing rubric calibration.

## Scores

Measured on `70c24cf` before the planner changes, then again after them.

|                             | Before | After |
| --------------------------- | -----: | ----: |
| Planner cases accepted      |  3 / 9 | 9 / 9 |
| Negative controls detected  |  3 / 3 | 4 / 4 |
| Recorded supplier decisions |  1 / 1 | 1 / 1 |
| Suite accepted              |     no |   yes |

Cases that already passed: Mexico City family screening, Singapore evening
arrival, and the Lisbon breakfast repair. Controls for a fallback day, a
timing conflict, and a mislabeled day were detected both times. The current
suite also rejects an itinerary that drops a trailing trip day.

Failures before the fixes:

- Tokyo: unverified gluten-free breakfast claim, catalog walk without a
  catalog disclosure, and an unsourced guided tour scheduled.
- Lisbon: unverified peanut-free dinner claim and a step-free/wheelchair
  description left on the garden.
- Edinburgh: breakfast missing and the Royal Mile visit dropped. The original
  points were about 4.5 km apart, so the meal screen kept only the visit next
  to lunch and dinner. The fixture now uses a hop of about 2.4 km with meals
  between the stops. That is still beyond the 2 km planning buffer, and both
  visits can be scheduled. The compiler was not changed to force a 4.5 km pair
  onto one day.
- Oaxaca: unverified vegan claim kept on the lunch.
- Kyoto: the museum's last entry was already excluded, but breakfast was
  treated as available because the broad morning slot still had an hour after
  11:00. That conflict dropped the walk. Meal availability now uses the
  breakfast, lunch, and dinner windows.
- Aggregator: the third day stayed "Day 1 in Tokyo" on the start date.
  Transport is still decided from the model's original date, so a misdated
  first day does not receive the outbound offer.

## What the suite refuses to count

A day titled "Day N in City" with a "Suggested visits" or "Backup draft"
summary still fails. Renaming that prose is not a pass. The suite also fails
an invented `guided_tour` without a reviewed id or affiliate partner, a
catalog-only product whose tip does not say "catalog suggestion only", a
dietary or access claim left on the scheduled stop, a hop over 2 km that is
not disclosed with the distance and the 30-minute planning buffer, and a
required stop or meal that was dropped.

## Still not closed

This run does not measure a live model, supplier photos, handoff, commission,
latency, or cost. It does not use Viator, GetYourGuide, Places, or LiteAPI
credentials. Staging and production booking stay out of this change. Physical
device confirmation of the Android font-scale fix is separate from the unit
test.
