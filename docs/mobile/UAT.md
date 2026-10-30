# Android UAT

Use **Faroway QA** (`ai.faroway.app.qa`), which installs alongside the normal app.
It uses the isolated `faroway-staging` database (`omovikloadpvzijoaqus`) and the
QA API pinned in `apps/mobile/eas.json`. Its `faroway-qa://` links cannot open the
production app. QA mode is rejected by the production EAS profile.

The staging alias has a domain-specific Vercel protection exception so native
requests can reach it. All application authentication and ownership checks still
apply. The custom hostname `mobile-qa.faroway.ai` still needs its external DNS
record; it is not the app's configured endpoint.

## Sign in

The QA login uses ordinary Supabase email/password sessions. Two disposable
accounts are stored on the setup Mac in
`~/.local/share/faroway-uat/accounts.json` (owner-only permissions). Enter the first
account in the QA login form. The second account is for privacy tests. No password,
service-role key, or authentication bypass is bundled in the app.

Google/Apple provider acceptance is separate: those providers are currently
disabled in staging. QA email login does not establish OAuth acceptance.

## Repeatable agent commands

Run from the repository root with Node 22 and the authenticated EAS CLI:

```sh
bun run qa:mobile preflight
bun run uat:images           # Verify every catalog image is publicly accessible
bun run uat:api              # Auth, create/replay, ownership/RLS, edit conflict, share/revoke
bun run uat:api live         # Same checks plus ONE real AI-generated itinerary
bun run uat:api family       # One family/vegetarian/step-free live scenario
adb devices -l
bun run uat:native DEVICE_SERIAL
```

`uat:api` deletes only the draft it created. `uat:api live` retains its generated
trip for device review and records its identity. Failed live runs also retain the
trip so recovery can be investigated without dispatching duplicate work.
Evidence goes to ignored `artifacts/uat/`. Native test evidence is private under
`~/.local/share/faroway-uat/native/`; raw Maestro artifacts may contain test
credentials and must not be published. Credentials enter Maestro through process
environment variables, not command-line arguments.

The default native runner uses ADB and Android UI Automator. The optional
`bun run uat:native:maestro DEVICE_SERIAL` runner currently encounters the upstream
Maestro device-offline transport issue on this Mac.

The native command verifies the QA package is installed, signs into the first
test account, opens saved trips, checks session persistence after relaunch, and opens a saved
itinerary to verify that day navigation actually loads.
It does not clear app data or perform purchases. For a physical Android, enable
USB debugging, connect a data cable, and accept the device's debugging prompt.

The dedicated `Faroway_UAT` Android 15 emulator is also available on the setup Mac.

## Live AI budget

The October 28 setup uses a dedicated AI Gateway key named
`faroway-android-uat-20261028`: a **$20 non-renewing quota**, seven-day expiry, and
75%/100% spend alerts. It is scoped to the staging branch's server environment.
When its budget or lifetime ends, live planning needs a newly authorized key.
Do not replace it with the inherited production/shared key.

```sh
bunx vercel ai-gateway budgets list --scope testimonio
```

Live generation verifies the actual app pipeline; acceptance still requires
reviewing output quality. Flights, supplier checkout, optional vendor enrichment,
weather, and push delivery need their own configured services and acceptance.
Disabled providers must be reported as untested, never as passed.

## Build another APK

```sh
bun run qa:mobile cloud-android
```

The Android QA profile uses a separate local signing key at
`~/.local/share/faroway-uat/android-qa.jks`, referenced by the ignored private
`apps/mobile/credentials.json`. Preserve that key to install updates over the QA
app. On a new machine, provision a QA signing key and credentials file first.
The profile does not submit to Google Play.

Use the same backend deployment, APK identity, and source revision throughout
each acceptance run. Record physical-device results separately from emulator,
API, and unit-test results.

## Setup verification — October 28, 2026

- Signed Android APK: [EAS build 3fd97cd0](https://expo.dev/accounts/testimonio/projects/faroway/builds/3fd97cd0-e897-45f0-8880-d7873e69d59f), version 1.0.0 (4).
- Local artifact: `artifacts/uat/faroway-qa.apk`.
- Backend deployment: `dpl_2W9obxZtx7mvHugrHjoUBDJfiToB`, source `9c4bed8b76f1f9363142eb9dfe1fef2af6538010`.
  Mobile build includes the QA changes on local branch `uat/android-20261028`.
- 63 mobile test suites / 667 tests passed; typecheck, lint and QA preflight passed.
- Real API checks passed for authentication, idempotency, ownership/RLS, stale edits,
  and public share revocation. Live Lisbon and Copenhagen family plans completed.
- Android 15 emulator: real login, generated saved trips, and session persistence
  after process restart passed using the installed release APK and ADB runner.
- Dedicated AI budget spent $0.17 of $20 at verification.
- At initial verification no physical Android appeared in ADB. Later macOS USB
  inspection detected the Seeker, but its debugging interface remained unavailable.
  Physical-device installation and acceptance remain pending.

The first live run used an output limit that truncated agent responses. That
limit was removed, both scenarios rerun successfully, and the disposable failed
trip removed. The retained plans contain destination-specific ideas and explicit
unknown prices / unverified dietary and accessibility notes. Supplier accuracy,
actual venue accessibility, and overall travel quality are not certified by these
pipeline checks. No warning/error runtime logs were returned for the final two runs.

### Image catalog readiness

The initial staging setup omitted the public image assets, which produced blank
Explore and saved-trip cards. The catalog was subsequently populated from the
existing public Faroway assets. QA preflight now checks every catalog URL before
allowing a native build. `bun run uat:images --seed` copies only missing images
to the pinned staging project using CLI credentials kept in memory. It does not
modify production or copy private user data. Venue photos from disabled supplier
integrations remain unavailable; destination photography is not venue evidence.

## Mobile UX revision

The mobile pass covers the welcome screen, all onboarding slides, sign-in and
authentication sheet, Explore, saved trips, trip setup and date picker, generation
progress, itinerary and booking review, inspiration pages, Profile, profile
editing, travel preferences, and notifications. The direction uses destination
photography, native system type, white surfaces, ocean-toned supporting areas,
and restrained coral actions.

The review also repaired two functional visual failures: city-plus-country
briefs now resolve the correct catalog image, and legacy cached summaries with
`budget: null` recover without deleting saved data. Screenshots from the original
and revised APKs are recorded under ignored `artifacts/uat/ux/`.

Validation: 66 suites / 672 tests passed, including cache recovery and image
resolution regressions. The image audit checks all 79 public catalog assets.
Native review must use the final build recorded below, since the earlier APK
does not contain the UX or cache fixes.

Native flow verification also selected a destination and dates, accepted the
AI disclosure, generated a live two-day Lisbon plan, and opened the saved plan.
The dedicated AI quota showed $0.22 spent after this run. Output remains an AI
suggestion: for example, activity-duration values require content review even
though the UI now formats fractional unit strings readably.

The upgrade test loaded the original malformed-budget cache successfully without
clearing app data. It then confirmed real login, session restoration, destination
photos, and loaded itinerary day navigation.

The final visual pass includes narrow-screen fixes for hotel names and unknown
prices, a single-column booking footer, a traveler counter that stays inside
the screen, wrapping generation-card metadata, and a trip-creation footer that
no longer overlaps validation and recovery controls.

Review scope: the 13 mobile routes plus date selection, authentication, booking
review, loading and error states. External support/legal websites and disabled
OAuth, push, and supplier integrations are outside this mobile acceptance pass.

## Final UX handoff — October 28, 2026

This build supersedes the initial setup APK and all intermediate review builds.

- [Download Android QA APK](https://expo.dev/artifacts/eas/eimwqUWft35QFgaeQlGi2dfkI4cdE1nxyf0Fyjfb_dM.apk)
- EAS build: `e639055a-27be-4504-b5b3-939ef9065b16`; package `ai.faroway.app.qa`; version `1.0.0 (11)`.
- Local artifact: `artifacts/uat/faroway-qa-ux-handoff.apk`.
- SHA-256: `97db5bdc1879436fd7eb1e40975d4b3699b70add7a8bab9a9cbe81bc986f6c54`.
- Installed as an update on the Android 15 emulator. Real staging sign-in, session
  restoration, and loading a saved itinerary passed with existing data preserved.
- Upgrade evidence: `~/.local/share/faroway-uat/native/1793250553125/`.
- Fresh-data sign-in, session restoration, and saved itinerary loading also passed;
  evidence: `~/.local/share/faroway-uat/native/1793250623272/`.
- Fresh-start verification cleared only the dedicated emulator QA package and
  walked through welcome and all three onboarding slides into Explore.
- Final route screenshots: `artifacts/uat/ux/after/`; fresh-start screenshots:
  `artifacts/uat/ux/flow/final-*.png`.
- The connected Seeker remains visible to macOS USB but absent from ADB. Enable
  USB debugging and accept the device authorization prompt to install via ADB,
  or download the APK on the phone for manual installation.
