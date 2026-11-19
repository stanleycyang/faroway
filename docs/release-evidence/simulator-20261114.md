# iOS simulator QA — 14 November 2026

Scope is simulator-only by user request. No physical-device acceptance is
claimed. This is incomplete QA, not permission to merge or release.

The installed iPhone 17 Pro (iOS 26.3) QA artifact is EAS build
`f4414e62-62a7-4fec-aa56-fa8015ed1cda`, bundle `ai.faroway.app.qa`.
Its embedded bundle SHA-256 matches the locally retained downloaded artifact.
It predates the current source changes; results below do not verify a rebuilt
current candidate.

## Observed checks

- `bash scripts/mobile-qa.sh preflight`: staging identity and anon-key guard
  passed; direct API returned healthy JSON; 79 image checks passed. The app
  displayed the synthetic staging destination catalog.
- Existing Maestro startup/planner navigation flow: 1/1 passed in 10 seconds.
- Empty planner disables generation; selecting a custom destination updates the
  missing-requirements hint. Tapping a past date did not select it. Selecting
  future start/end dates enabled continuation.
- Closing/reopening the planner retained destination, dates and multiline
  allergy text. Guest continuation opened the staging sign-in gate.
- Profile and Explore tab navigation worked. Sign-in-dependent journeys remain
  pending user sign-in. No live generation was dispatched.

## Findings and follow-up

The software keyboard obscured the focused allergy input. Tapping an on-screen
key changed its accessibility value while the input remained hidden. The source
patch replaces outer keyboard padding with the iOS ScrollView's native keyboard
inset/focused-responder adjustment and adds drag-to-dismiss. This requires a new
artifact and repeat native acceptance; source tests cannot establish the fix.

The installed simulator also displayed missing emoji glyphs in inspiration and
vibe chips. Root cause is not established. Scrolling via automation initially
did not move the screen, but accessibility focus reached the lower inputs; do
not classify that alone as an app scrolling defect. A second Simulator window
opened during inspection, so device focus must be checked before interaction.

No Apple/Android physical devices were discovered. Disk fell from 10.3 GiB to
about 5.1 GiB during the run; no cause is asserted. Local native builds remain
below the documented 12 GiB minimum. No deletion or cloud build was performed
as part of this evidence capture.

After the source patch, mobile `jest --runInBand` passed 70 suites / 725 tests;
`tsc -p apps/mobile/tsconfig.json --noEmit` and focused formatting passed.
Authenticated recovery, saved-trip rendering, offline behavior, push, OAuth,
large text, Android and the current rebuilt candidate remain unverified.
Earlier live planning quality, security and operational blockers remain open.
