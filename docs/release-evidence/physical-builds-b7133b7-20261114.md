# Replacement physical QA builds — November 14, 2026

Source: `b7133b782d98905c0ecbc469b810df3d5c442004`. User approved one Android and one physical-iPhone
build and installation. Both approvals were consumed by successful submissions.
Before submission, EAS reported 12 Android and 11 iOS included builds remaining,
with no overage. No store submission or production deployment occurred.

| Platform | Build | Artifact verification | Installation |
| --- | --- | --- | --- |
| Android Seeker | [13020ec2-cb38-454b-ae11-3f746e175ee9](https://expo.dev/accounts/testimonio/projects/faroway/builds/13020ec2-cb38-454b-ae11-3f746e175ee9) | `ai.faroway.app.qa`, 1.0.0 (15); APK signature verification passed | `adb install -r` returned Success; installed version 15 confirmed; launch status ok and running process verified |
| iPhone 15 Pro | [ab0b1a50-fca2-435d-8032-8a46ca4d710a](https://expo.dev/accounts/testimonio/projects/faroway/builds/ab0b1a50-fca2-435d-8032-8a46ca4d710a) | `ai.faroway.app.qa`, 1.0.0 (1); inspected IPA Info.plist | CoreDevice installation and launch succeeded on registered phone |

Artifact SHA-256:
- Android: `e09153ba5b84a87f136598f801ac941e6d21d82bbbdd527653ec9ea09d9eeff3`
- iPhone: `71777c6d67daf164cc12905ed3442a522dbfbe52a00b940a3c87619e58c6a020`

Artifacts and machine-readable receipts are retained under ignored
`artifacts/mobile-qa/android-13020ec2/` and `artifacts/mobile-qa/ios-ab0b1a50/`.
iOS build number remains 1, so do not use that number alone to identify the
candidate. The specific downloaded IPA above was installed successfully.

## Observed physical iPhone checks

- Mirroring initially reported Connection Interrupted; one Try Again reconnected.
- Existing Phone QA session survived the upgrade. Profile showed one upcoming trip.
- Explore showed the destination collection notice and populated destination art
  instead of the image-less fixture records.
- Opened the onboarding route without clearing app data. Copenhagen, Lisbon and
  the visible New York thumbnail rendered using bundled photos; credits visible.
- Selecting Copenhagen opened the planner with Copenhagen, Denmark. Its map was
  initially loading, then rendered correctly on a subsequent settled observation.
- No generation, purchase, sharing, or account deletion was initiated.

## Limits

Android checks in this receipt establish installation/version/process launch only,
not visual or full-journey acceptance. iPhone observations do not establish cold
first-run landing, every offscreen image, VoiceOver, large native text, offline
recovery, generation-to-detail image lifecycle, or current-backend itinerary quality.
Mirroring scroll/drag attempts did not move the viewport in this pass; successful
taps and direct route launch are not evidence that offscreen controls were tested.
The branch remains unmerged; remaining gates are in the audited readiness plan.
