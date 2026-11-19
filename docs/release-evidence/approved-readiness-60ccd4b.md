# Approved candidate verification

## Scope and CI

The newer approval superseded the earlier e953624 requests. Exactly one protected
preview and one native build per platform were submitted for source 60ccd4b.
The subsequent 9dca3de change was documentation only.

The approved staging URL and anon key were configured as GitHub Actions secrets
without uploading a service-role or Gateway key to GitHub. Full CI run
[43668780233](https://github.com/stanleycyang/faroway/actions/runs/43668780233)
passed Quality Checks, Tests, Build Web and Full Release Verification. This proves
a staging-backed build, not production configuration or provider acceptance.

## Live preview

The preview required authentication (anonymous health request returned 302).
Tier 0 passed health, guest rejection, unauthorized cron rejection, sign-in,
consent, idempotent creation, cross-account isolation, edit conflict, share/revoke
and cleanup. Seventy-nine storage HEAD checks passed; these are not photo decoding
or correctness evidence. Places/weather were explicitly disabled. Rate limiting
was checked in source only; the live rate-limit probe was skipped.

One Lisbon itinerary ran for December 7–9. The prior structural smoke accepted
three saved days with activities, some meals and valid timing proposals. Human
review failed it: days 1 and 2 had no breakfast or lunch suggestions; all nine
scheduled activities had empty photo arrays. Supplied photos are absent upstream,
so loader recovery cannot solve that inventory gap. Named venues alone do not
establish verified hours, routes, access or booking availability.

No further paid case was dispatched after this quality failure. The terminal
synthetic trip was deleted by the harness. The temporary preview was removed;
its immutable health URL subsequently returned 404. Private HTTP and inventory
receipts remain under `/tmp/faroway-60ccd4b-*` and are not committed.

Settled spend: $9.88243885 of the original $20; this run cost $0.048007.
Remaining original allowance: $10.11756115. The replacement key cap remains $10.28
and is nonrenewing. No budget was reset or increased.

## Corrections derived from this failure

- Live full-day smoke now requires breakfast, lunch and dinner coverage. Explicit
  planning ideas, null entries and unnamed records cannot count as usable supply.
  Structural presence still does not establish provenance or suitability.
- A minimized fixture preserves the live meal-gap regression without account IDs,
  trip IDs, credentials or raw private receipts.
- Saved inventory had no neighborhood labels. Dining repair previously derived
  its targets only from that optional field and could skip retry entirely. It now
  falls back to the supplied location name/address, with no invented neighborhood.
  The original distance, closure and evidence screens and one-retry cap remain.
- Targeted coverage/repair tests: 12 pass. Script suite: 264 pass / 1,666 assertions.
  Full web suite: 188 files / 1,730 tests pass. Workspace check: 11 tasks pass,
  with nine existing web lint warnings. Live acceptance of this correction remains
  open; the deleted preview contained the earlier implementation.

## Native artifacts and observed acceptance

Both artifacts identify exact source 60ccd4bae95b0833be3e7e6d7500127434bcf9e3.

| Platform | Build ID | Version | SHA-256 |
| --- | --- | --- | --- |
| Android | ff6ab031-af9f-4536-9b4c-eab813d697de | 1.0.0 (16) | 3b85fa05754b38d8311b28d1a703588ed3dbd66a95dd7ccc654e073ab788a0b9 |
| iPhone | cc30ccba-b764-4707-a537-169df47a29ac | 1.0.0 (1) | 635fb0c53ea0aa666471aa1825bfcf82d1313f58a4d92b2263d79b284d7ac373 |

Android APK v2 signature verification passed using the existing Java 17 runtime;
package is ai.faroway.app.qa and in-place ADB installation succeeded. iPhone
bundle ID matched, and CoreDevice installation/normal launch succeeded. macOS
codesign verification reported an untrusted distribution chain; iOS accepted the
provisioned build without changing trust settings. The CLI root deep-link launch
failed to report a process; normal home-screen app launch worked. This is not a
confirmed app crash.

The welcome image boundary and readable opaque text panel now pass on both
physical phones. Android before/after images are in the ignored artifact folders
android-13020ec2/guest-welcome.png and android-ff6ab031/welcome-fixed.png.

The retained iPhone session shows an explicit profile-loading error instead of
false empty preferences. The editor also fails to load. A read-only staging API
check returns the saved Culture/Foodie values and a valid response shape. Fresh
phone sign-in is pending to isolate session/connectivity from an app defect;
profile acceptance is not closed. Physical offline recovery, accessibility,
current-backend generation and complete platform parity remain open.

Android build 16 additionally passed fresh staging sign-in, saved-trip discovery,
session restoration after process restart and saved-itinerary reopening. Its
profile displays two saved vibes, and the saved Lisbon hero renders. The cached
itinerary opens with Wi-Fi and mobile data temporarily disabled and an explicit
offline banner; both original connectivity settings were restored in `finally`.
This does not simulate storage failure or prove uncached photo recovery. Native
harness evidence is retained privately under the QA account's native evidence
directory; `android-ff6ab031/offline-saved-trip.png` is ignored local evidence.

Large-text follow-up: cold onboarding at 150% uses the stacked destination layout
and keeps the primary action, description and visible credit readable. Changing
font scale while the process is running reproduces widespread clipped Explore and
tab text; this remains unresolved and is not a cold-launch layout pass. Original
scale 1.0 was restored. Screenshots: `android-ff6ab031/font-transition.png` and
`android-ff6ab031/onboarding-150.png`. React Native's
[reported Android Fabric issue](https://github.com/react/react-native/issues/52895)
describes similar runtime clipping, but similarity does not prove identical cause.
The installed 0.81.5 includes font-scale relayout code gated by a disabled internal
feature flag. Do not enable a whole experimental release level or reset navigation
as an unverified workaround; a native compatibility fix and rebuilt transition test
are still required.
