# Mobile quality and design findings

Physical iPhone 15 Pro review of Faroway QA 1.0.0 (1), November 14, 2026.
Mode: task completion. Preserve the existing travel imagery, teal surfaces,
coral actions, and native navigation while improving clarity and reliability.
Evidence combines physical-device screenshots through iPhone Mirroring and
source inspection. The replacement iPhone build verifies the fixes explicitly marked below.
Subsequent source changes still require a new device build. This is a living issue register, not release approval.

| ID | Severity | Finding and evidence | Action / status |
| --- | --- | --- | --- |
| M01 | P1 | Day 3 in the Lisbon generation preview contains only two generic “local neighborhood spot” meals. The cards disclose “Dining idea” and unknown price, but this is not a usable researched itinerary. | Open: inspect saved itinerary and generation provenance; retain supply-gap failures. Do not dress placeholders up as verified venues. |
| M02 | P1 | Generation completion action appears below the usable bottom edge. Several mirrored scroll attempts did not expose it. A tap at the bottom returned to Home, followed by a mirroring interruption. | Source fixed: completion action now sits outside the scroll content in a bottom safe-area footer, and scroll content can grow naturally. Await rebuilt-device verification. This is not established as an app crash. |
| M03 | P2 | Explore “Places to fall in love with” starts farther right than the adjacent sections and crowds “Find a place.” Both the row and its title apply 24-point horizontal padding. | Verified in replacement physical build: heading aligns with the section and no longer crowds its action. Source allows wrapping and a 44-point minimum action target; large-text checks remain. |
| M04 | P2 | Day timeline reserves 80 points for five-character times, adds nested horizontal padding, and squeezes meal titles into narrow multi-line columns. | Source fixed: content-driven time column with 48-point minimum, remove redundant inset, prevent icon shrink. Await long-title and large-text visual checks. |
| M05 | P2 | Lisbon search says “No cities found,” even though a custom Lisbon plan is supported. Source searches only the curated local catalog. | Verified in replacement physical build: “Not in our suggestions — you can still plan here.” Explicit custom-destination action remains. |
| M06 | P2 | Lower Explore destination cards appeared as pale empty areas during the guest walkthrough. Other images eventually loaded. | Source fixed: empty image URIs now show “Photo unavailable,” with regression coverage. The staging popular-destinations endpoint returns synthetic Fixture Harbor/Garden records with empty image URLs. Fixture data is not traveler-quality acceptance; await rebuilt-device verification. |
| M07 | P2 | Rapid multiword text injection produced reordered allergy text; replacing the selection with a short value worked. | User verified Lisbon types correctly with the physical iPhone keyboard. Reordered destination input is observed only through Mirroring; no app defect established. Multiword allergy entry remains unverified. |
| M08 | P2 | Long planning form contains twelve vibe choices, then multiple dietary/access fields; several scrolls separate the main planning inputs from optional details. | Source fixed: empty optional needs collapse behind an accessible disclosure; saved needs remain visible. Expand/collapse/restored-needs regressions pass; await device and accessibility checks. |
| M09 | P3 | Generation preview repeats meal names in both timeline and expanded cards. Generic names amplify the repetition without adding useful information. | Evaluate after real inventory is available; preserve the timeline's scan value for real trip content. |
| M10 | P2 | Reopening a trip from My Trips briefly shows “Your itinerary isn’t loaded” and a Refresh action while the initial detail fetch is still pending. | Source fixed: treat cached summaries without days as loading, and show a spinner until detail resolves. Deferred-request regression added; 25 trip-detail tests pass. Await rebuilt-device check. |
| M11 | P2 | Detail hero was blank after generation, but rendered after reopening from the trip library. | Source hardened: detail hero uses shared image loading/error handling, including explicit unavailable state. Initial blank-after-generation cause remains unproven; await device reproduction. |
| M12 | P2 | “View dietary requirements” expands only general allergen safety advice, not the entered peanut allergy. | Dining-guidance label verified on replacement iPhone build. Subsequent source change displays saved allergies, diet, access, and mobility notes separately with an unverified-suitability disclaimer; formatting tests pass. Device round-trip remains unverified. |
| M14 | P2 | A failed detail request for a cached summary hid the network error behind generic missing-itinerary copy. | Source fixed after Android build 13: show the actionable connection error and clear it when refreshing. Regression covers failure and successful retry; device verification pending. |
| M13 | P3 | Travel preference budget choices still use emoji while vibe choices use the bundled icon family. | Verified in replacement physical build: all three budget choices render wallet, cash, and sparkles from the bundled Ionicons family. Saved Culture/Foodie preferences survived installation. |

| M15 | P2 | Offline sync retained raw nested itinerary days and omitted the saved hotel, unlike direct API loading. | Source fixed after build 13: reuse shared day/hotel normalization; regression covers visit photos, hotel preservation and stale-plan clearing. Device sync verification pending. |
| M16 | P2 | Generation waiting copy promised weather/crowd consideration and hidden gems irrespective of supplied evidence. | Source fixed after build 13: replace unsupported promises and unsourced trivia with practical planning guidance. This does not resolve itinerary supply quality. |
| M17 | P2 | Sync removed the saved local draft before persisting its confirmed server copy. A storage failure left recovery dependent on the pending mutation. | Source fixed after build 13: save confirmed copy first; failure regression verifies both saved draft and retry identity remain. Permanent data loss was not established because pending records can reconstruct drafts. |

| M18 | P2 | An online request failure returned cached trips without publishing them, leaving an initially empty My Trips screen empty. | Source fixed after build 13: publish cache for an empty current-account list; retain populated in-memory trips and reject delayed reads after account switches. |
| M19 | P2 | A failed photo remained unavailable after connectivity returned until its screen remounted. | Source fixed after build 13: retry on an observed offline-to-online transition, with subscription cleanup; missing URLs and continuously online failures do not loop. |

## Acceptance still required

- Saved-trip library reload, detail hydration, all three day tabs, past-trip
  empty state, profile counts, and saving/reopening Culture/Foodie preferences
  passed on the phone. Days 2 and 3 show only two generic meal ideas each.
- Confirm the actual API/build that generated the displayed trip before using it
  as evidence for the current planner changes; the mobile build revision alone
  does not establish the backend revision.
- On-screen keyboard, VoiceOver, larger Dynamic Type, dark appearance, and
  physical Android testing remain separate gates.
- Check blank, loading, failure, offline, and populated states in each tested flow.
- No new live generation was initiated by the reviewer in this pass. Reconcile
  the dedicated allowance and backend identity before any new paid test.
- Sharing UI was not tested: automatic approval review rejected opening its
  control because it might publish itinerary data. No public link was created.

## Regression-test process

When asserting rendered copy with mocked React Native components, select Text
nodes instead of serializing the whole tree: animated props can contain circular
references. Always unmount inside `finally` so failed assertions do not leave
screen timers running and obscure the actual test result.

## What works

The primary create-trip action is prominent. Dates reject past selections, the
guest authentication boundary is explicit, and destination/date/traveler draft
state survives closing the form. The bundled vibe icon family renders on the
physical phone. Preserve these behaviors during refinement.

## Review method

Native Impeccable review uses direct physical-device inspection and source
assessment; the web-only detector is not applicable. No overall quality score
is assigned while authenticated flows and accessibility remain untested.
Questions skipped: the user already requested continued QA and improvements;
only device-access blockers require input.

## Resumed verification

Completion footer and preference icon changes passed TypeScript and ESLint,
plus 45 tests across generation completion, profile editors, and trip detail.
A replacement physical iPhone build is pending its bounded upload approval.
The full mobile Jest suite subsequently passed: 70 suites, 726 tests. Staging
preflight passed configuration isolation, direct healthy JSON API access, and
79 catalog images; iPhone discovery succeeded, Android discovery was empty.
Local native builds remain below the project's 12 GiB free-space threshold.

## Replacement physical build verification

EAS build `f618bde6-d139-48eb-85e5-9f474cfb20d8` finished and was installed over
Faroway QA on the registered iPhone. It includes the uncommitted source fixes;
per-file source hashes and the IPA receipt are retained under
`artifacts/mobile-qa/ios-f618bde6/`. IPA SHA-256:
`a472948cfbf3e35dcdeed20d5635cb1b12ad32058c8be9c2a6f668230b578f90`.

Verified launch through Mirroring, retained QA account, saved trip, all budget
icons, corrected Explore alignment, revised search copy, and the “View dining
guidance” label. Trip detail reopened with its hero and days; no false empty
state was observed in this fast cached run. The deferred-loading regression
remains the evidence for the pending-fetch transition.

Completion footer and generation timeline still need an authorized generation
run on the replacement build. No generation was initiated during installation
verification. Rapid mirrored search typing again reordered characters; direct
phone keyboard reproduction remains necessary. Android discovery still empty.

The Python artifact download returned HTTP 403; Node fetch retrieved the same
Expo artifact successfully without exposing its signed URL. macOS codesign
reported an untrusted certificate chain; the iPhone's normal installation
accepted the signed/provisioned build. CoreDevice launch was denied while the
phone was locked; launching through the already-authorized Mirroring UI worked.

## Subsequent source and Android preparation

Full mobile regression: 72 suites / 729 tests passed; TypeScript and targeted
ESLint passed. These checks do not establish device acceptance for newer fixes.

The physical Seeker running Android 16 is now visible and authorized in ADB.
No Faroway package is installed. The latest available Android QA artifact is
from October 29 and predates current fixes; a current-source cloud build and
installation approval was requested before Android flow testing.

## Android build attempt after code review

Image recovery now handles URL, bundled-asset, and source-list changes after
a failure. Full mobile regression remained green (72 suites / 729 tests), with
TypeScript and targeted ESLint passing.

Android submission stopped before source upload because the configured private
credentials.json and documented QA keystore are absent. EAS advanced the remote
version code from 11 to 12 but did not start a build. No app was installed and
no Android flow is marked passed. Signing restoration or explicit replacement
key approval is required. A local signing-file guard now prevents repeating
this EAS-side version change with missing signing files.

The user approved a new QA-only signing key after the missing-key failure.
Created and verified a private RSA signing key; credentials remain ignored by
Git. EAS accepted Android build f477c732-79ab-4228-928b-39141a2ae724, version
code 13, with the reviewed fixes. Build completion and device results are still
pending; source hashes are retained in the ignored Android artifact directory.

## While physical Android is locked

The saved-needs data-loading regression and a new screen-level assertion verify
that allergy, diet, accessibility and mobility text reach the trip detail UI,
with the unverified-suitability disclaimer. These are automated checks, not a
physical-device round-trip. The cached-summary connection error fix is newer
than Android build 13 and needs a future approved build for device verification.

Source inspection confirms generic neighborhood activities and meals originate
from deterministic enrichment with planningIdea=true and unknown prices.
No planner quality claim is made from these placeholders. Current-backend live
acceptance remains required; no paid generation or deployment was started.
