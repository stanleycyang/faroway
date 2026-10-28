# Mobile QA preparation

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

Cloud commands use existing credentials, prevent credential mutation, and never
submit to stores. Check `eas account:usage testimonio --non-interactive` before
queueing builds. A physical iOS build needs an Apple distribution certificate
and an ad hoc provisioning profile containing the test device UDIDs; a simulator
build does not establish physical-device signing readiness.

## Local prerequisites

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
