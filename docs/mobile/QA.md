# Mobile QA preparation

For the configured Android UAT build, staging accounts, and repeatable API/device
commands, see [Android UAT](UAT.md).

Use the `qa` EAS profile for physical devices and `qa-simulator` for iOS
simulators. These are release-mode builds, not Expo Go or development clients.
Production store submission is a separate step.

## Select and verify the source

Run from the repository root. Fetch before checking whether the current test
branch contains the latest integrated release source:

```bash
git fetch origin
git status --short --branch
git merge-base --is-ancestor origin/main HEAD
```

The final command must exit successfully. Preserve existing local QA changes;
switching to an older local `main` branch can omit integrated fixes. Keep the
working tree used for the build available for review, including uncommitted
config plugins and assets. Do not infer artifact contents from a commit hash
alone when EAS builds include uncommitted changes.

For an iPhone, complete the direct staging API preflight and Apple ad hoc
signing/device registration before `bun run qa:mobile cloud-ios`. Open the
resulting EAS build's installation link on the registered iPhone. A
`cloud-ios-simulator` build cannot be installed on a physical device. For
TestFlight, use the production store build and separate submission flow in
[RELEASE.md](../../apps/mobile/RELEASE.md).

## Environment isolation

The shared EAS `preview` environment can contain production settings. The QA
profiles override the public API/database URLs and set `EXPO_PUBLIC_MOBILE_QA=1`.
They use the separately scoped `EXPO_PUBLIC_QA_SUPABASE_ANON_KEY`, never the
ordinary public key as a fallback. Set that variable in EAS preview with the
isolated staging project's public **anon** key. Never use a service-role key.
The Expo config rejects a mismatched project, API origin, missing key or
non-anon JWT. Key decoding detects configuration mistakes; it does not replace
server-side JWT verification or RLS.

Always use the wrapper below. EAS evaluates the Expo config before fetching
remote profile variables, so a direct `eas build --profile qa` can fail before
loading the staging key. `env:exec` supplies it in memory without writing dotenv
files. The wrapper disables local dotenv loading for Expo subprocesses.

```bash
bun run qa:mobile preflight
bun run qa:mobile export
bun run qa:mobile prebuild
bun run qa:mobile pods
bun run qa:mobile cloud-android
bun run qa:mobile cloud-ios-simulator
bun run qa:mobile cloud-ios
bun run qa:mobile smoke # after installing the QA build on an Android device or iOS simulator
```

Preflight checks key/project isolation, device visibility, disk space and direct
JSON health access. A Vercel SSO redirect is a failed native API preflight even
when the web preview works in a signed-in browser. Configure a staging-only
mobile-accessible hostname and verify its database binding before changing the
QA API origin in both `eas.json` and the Expo config guard. Keep production
domains, credentials and protection settings intact. DNS verification alone
does not prove application reachability or environment isolation.

Native local builds and cloud commands repeat the direct API health check and
stop before building or submitting if it redirects, fails, or returns anything
other than the expected healthy JSON response. Exports and config preparation
remain available while staging access is being resolved. The pinned preview
origin is a candidate, not evidence of device readiness; do not bypass Vercel
protection by embedding credentials in the mobile app.

Android cloud submissions validate the private local signing configuration and
keystore before EAS can increment the build version or upload. Restore the
existing QA key when missing; do not substitute debug or production signing.
This file check does not validate the keystore password or certificate.

Cloud commands use existing credentials, prevent credential mutation, and never
submit to stores. Check `eas account:usage testimonio --non-interactive` before
queueing builds. A physical iOS build needs an Apple distribution certificate
and an ad hoc provisioning profile containing the test device UDIDs; a simulator
build does not establish physical-device signing readiness.

Inspect an existing cloud build from `apps/mobile` with
`eas build:view <build-id> --json`. Even with an explicit build ID, running this
at the monorepo root can report that the EAS project is not configured; use the
existing mobile project context rather than running `eas init` again. Preserve
the build ID and inspect that same build until it reaches a terminal status.
Build log URLs can return Brotli-compressed responses; use an HTTP client with
automatic content decoding (for example Node `fetch().text()`), rather than
assuming UTF-8 or gzip. Artifact hosts can also reject Python urllib while Node
`fetch` succeeds; use the installed Node HTTP client for approved downloads, check
status before writing, and record a SHA-256. Keep signed URLs and environment
values out of reports.

## Local prerequisites

### Physical Android visibility

Before starting a test, check `adb devices -l` and select the exact device
serial. An empty list means the phone is not available to the test runner;
`unauthorized` requires accepting the phone's USB-debugging authorization.
Check the Mac's USB inventory separately when the list is empty. If the phone
is absent there too, unlock it and test a direct USB data cable connection,
select File transfer if offered, and verify USB debugging in Developer options.
Repeatedly restarting ADB does not establish a missing physical USB connection.
Preserve pairing records and other connected-device sessions while diagnosing.

### First physical iPhone signing setup

USB pairing and Developer Mode do not register the phone for an EAS ad hoc
build. From `apps/mobile`, run `eas device:create` interactively and register
the connected iPhone with the Apple Developer team that owns this app. If the
account offers multiple teams, select the intended app owner consistently for
device registration and signing. Complete Apple login and two-factor prompts
locally; never paste passwords or verification codes into agent chat.

The Expo project owner and Apple Developer login are separate identities. Keep
the existing `testimonio` Expo project; explicitly choose the intended Apple
Developer account rather than assuming the CLI's suggested email owns the
signing team. After identifying the team, use
`eas device:list --apple-team-id <TEAM_ID> --json --non-interactive` to verify
the registered UDID without an interactive team-selection prompt.

Configure credentials with the staging environment loaded before Expo evaluates
the QA config:

```bash
cd /Users/stanleyyang/workspace/faroway/apps/mobile
eas env:exec preview 'EXPO_NO_DOTENV=1 EXPO_PUBLIC_MOBILE_QA=1 EXPO_PUBLIC_SUPABASE_URL=https://omovikloadpvzijoaqus.supabase.co EXPO_PUBLIC_API_URL=https://faroway-git-verify-staging-readiness-20261018-testimonio.vercel.app eas credentials -p ios'
```

Select `qa`, sign in to Apple, and use **Build Credentials** to configure the
distribution certificate and ad hoc provisioning profile for
`ai.faroway.app.qa`, including the registered iPhone. Reuse an appropriate valid
certificate when offered; do not revoke shared certificates. This command
configures signing but does not submit a cloud build. After setup, rerun
preflight and the allowance check above before a separately authorized
`cloud-ios` submission. Keep credentials in EAS; no local credential export is
needed.

### Physical iPhone UI automation

Ad hoc app signing enables installation; it does not configure automated UI
control. The existing Maestro flows cover Android and iOS simulators. For
physical iPhone automation with Appium/XCUITest, configure a separately signed
WebDriverAgent runner using an Apple Development identity and a distinct runner
bundle identifier on the intended team. EAS's remotely managed distribution
certificate does not establish a local development signing identity.

Check the XCUITest driver's `peerDependencies` against the Appium server version
before installation; the newest driver can require a beta server even when
the newest stable server is installed. Keep device tooling outside the app's
dependencies and bind the automation server to loopback.

Sign in locally through Xcode Settings > Apple Accounts and verify Developer
Mode, pairing, and the exact device UDID before starting the runner. On the
iPhone, also enable Settings > Developer > Enable UI Automation and complete
device-side authentication. Developer Mode alone does not authorize UI tests;
`Authentication canceled` during runner initialization requires checking this
separate authorization before retrying. Respect
the workstation's disk admission limits before tool installation or local
native builds; do not remove current-device support files to make room. Verify
launch, UI inspection, tap, and text entry on the physical QA app before
claiming that agent-driven device QA is available.

For a WebDriverAgent `xcodebuild` exit 65, inspect the `.xcresult` build issues
as well as the test summary. A missing runner can produce a secondary
CoreDevice sandbox/bookmark error; check signing errors before changing
filesystem permissions or security settings. Recheck local signing identities
after Xcode's first provisioning attempt, which can create the development
certificate even if that attempt fails.

Every EAS build profile explicitly pins `bun` to the root `packageManager`
version. Keep these synchronized when updating the package manager: an older
image default can reject the committed lockfile before native compilation.
`bun scripts/check-eas-release.ts` checks this alignment. Do not regenerate or
unfreeze the lockfile to work around a mismatched build runtime.

Local native builds validate the generated project ID and deep-link scheme as
well as Expo configuration. Existing `ios/` and `android/` folders can retain a
production identity from an earlier prebuild; `run:ios` does not reliably refresh
them. Run `bun run qa:mobile prebuild` before retrying an identity-guard failure.
Do not bypass the guard or install a production-identified build for QA.
The Android app-link plugin removes opposite-environment Faroway schemes during
incremental prebuild, which otherwise retains old schemes. OAuth and HTTPS
schemes are preserved. Validate generated output before installing either app.

The runner selects Homebrew Java 17 and the Android command-line SDK without
changing the user's shell configuration. Android needs platform 36, build tools
36.0.0 and platform-tools. Maestro also requires Java. Native local builds need
at least 12 GiB free before starting; SDK/NDK downloads, CocoaPods, Gradle caches
and Xcode output can require more. Failed downloads can consume substantial
space: remove only confirmed task-created partial downloads, never unrelated
SDKs, worktrees or project data.

```bash
bun run qa:mobile android       # arm64 release APK; run prebuild first
xcrun simctl list devices available
FAROWAY_QA_IOS_DEVICE="<simulator name or UDID>" bun run qa:mobile ios-simulator
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home maestro --version
adb devices -l
xcrun devicectl list devices
```

If USB detects an iPhone but `devicectl`, `xctrace` and `idevice_id` do not,
check the Mac's console lock state before repeatedly asking the owner to trust
the computer. Unlock both the Mac desktop and the iPhone, then recheck. A locked
Mac can also make native UI automation return `cgWindowNotFound`, even for
running apps. `ioreg -n Root -d 1 -a` exposes `IOConsoleUsers` and
`CGSSessionScreenIsLocked`; extract only that boolean rather than printing the
whole console or USB metadata. If the Mac is unlocked and discovery still
fails, investigate the data cable/hub and pairing service separately.
Open Xcode's Devices window (`Cmd+Shift+2`) to distinguish a missing device from
a visible device with Developer Mode or provisioning errors. If all device
discovery clients are empty while the USB tree shows a hub connection, test a
direct Mac USB data connection next. Do not reset existing trust records merely
because discovery is empty. A SIP-protected `usbmuxd` restart is not a reason to
change SIP settings.

Expo prebuild evaluates only `app.config.ts` as TypeScript; imported config
plugins must be executable JavaScript unless a separate TS loader is installed.
The Google Sign-In plugin scopes modular headers to GoogleUtilities and
RecaptchaInterop for the Swift AppCheckCore dependency. Verify with a real
`pod install`; passing JS exports or unit tests does not verify CocoaPods.

## Device acceptance matrix

Use confirmed staging accounts A/B and synthetic trips. Enter passwords on the
devices or through an approved secret manager; never put them in flow files,
screenshots, reports or CLI arguments. Do not clear an existing app's local data
without checking whether the device contains real traveler data.

| Area          | Required evidence                                                                 |
| ------------- | --------------------------------------------------------------------------------- |
| Install/start | Exact artifact/version, fresh launch, relaunch, upgrade, no crash                 |
| Auth          | Email, Google, Apple on iOS, cancel/error, refresh, logout, account switch        |
| Planning      | Guest draft, required fields, dates, travelers, consent, authenticated generation |
| Recovery      | Background/foreground, interrupted request, retry, cached trip reopening          |
| Data          | Create/read/edit/delete, sharing/revocation, export and booking handoff           |
| Privacy       | Account B cannot read/edit/delete A's trip; logout removes A's local state        |
| Offline       | Cached reads, queued edits/deletion, reconnect, conflicts and retained intent     |
| OS            | Keyboard/safe areas, text scaling, reduced motion, back navigation, deep links    |
| Push          | Consent, registration, foreground/background/cold-start delivery and opt-out      |
| Deletion      | Disposable account deletion, device cleanup and Apple revocation if applicable    |

Live AI, supplier requests, Apple revocation and push delivery need their actual
configured services. Record paused/disabled features as untested, not passed.
Physical push checks require signed device builds; simulator/Expo Go results are
insufficient. Finish with a per-platform evidence report separating local,
fixture-backed, hosted and physical-device results.

For keyboard acceptance, show the simulator's software keyboard explicitly.
Hardware-keyboard text injection alone can hide it and falsely pass layout
checks. Focus a lower multiline field, type using an on-screen key, and verify
that the caret and entered text remain visible. Repeat for allergies, dietary
preferences and mobility notes, then dismiss the keyboard and check the footer.
If multiple Simulator windows are open, select the recorded device by name
before each interaction and avoid concurrent UI drivers on that device.

The prepared Maestro startup flow opens and closes the planner without entering
credentials, clearing local data, saving a trip or requesting AI. Its XML/debug
output goes to ignored `artifacts/mobile-qa/maestro`. It is a startup smoke test,
not evidence that authenticated planning or physical iOS flows work. Check that
the installed app is the QA artifact before running it.

## Regression gates

```bash
bun run check
bun run test
python3 scripts/test-staging-bootstrap.py
python3 scripts/test-helper-search-paths.py
```

When adding a migration, register its hash in the follow-up inventory rather
than modifying the frozen approved bootstrap. Rehearse both deterministic
bootstrap rendering and the new follow-up's behavior/privileges on disposable
PostgreSQL. Never replay a fresh-install bundle on populated hosted staging.

## Offline display and storage regressions

Exercise nested API itineraries through background sync as well as direct detail
loading. Both paths must use the shared day/hotel normalization, retain supplied
photos and traveler needs, and clear stale plans. Test a failed confirmed-copy
write before deleting a local draft; verify the saved draft and pending request
identity independently, since the merged UI can reconstruct a missing saved
copy from a queued mutation.

For storage-failure tests, seed the saved-trip cache explicitly: queueCreate
stores a pending snapshot rather than a saved copy. Supply complete API receipt
fixtures, including created_at, so a subsequent cache read tests valid data.
The account-scoped storage facade wraps methods; spy on the underlying prototype
when injecting a one-shot failure, and always restore the spy.

## Android system prompts and text size

An optional password-manager save sheet can cover the app after successful QA
sign-in. Decline saving disposable credentials; do not count a covered-control
timeout as a login failure. The native runner narrowly recognizes the observed
1Password save sheet and chooses its enabled “No thanks” action only. Unknown
prompts still require inspection. Verify the chosen staging account has a saved
itinerary before running saved-trip assertions; an empty account is a test-data
precondition, not permission to generate a paid trip.

For Android text-size checks, record the original font scale and restore it in
a finally block. Capture both the configuration transition and a cold launch
at the requested scale: activity recreation can briefly show stale measurements.
Report transition clipping separately from persistent layout failures.

### Image and first-run acceptance

A successful storage HEAD response is not image acceptance. Check the actual API
payload used by the screen, normalize/cache round-trip, full image delivery and
decoding, and visible content at the expected place. Record absent sources separately
from network failures or incorrect images. A fallback placeholder is graceful failure,
not a passing photograph. Never attach an unrelated venue's photo to fill a gap.

First-run QA must include offline first paint, guest exploration, destination handoff,
custom destination entry, returning users, attribution, and scrolling/wrapping at
small widths and larger native text. Source-rendered web previews are useful layout
evidence but do not replace installed-device acceptance.
