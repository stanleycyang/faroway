# Physical Android QA — November 14, 2026

Device: Seeker, Android 16; ADB connection authorized. No existing Faroway
package was present before this run.

Build: [EAS f477c732](https://expo.dev/accounts/testimonio/projects/faroway/builds/f477c732-79ab-4228-928b-39141a2ae724), QA version code 13.
Includes the current uncommitted mobile fixes; source manifest is retained in
ignored `artifacts/mobile-qa/android-current/`. Build finished and installation succeeded. Android package inspection confirms
version 1.0.0 / version code 13. The activity launch command returned success.
Visual and flow acceptance remain pending because the device is locked.

Signing: user explicitly approved a new QA-only key because the prior local
signing files were unavailable. New key cannot update installations signed with
the prior key. Private key and credentials are excluded from version control.

## Coverage to execute

- Install, cold launch, onboarding and Android system back navigation.
- Explore image fallback and heading layout.
- Custom destination entry, dates, travelers and optional-needs disclosure.
- Staging sign-in, saved trip hydration, day tabs and saved needs.
- Preference editing and persistence after process restart.
- Keyboard, scrolling and reachable controls on the physical display.

Live generation requires separately reconciled budget and current-backend
acceptance. The pinned staging catalog includes synthetic fixtures, so fixture
content must not be treated as real traveler-quality acceptance. Public sharing
and production/store integrations are outside this smoke pass.

## Installation evidence

`adb install` returned Success; `dumpsys package` confirmed version code 13.
`am start -W` returned Status: ok for the QA MainActivity. The initial capture
was black while the screen was off. After waking the display, Android reported
keyguard showing=true. Requested user unlock; no PIN entry or lock bypass was
attempted. Installation and process launch do not establish UI acceptance.

APK checksum and build receipt are retained with the source manifest under
`artifacts/mobile-qa/android-current/`. No live generation was initiated.

## Replacement installation

[EAS build 3aada6d2](https://expo.dev/accounts/testimonio/projects/faroway/builds/3aada6d2-f74d-4e81-9502-517ccdcf7e08)
finished successfully from commit `26e6d002a3c666020d64ee735c469b25666cecce`.
The explicitly approved replacement uses the same QA-only signing key.
`adb install -r` returned Success; package inspection confirms version 1.0.0,
version code 14. No app-data clearing was performed. The APK checksum and source
receipt are retained in ignored `artifacts/mobile-qa/android-3aada6d2/`.

The Seeker remains connected, with keyguard showing=true and screen off. UI
checks remain pending; installation is not UI acceptance. Build 14 includes the
latest cache recovery, reconnect image recovery, offline normalization and
storage-order fixes. No live generation was initiated.
