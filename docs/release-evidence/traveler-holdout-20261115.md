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

## Follow-up on this branch

The same offline command was run again after the holdout was widened. It
accepted 11 of 11 planner cases, detected 9 of 9 negative controls, and kept
the recorded supplier decision. `live_model_quality_measured` stays false.

Added planner cases:

- Porto: a museum with a reviewed 10:00–12:00 window is scheduled inside that
  window. A tower whose only window is 10:00–10:30 is left off the day, and
  the draft says it was not scheduled.
- Nara: an about-20 km hop is not presented as a fitting day. The compiler
  marks the day unusable and says it is not a usable plan. The nearer stop
  stays on the day, and the result is not a backup draft.

Added controls, all detected:

- A backup day whose summary no longer starts with "Backup draft:" still fails
  because `provenance` is `backup_draft`.
- A positive price without an affiliate partner fails as an invented price.
- A dinner placed in the morning fails the meal slot.
- A hop over 12 km whose timetable still says it fits fails even when the
  distance is disclosed.
- A timed visit that falls outside its reviewed window fails.

Hops between 2 km and 12 km still have to be disclosed with the distance and
the 30-minute planning buffer. The suite does not treat that disclosure as a
measured route. Edinburgh remains the disclosed short-hop case.

## Still not closed

This run does not measure a live model, supplier photos, handoff, commission,
latency, or cost. It does not use Viator, GetYourGuide, Places, or LiteAPI
credentials. Staging and production booking stay out of this change. Physical
device confirmation of the Android font-scale fix is separate from the unit
test. Paid specialist steps now set workflow `maxRetries` to 0, and the
activity and dining calls overlap under a concurrency cap, but that latency
is measured with mocks, not live suppliers.
