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

## Unlocked-device walkthrough — build 14

Verified on the physical Seeker: welcome launch, all three introduction steps,
Explore, opening the planner, custom Lisbon text entry and selection with the
keyboard visible, past-date rejection, and November 23–25 future-date selection.
Traveler count increased from two to three. Culture/Foodie choices were tapped;
selection persistence still needs explicit readback.

The empty optional-needs disclosure expanded. Synthetic multiword allergy input
“Severe peanut allergy” retained character order; Android Back dismissed the
keyboard. After selecting step-free entrance, closing and reopening the planner
retained Lisbon, dates, three travelers, allergy text and the checked access need.
The optional-needs fields remained visible with saved input. Generate remained
reachable; no generation was submitted.

The UI hierarchy reports clipped bounds for some dropdown/scroll descendants
while screenshots show them visible and touchable. Accessibility focus behavior
requires separate TalkBack verification; do not infer visual clipping from those
bounds alone. Screenshots are retained in the ignored build artifact directory.

## Authenticated and visual checks

The original smoke-runner account signed in successfully but had no saved trips.
A 1Password save sheet covered navigation and caused the original automated
runner to time out. Declined saving both disposable account logins to the personal
vault. Continued manual checks using the existing phone QA account, without
creating any trips. The runner now handles that exact optional sheet and reports
an empty seeded-data precondition explicitly; the full runner was not rerun.

Passed on build 14:

- Phone QA account sign-in and session retention after cold restart.
- Saved Lisbon library card, detail hydration and all three day tabs.
- Lisbon hero photo loaded; saved peanut allergy and step-free entrance visibly
  rendered with the unverified-suitability disclaimer.
- Android Back returned to My Trips; past filter showed “No past trips.”
- Profile showed one total/upcoming trip and zero past trips.
- Added Nature to the original Culture/Foodie preferences, saved, cold restarted,
  and verified three interests. Removed Nature and saved again; original two
  preferences restored.
- All three bundled budget icons visible after scrolling.
- Fully exposed Explore fixture cards showed “Photo unavailable.”
- Clean launch at 1.5x font scale: Explore headline/action wrap, hero copy/CTA,
  and navigation labels remained readable. Original 1.0 scale restored.

The initial font-setting transition recreated the activity and showed clipped
text; a cold launch at the same 1.5x scale cleared it. This transition issue is
not a persistent cold-launch layout failure. The file named
preferences-large-text.png actually captures the recreated Explore screen.

Still unverified: live generation/completion footer, live inventory quality,
TalkBack traversal, broader large-text screens, network-loss/reconnection on the
physical device, dark mode, sharing and external provider/store flows. Days 2
and 3 in the old saved Lisbon itinerary still contain only generic meal ideas.
No live planning, public sharing, or purchases occurred.
