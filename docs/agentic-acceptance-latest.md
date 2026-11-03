# Latest agentic acceptance evidence

Overall status: **not accepted for production**. PR 55 remains draft.

## Full fixed-build round

Twelve runs (six synthetic briefs, twice each) on `86b178f708a2dcb3a4857f126a7d980dbc533f34`.
All requests completed with matching final saved/streamed days and no receipt-integrity failures.
Warm median terminal latency: **27.735 seconds**; cold first case: **44.401 seconds**.
Round billed delta: **$0.34738750**; cumulative spend at round end: **$8.14161835**.
Local development latency is not hosted production latency.

| Case | Terminal latency | Verdict | Findings |
|---|---:|---|---|
| copenhagen-1 | 19.704 s | Rejected | Grød (Torvehallerne) and Torvehallerne KBH share the food-market complex; distinct visit intent is unresolved. Continuous step-free paths, resting opportunities and full meal/travel timing remain unverified. |
| copenhagen-2 | 29.665 s | Rejected | Tivoli Gardens Stroll on January 11 falls outside the published garden season (Christmas ends January 3; next Easter begins March 19). Calling it a stroll does not establish access inside the gardens. Amalienborg ceremony timing and continuous step-free routing remain unverified. The next patch defers scoped January garden visits. |
| edinburgh-1 | 24.546 s | Rejected | Edinburgh Castle (Route) does not establish a continuous 65 cm wheelchair route or no-lifting itinerary. Parliament, galleries and Fruitmarket also need entrance, clearance, toilet and inter-venue route evidence. |
| edinburgh-2 | 22.081 s | Rejected | Earlier named gallery/café errors are absent. Cathedral and Museum on the Mound admission and continuous wheelchair routes/toilets remain unverified. Visit-minute limits alone do not prove accessibility. |
| interlaken-1 | 31.714 s | Rejected | Jungfraujoch remains a 240-minute morning block without outbound/return transfer accounting. Dated sampled travel requires about 97/99 minutes each way, not included in that visit block. Novel winter walking, chalet experience, spa admission and beginner suitability need operator evidence and conditions. |
| interlaken-2 | 40.296 s | Rejected | Jungfraujoch remains a 240-minute morning block without complete transfers/meals. Magic Park appears under two names on separate days without established distinct intent. Männlichen, winter cruise and generic winter routes require dated operational and beginner-suitability evidence. |
| lisbon-1 | 44.401 s | Rejected | Known prior museum closures are absent. Lisbon Traditional Food Tour is generic: provider, meeting point and actual availability are unresolved. Tuesday has only one saved meal. Complete source and transport/meal timing remain unverified. |
| lisbon-2 | 27.735 s | Rejected | Prior named failures are absent. Carmo and Castelo are novel candidates requiring dated admission and exact identity review; the full route and meal timeline remain unverified. |
| melbourne-1 | 34.497 s | Rejected | All saved visits are evening exterior walks/viewing, within the visit-minute limit. This respects the broad business-hours constraint but does not establish exact dinner times, venue identity, route duration or safe/available access. |
| melbourne-2 | 28.598 s | Rejected | All saved visits are evening exterior walks/viewing, within the visit-minute limit. Parliament exterior viewing is distinct from building admission. Exact route/dinner timing and complete source coverage remain unresolved. |
| new-york-1 | 27.274 s | Rejected | Known Jewish Museum closed-day failure is absent: it is now Monday afternoon. Neue Galerie Monday morning and dated exhibition scope require review. Restaurant ingredient/cross-contact confirmation and complete meal/transport timing remain unresolved. |
| new-york-2 | 26.588 s | Rejected | Known Historical Society morning failure is absent. Library Tour provider/admission scope and dated museum access remain unverified. Severe peanut-allergy restaurant handling requires direct confirmation. |

Source-ledger rows distinguish known contradictions, compatible reviewed hours and unknown evidence.
Every case remains rejected; unknown evidence is not an acceptance pass. The ledger is retrospective,
records its catalog hash, and may use reviews added after the candidate was run. It does not certify
allergy handling, tickets, exact transfers or continuous wheelchair access.

All 44 itinerary days were captured on Android QA v17 in the emulator, three viewport samples per day.
This is not exhaustive card scrolling or physical Android validation. The per-case runner inherited a
stale build label; the root manifest and fixed worktree identify the actual candidate. Later runners
read the build directly from their manifest. Original receipts are retained unchanged.

Evidence: `artifacts/uat/six-scenario-source-context-20261103/report.md`, per-case `receipt-audit.json`,
`source-ledger.json`, `quality-review.json` and `android-v17-all-days.json`.

## Source-attribution repair

Two Copenhagen runs on `8422b7a9116e5a82f5eea1e9e9d373c9d58d3c04` completed in 43.720 / 25.240 seconds.
Tivoli January garden access was absent. Source URLs/retrieval dates for SMK and Amalienborg survived
saved output and were visually confirmed on Android. All six itinerary days were captured.
Cumulative recorded spend reached **$8.19825635**. CI passed; full release verification was skipped.

Overall quality still failed: an evening King's Garden visit conflicted with the government's January
17:00 closing time, and a three-hour aquarium morning visit could not fit after 10:00 opening.
The next repair (`a45c0d0`) explicitly scopes reviewed garden hours, retaining ordinary-entry-only
behavior for existing museum records, and adds aquarium ordinary hours. Retrospective audit of the
failed receipt detects both contradictions. Local validation: **1,698 web tests, 227 script tests,
workspace type/lint/format checks passed**, with nine existing lint warnings.

Sources: [King's Garden government operator](https://slks.dk/omraader/slotte-og-ejendomme/slotte-og-anlaeg/rosenborg-slot-og-kongens-have),
[aquarium ordinary hours](https://denblaaplanet.dk/en/visit-us/prices-and-opening-hours/).
These hours do not establish a working lift or continuous accessible route.

Evidence: `artifacts/uat/copenhagen-source-attribution-20261103/report.md`.

## Remaining release gates

- Runtime source coverage and replacement discovery for novel candidates, including exact branch and visit scope.
- Continuous accessible routes, entrances, toilets and relevant clearances; direct restaurant allergy confirmation.
- Complete admission/visit/meal/transit timeline and duplicate-venue intent review.
- Full truthful photo coverage and reduced repetitive caution text.
- Physical Android evidence and one final accepted twelve-run build, followed by complete release verification.

Detailed deliverables and acceptance criteria are in [agentic-acceptance-remediation.md](agentic-acceptance-remediation.md).


## Outdoor-hours rerun

Two Copenhagen runs on `a45c0d0` completed in **45.210 / 23.160 seconds** with
matching saved/streamed days. Aquarium visits moved to afternoon; King's Garden
moved to morning in the first run and was absent in the second. Tivoli January
garden admission is absent in both. Five of five activities in the first run and
three of five in the second retain runtime reviewed source links. No recognized
hours contradictions remain in these two receipts; overall quality is still rejected
because source, access and full-route evidence are incomplete.

Recorded cumulative spend: **$8.24093635 of $20**. Evidence:
`artifacts/uat/copenhagen-outdoor-hours-20261103/report.md`.

Billing reconciliation after both terminal receipts: cumulative spend **$8.26060035**, remaining **$11.73939965**. An additional $0.01966400 arrived after the per-case receipt; individual-case deltas are not treated as final attribution.

All six days in the outdoor-hours rerun were captured on Android QA v17. Garden and
aquarium source links were visually verified. [Code CI passed](https://github.com/stanleycyang/faroway/actions/runs/41584550494);
full release verification remains skipped while the PR is draft.
