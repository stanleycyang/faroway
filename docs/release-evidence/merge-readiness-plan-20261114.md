# Audited merge-readiness plan

## Audit findings

The earlier plan was too permissive in four places:

1. Storage HEAD checks did not inspect the API payload that actually replaces discovery cards, download/decode photos, or prove the photo matches the place. The QA catalog returns image-less synthetic destinations. A successful request and an explicit placeholder are not image-quality acceptance.
2. Onboarding was checked for navigation, not whether a new traveler understands the product and can begin a useful task. Three passive intro slides added friction without creating a trip brief.
3. Source fixes, old installed binaries, fixture backend behavior, and current backend acceptance were sometimes adjacent without a single closure rule. Every finding needs independent implementation and acceptance status.
4. A green aggregate test count could obscure itinerary quality failures, unavailable providers, or incomplete physical accessibility coverage. Critical failures must remain release blockers even when aggregate scores are high.

## Execution order and closure criteria

| Work | Required evidence to close | Current status |
| --- | --- | --- |
| Discovery photography | Inspect popular/trending payloads; retain correctly matched curated imagery when incoming rows lack valid sources; GET/decode and visually inspect visible cards. Distinguish absent URLs, delivery failure, incorrect place matches, and transient loading. | Client normalization implemented with exact city/country fallback. Unknown image-less records are omitted; curated collection remains when none qualify. Physical verification pending. |
| Landing and onboarding | Offline first paint with bundled licensed photography; clear product explanation; guest exploration and sign-in routes; destination choice reaches existing planner with correct city/country; arbitrary destination remains available. Screens scroll at small widths and large text. | Implemented; navigation tests and source-rendered preview pass. New native builds required. |
| Itinerary image lifecycle | Same trip through generation, completion, save, reopen, cold launch, offline, and reconnect. Inspect payload/normalization/cache/source/decode at each transition. Zero unexplained blank images for known supplied photos. Missing provider photos remain explicitly unavailable, with no unrelated substitute. | Existing regressions pass; original generation-to-detail blank-image cause remains unproven. Do not close M11 from a saved-trip hero pass. |
| Planner quality | Verify current backend revision, reconcile remaining original budget, run frozen cases and reserved holdouts. Inspect per-day usable activities, grounded venue/address evidence, meal specificity, opening/timing feasibility, traveler constraints and price provenance. Hard failures cannot be averaged away. | Old fixture backend and generic-meal-only days are not current planner acceptance. Protected preview/credential approval and budget check required before new paid execution. |
| Reliability | Cache hydration, failed fetch/retry, offline-to-online images, sync persistence failures, pending mutations, account switching during reads. Reproduce conditions deliberately; don't infer from successful online walkthroughs. | Automated coverage exists; forced physical failure checks remain open. |
| UX/accessibility | Review completion footer, long timeline titles, duplicate meal presentation, disclosure/restored needs, keyboard avoidance, 150%+ native text, VoiceOver/TalkBack, contrast, focus order, touch targets, and dark system appearance. Save before/after evidence for the same state. | Android build 14 covers only explicitly recorded checks. New first-run changes are not installed. |
| Platform parity | Same reviewed source on Android and iPhone; verify first-run, authenticated planning, library, profile, offline/recovery, and runtime logs. | Both installed versions predate this batch. Each replacement build needs bounded approval. |
| External/release gates | OAuth/provider flows, authorized sharing, operational rate enforcement, alert/recovery behavior, CI, dependency/security review, independent deep diff review. Separate merge acceptance from store submission and production deployment. | Open; don't infer pass from mocks or disabled staging integrations. |

## Finding closure rule

For each M-series finding, record: reproduction, severity, source fix, focused regression,
installed build and backend revision, observed result, evidence path, and residual scope.
Use `fixed in source / awaiting acceptance` until the original failure passes on the
required surface. A physical pass on an older binary does not validate newer code.
Keep historical observations, but use this plan and the latest platform receipt to
interpret older ledger statements. Do not merge with an unresolved P1 or untriaged
critical-path failure. Minor accepted limitations require explicit rationale.

## First implementation batch

- Replaced welcome remote-image dependency with existing bundled Nyhavn photography,
  retained credit/license links, clarified the product and primary action.
- Replaced passive intro slides with an optional destination choice handed into the
  existing planner; exploration and account access remain available.
- Stacked suggestion layouts on narrow screens or larger native fonts; button labels
  wrap and center instead of overflowing their horizontal content box.
- Prevented image-less API rows from replacing the useful discovery collection.
- Cleared stale country/provider place IDs when a new destination arrives through
  a link, with a regression preserving unrelated traveler choices.
- Added navigation/asset and catalog regressions. No backend fixture data was altered.

Verification uses a lightweight React Native Web render of the actual screen source,
with router/store/native integrations stubbed. This demonstrates layout and photo
decoding, not native navigation, native font scaling, offline persistence, or provider
acceptance. Native replacement builds remain a separate gate.

### Verification receipt for this source batch

- From the repository root: `node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json` passed.
- From `apps/mobile`: `../../node_modules/.bin/jest --runInBand --coverage=false` passed: 74 suites, 751 tests.
- From `apps/mobile`: targeted `../../node_modules/.bin/eslint` on all changed TS/TSX files passed. Run ESLint from this package so it discovers `eslint.config.mjs`; repository-root invocation does not discover that package configuration.
- `git diff --check` passed.
- Actual screen source rendered through React Native Web at 390×844 and 320×700. Local hero and all three destination images decoded; no document horizontal overflow at 320px. Initial narrow row crowding led to stacked destination layout. These are browser layout checks, not native Dynamic Type acceptance.
- Local screenshots: `artifacts/mobile-qa/first-run-source-preview/` (ignored). Preview mocked router, user store, icon glyphs, status bar, haptics and external credit-link opening. It did not exercise real authentication or generation.
- Both replacement builds were subsequently approved, completed and installed. See
  [physical build receipt](physical-builds-b7133b7-20261114.md) for exact artifacts,
  limited iPhone observations and remaining Android visual acceptance.
