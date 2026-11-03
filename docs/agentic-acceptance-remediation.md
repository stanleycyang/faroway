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

Last recorded billed total: **$8.26060035 of $20**, remaining **$11.73939965**.
Do source review and offline replay before more live generation. Allocate up to
$4 to targeted repair runs and $4 to the final twelve-run round; retain the
remaining balance for retries and reconciliation. These are spend ceilings, not
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
- D1–D4: scoped source repairs are implemented; universal claim coverage,
  continuous accessible routes and full meal/transit timelines remain unresolved.
- D5: chronological normalization, absent-duration cleanup and seven licensed
  venue images are implemented. Physical-device and full image coverage remain open.
- D6: multiple twelve-run candidates completed, all still rejected on quality.
  Do not reuse baseline successes as final evidence.

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

## Second fixed-build round — 2026-11-03

Candidate `6cd6810150064b587945617a8a09c8db66f2368a` completed all twelve
fresh runs. Android QA v14 SHA-256:
`824a4f7a0456885ea1d4abbbc48a33e6f45fece8e09e4dc517c520e96fd370bf`.
Evidence lives in `artifacts/uat/six-scenario-remediation-20261103/`.
All twelve saved requests/date coverage and final stream-versus-save checks
passed. All twelve cold launches and day-2 selections succeeded on the emulator.
The first round's billed total was $6.27649835 (subject to final ingestion).

Acceptance remains rejected. New failures include winter Monday admission at
Denmark's National Museum, Museum on the Mound on Monday, unresolved canal
boarding, Gemyse's unresolved current identity, Holyroodhouse and the Edinburgh
King's Gallery without dated admission evidence, and renamed/address-varied
Harder Kulm and Lake Brienz recommendations. Interlaken also offered a taxi tour
against the explicit public-transport instruction. These are retained failed
receipts, not silently repaired history.

Follow-up repairs include scoped operator-hours records, deferral of unresolved
identities/admission, and an identity-review path when a reviewed venue name
appears at an unreviewed address. This path does not transfer closure/access
facts to that address. Explicit public-transport requests now exclude named
private motor tours. Reviewed Fruitmarket, Museum of Copenhagen and St. Beatus
museum records supply alternatives; conservative day-part admission may still
leave an alternative unscheduled. A source-backed museum weather alternative is
shown separately rather than counted as another completed activity.

Android v14 visually confirms the Edinburgh skyline and breakfast order. The
allergy warning is now above meals; its full repeated brief was too verbose,
so the follow-up build keeps the warning visible with expandable details.
Newly observed Nyhavn/Federation Square title variants are tied to the same
reviewed address/photo. Full scroll capture and follow-up APK validation remain
in progress. Only the emulator is attached; physical-device evidence is pending.

D1 is a bounded negative-evidence/identity gate, not yet the full claim ledger.
D3 still lacks complete entrance-to-exit and inter-venue route evidence for the
65 cm wheelchair. D4 still lacks verified dated transit times; distance screens
are not route verification. These unresolved gates must remain explicit in the
final packet. No production approval or merge is supported by this checkpoint.


## Consolidated evidence and source repairs — 2026-11-03

Fixed build `1771de6` completed all twelve cases and preserved requested inputs,
calendar coverage and stream/save parity. Warm median terminal latency was
24.211 seconds; the cold first run took 59.455 seconds. Recorded key spend rose
from $6.52461235 to $6.84859735 ($0.32398500). Billing ingestion can shift costs
between adjacent runs. All 44 itinerary days were captured on Android QA v17,
with three scroll samples per day; this is not exhaustive visual/source review.
Offline content retention and reconnect/process restart were visually verified.
Only emulator-5554 was attached. Licensed NMS photo rendering and its credit were
visually confirmed; bundled coverage remains seven venues, not every card.
The full case report is `artifacts/uat/six-scenario-consolidated-20261103/report.md`.

Acceptance remains rejected. The report retains the observed failures rather
than treating a successful API completion as a passing itinerary. Repairs in
`7421a5c` address Amalienborg Monday entry, Morgan Monday entry, Block Arcade
after closing, unresolved Padaria branch addresses, full Palm House access,
Princes Street Gardens winter/access uncertainty, unsupported Brünig thermal
baths, Big Pintenfritz beginner lower-section assumptions, January City Train
operation, and meals counted as sightseeing. Known venue names at unreviewed
addresses now trigger identity review instead of bypassing hours checks.

That candidate completed another twelve runs, with recorded cumulative spend
$7.21370635 of the $20 cap. The additional stream observer was disconnected while
Interlaken generated; a concurrent duplicate POST returned 409 with the original
search ID. Completion and a later POST both retained that same ID. This verifies
client disconnect/idempotent retry, not server-process failure recovery.

The subsequent source audit found MAAT on Tuesday, Writers' Museum stairs for the
wheelchair brief, museum visits too long for their remaining morning opening
window, generic Tenement admission without a dated guided tour, a renamed Brienz
winter boat cruise, a fondue dinner counted as sightseeing and a distant Rigi spa
in an infeasible evening block. The next candidate screens these cases using
reviewed operator evidence. Negative name fragments are permitted only for
review/deferral; they cannot certify facts or rewrite copy. Expired identity
anchors also require review instead of reopening an unverified address.

Dated Swiss transport responses are retained under
`artifacts/uat/remediation-20261103/transport/`: Interlaken Ost–Jungfraujoch on
January 13 takes 97 minutes outbound and 99 minutes on sampled returns;
Interlaken–Kilchberg Lindt on January 16 takes about 146–149 minutes each way.
These are aggregator timetable results, not weather or accessible-boarding
certificates. They expose why visit-only blocks do not establish complete
excursion timing. Lindt and Rigi need a separately budgeted excursion before
being inserted into an Interlaken draft.

Still unresolved: complete source-backed claim coverage for every novel venue,
65 cm wheelchair clearances and continuous inter-venue routes, a complete
meal/travel/admission timeline, generic winter trail identity and beginner
suitability, and physical Android validation. These are not fixed by adding
warnings. Keep PR #55 draft and do not merge for production. The next live
fixed-build rerun must be reported separately from these failed receipts.

## Completed museum-repair round and novel-source fixes — 2026-11-03

All twelve requests on `58079de` completed with matching saved/streamed days and
no receipt integrity failures. Warm median terminal latency was 27.348 seconds;
the cold first case took 40.072 seconds. Recorded round spend was $0.33894000,
bringing cumulative key spend to $7.55509135. Evidence and individual rejected
verdicts: `artifacts/uat/six-scenario-museum-repair-20261103/report.md`.
GitHub CI quality checks and tests passed; release-build jobs were skipped for
the draft PR, so this is not release verification.

New repairs cover the conflated Bartholin institute/garden identity, Edinburgh
gallery title variants, Press Club café scope, Jewish Museum and Cloisters
closures, Whitney/NMS/Britannia morning visit windows, and renamed Lindt day
trips. First-to-Bort sledging and Schynige Platte winter suggestions now require
specific route/season review. Asia Society admission requires review after a
participating-institution listing contradicted Monday admission; direct operator
retrieval failed, so no authoritative future opening guarantee is asserted.

The hours gate now distinguishes last admission from closing. Britannia's January
last admission is 15:00 while closing is 17:00; a later free window cannot justify
entry simply because the building is still open. This remains a compatibility
screen, not a complete arrival-time solver.

These changes do not complete D1–D6. New candidate grounding and replacement
search, complete arrival/departure and meal timing, wheelchair route evidence,
restaurant confirmation and physical Android remain unresolved. Keep PR #55
draft. Rerun the affected Copenhagen, Edinburgh, New York and Interlaken briefs
twice on the next fixed commit, retaining this failed round unchanged.

## Generation context repair — 2026-11-03

The eight affected cases on `e4c769c` completed with clean receipt integrity, but
quality remains rejected. Report: `artifacts/uat/six-scenario-novel-source-repair-20261103/report.md`.
Recorded spend reached $7.79254585. Android offline/reconnect/reopen and duplicate
generation retry were exercised on these receipts; all 44 day captures from the
previous full round also completed. CI checks/tests pass; release builds remain
skipped for the draft PR.

Activity and dining generation previously received trip length without the
actual start/end dates. Both prompts now include the destination-local dates.
The staging activity generator also receives fresh reviewed operator hours and
applicable unresolved venue restrictions before proposing candidates. Expired
reviews and unrelated destinations are excluded; dated restrictions stay scoped
to the trip. This reuses the compiler's evidence rather than asking generation
to unknowingly propose candidates that downstream checks will reject.

New source records address SMK Monday closure and New York Historical morning
duration. This is bounded reviewed context, not universal live source retrieval.
The next fixed twelve-run comparison must measure its quality, cost and latency;
the unresolved D1/D3/D4 gates are not declared complete.


## Completed date/source-context round — 2026-11-03

All twelve cases on `86b178f` completed with matching saved/streamed days and no
receipt-integrity issues. Warm median terminal latency was 27.735 seconds; cold
first case 44.401 seconds. Recorded spend reached $8.14161835 of the unchanged
$20 cap (round delta $0.34738750). Detailed per-case evidence and explicit
rejected verdicts: `artifacts/uat/six-scenario-source-context-20261103/report.md`.
The runner's per-case build label was stale; the fixed worktree and root manifest
identify the actual candidate. Subsequent runner reads that manifest directly.

A retrospective ledger CLI now audits actual saved receipts against the reviewed
catalog, retaining its hash and distinguishing contradictions, compatibility and
unknowns. It does not mark missing evidence as a pass or certify meals, routes,
accessibility or tickets. It is partial acceptance evidence, not completion of D1.

The next patch defers January Tivoli garden admission/strolls outside published
seasons, while leaving separately scoped theatre/restaurant events distinct.
Reviewed activity source URL/date now pass through saved results and the web
card; the existing native v17 card already supports this metadata. Attribution
requires a fresh joint identity match and does not manufacture booking links or
claim suitability. Local validation: 1,696 web tests; all 11 workspace check tasks
and script type-check passed, with nine existing lint warnings.

Copenhagen needs two affected-case reruns on the next fixed commit. Universal
source coverage, continuous wheelchair routing, complete transit/meal timing,
image coverage and physical-device verification remain unresolved. Keep PR #55
draft. Do not describe this repair as all issues fixed or production-ready.


## Source attribution verified; outdoor-hours repair — 2026-11-03

The two Copenhagen reruns on `8422b7a` completed. Tivoli January garden access
was absent. Reviewed source links and dates survived saved output and were
visually confirmed on Android for SMK and Amalienborg. All six day captures
completed; physical device remains absent. CI passed; release jobs skipped.
Recorded cumulative spend: $8.19825635. Report:
`artifacts/uat/copenhagen-source-attribution-20261103/report.md`.

This candidate is still rejected. Government operator hours contradict the
new King's Garden evening visit (January closes 17:00), and the 180-minute
Wednesday aquarium visit cannot fit after its 10:00 opening before noon.
The repair introduces explicit reviewed visit scopes for hours: a garden's
reviewed exterior access can be screened without borrowing museum admission
hours for unrelated outdoor walks, tours or events. Aquarium ordinary hours
are added separately. Neither record certifies accessibility or future lift
availability. Affected Copenhagen reruns remain required on the next commit.


Both affected Copenhagen runs on `a45c0d0` completed. Aquarium visits moved to
afternoon; the garden was placed in morning or absent. Tivoli January garden
admission was absent. Saved/streamed days match, with no receipt failures.
Terminal latency 45.210 seconds cold / 23.160 seconds warm; recorded spend reached
$8.24093635. Runtime source links cover 5/5 activities in the first run and 3/5
in the second. Local validation: 1,698 web tests, 227 script tests and workspace
checks passed. Detailed report: `artifacts/uat/copenhagen-outdoor-hours-20261103/report.md`.
These affected regressions are repaired; the broader D1/D3/D4/D5/D6 gates above
remain open. See [latest evidence](agentic-acceptance-latest.md) for the case matrix.

Billing reconciliation after both terminal receipts: cumulative spend **$8.26060035**, remaining **$11.73939965**. An additional $0.01966400 arrived after the per-case receipt; individual-case deltas are not treated as final attribution.
