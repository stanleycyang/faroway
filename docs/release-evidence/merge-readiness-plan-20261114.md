# Audited merge-readiness plan

## Latest reconciliation

The table below records earlier implementation milestones; this reconciliation
supersedes its binary/provider status. Both phones now have e89332b. Saved-trip
Trips/Share navigation passed on both; see
[native receipt](native-planning-e89332b-20261114.md). Later hero-spacing and
planning-idea disclosure changes still require new binaries and physical checks.

Remaining gates, in dependency order:

1. **QA provider configuration:** Viator API key/partner ID and Google Places key
   remain production-only; LiteAPI remains on `codex/release-candidate`, not
   `eval/agentic-quality-20261031`. No supplier request or successful affiliation
   is inferred from these dashboard entries. Configure the intended QA branch,
   then finish the already-approved backend deployment and validate its binding.
2. **Real itinerary quality and affiliate journey:** rerun the Lisbon meal repair,
   opt-in Tokyo vendor case, remaining representative/holdout cases within the
   original reconciled budget, and stop on failure. Verify actual supplied photo
   delivery, relevant scheduled products, checkout handoff and partner reporting.
   LiteAPI currently supports sandbox hotel quotes, not live hotel inventory in
   the itinerary generator; Google Places is a separate reference path, not a
   native photo source. These product gaps require implementation/acceptance,
   not just new keys.
3. **Native acceptance:** rebuild the later mobile fixes, then exercise loading,
   generation-to-detail images, offline/reconnect, direct-entry navigation,
   first-run and authenticated parity. Mirroring currently reports iPhone in Use;
   reconnect requires the phone locked and idle. The Android runtime font-scale
   clipping finding remains open; an upstream proposed fix is not our acceptance.
4. **Release assurance:** native screen-reader/large-text coverage, external auth,
   sharing/revoke, recovery/operational gates, final CI and deep candidate review
   remain required. No production merge or store submission is justified yet.

Source follow-up preserves explicit planning-idea provenance through mobile
normalization and cache, and shows incomplete-research disclosure on detail.
The new vendor acceptance checks reject missing/duplicate inventory and missing
photo/attribution metadata. These prevent false acceptance; they do not repair
supplier availability or turn legacy generic trips into researched itineraries.

## Audit findings

The earlier plan was too permissive in four places:

1. Storage HEAD checks did not inspect the API payload that actually replaces discovery cards, download/decode photos, or prove the photo matches the place. The QA catalog returns image-less synthetic destinations. A successful request and an explicit placeholder are not image-quality acceptance.
2. Onboarding was checked for navigation, not whether a new traveler understands the product and can begin a useful task. Three passive intro slides added friction without creating a trip brief.
3. Source fixes, old installed binaries, fixture backend behavior, and current backend acceptance were sometimes adjacent without a single closure rule. Every finding needs independent implementation and acceptance status.
4. A green aggregate test count could obscure itinerary quality failures, unavailable providers, or incomplete physical accessibility coverage. Critical failures must remain release blockers even when aggregate scores are high.

## Execution order and closure criteria

| Work | Required evidence to close | Current status |
| --- | --- | --- |
| Discovery photography | Inspect popular/trending payloads; retain correctly matched curated imagery when incoming rows lack valid sources; GET/decode and visually inspect visible cards. Distinguish absent URLs, delivery failure, incorrect place matches, and transient loading. | Client normalization implemented with exact city/country fallback. Unknown image-less records are omitted; curated collection remains when none qualify. Visible iPhone discovery art verified after upgrade; complete catalog and Android visual verification remain. |
| Landing and onboarding | Offline first paint with bundled licensed photography; clear product explanation; guest exploration and sign-in routes; destination choice reaches existing planner with correct city/country; arbitrary destination remains available. Screens scroll at small widths and large text. | Implemented and installed on both phones. iPhone suggestion photos and Copenhagen handoff pass; cold first-run landing, offline launch and Android visual checks remain. |
| Itinerary image lifecycle | Same trip through generation, completion, save, reopen, cold launch, offline, and reconnect. Inspect payload/normalization/cache/source/decode at each transition. Zero unexplained blank images for known supplied photos. Missing provider photos remain explicitly unavailable, with no unrelated substitute. | Existing regressions pass; original generation-to-detail blank-image cause remains unproven. Do not close M11 from a saved-trip hero pass. |
| Planner quality | Verify current backend revision, reconcile remaining original budget, run frozen cases and reserved holdouts. Inspect per-day usable activities, grounded venue/address evidence, meal specificity, opening/timing feasibility, traveler constraints and price provenance. Hard failures cannot be averaged away. | Old fixture backend and generic-meal-only days are not current planner acceptance. Protected preview/credential approval and budget check required before new paid execution. |
| Reliability | Cache hydration, failed fetch/retry, offline-to-online images, sync persistence failures, pending mutations, account switching during reads. Reproduce conditions deliberately; don't infer from successful online walkthroughs. | Automated coverage exists; forced physical failure checks remain open. |
| UX/accessibility | Review completion footer, long timeline titles, duplicate meal presentation, disclosure/restored needs, keyboard avoidance, 150%+ native text, VoiceOver/TalkBack, contrast, focus order, touch targets, and dark system appearance. Save before/after evidence for the same state. | Both phones have the new first-run changes. Android build 14 evidence remains historical; native accessibility, font-scale transition and full first-run checks remain. |
| Platform parity | Same reviewed source on Android and iPhone; verify first-run, authenticated planning, library, profile, offline/recovery, and runtime logs. | Both phones now have source b7133b7. Android version 15 install/launch passes; limited iPhone checks pass. Full parity acceptance remains. |
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
acceptance. Native acceptance remains a separate gate; the approved replacement builds are now installed.

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

### Follow-up verification

- `bun --no-env-file test scripts/__tests__`: 266 tests pass, including opt-in
  supplier selection, missing-partner preflight, duplicate inventory, photo and
  attribution rejection.
- From `apps/mobile`, `bun run test -- --runInBand --coverage=false`: 76 suites,
  769 tests pass, including normalization/cache preservation and disclosure
  present/absent behavior.
- `bun run check`: 11 workspace tasks pass plus script TypeScript check; nine
  existing web lint warnings remain. `git diff --check` passes.
- No live generation, new native build, credential change or production deploy
  was performed in this follow-up. Supplier metadata contracts are automated
  evidence only; the physical and live gates above remain open.
