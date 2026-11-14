# Local mobile integration testing

## Traveler requirements regression coverage

Native planner requirements must survive the complete path: text/checkbox input,
guest restoration, consent snapshot, pending-create restoration, saved API read,
offline cache and queued edits. Use the structured `requirements` object from the
saved-brief API; dietary preferences, allergies and access needs are distinct.
Validate without silently dropping invalid constraints. Canonicalize requirements
before persisting a creation receipt so restoration cannot change its serialized
body and prevent an idempotent retry after a lost response.

Focused regression suites are `TravelerRequirementsEditor`, `planningConsent`,
`guestTripBrief`, `tripCreationRecovery`, `offlineSyncPayload`, `useTrips` and
`generation-completion` under `apps/mobile/__tests__`. Component mocks establish
data/control behavior, not native accessibility or layout acceptance. On both
iOS and Android, enter multiple allergies, select access needs, add rest notes,
restore the brief after interruption, and compare the actual saved requirements.
Also check multiline keyboard access, large text, VoiceOver/TalkBack and error
correction before treating this feature as device-accepted.

Exercise multiple requirements edits within one render batch, including repeated
checkbox taps: each event must update the latest draft rather than overwrite
other fields from an older render. The web suite's
`mobile-requirements-contract.test.ts` checks native payloads against the actual
create/edit API schemas, including invalid constraints and explicit removal.
Cross-platform contract tests must import framework-independent data types from
`lib/tripTypes.ts`, not the native store or storage implementations. Even a
type-only store import makes TypeScript traverse native dependencies and can
introduce React Native global declarations into the web compiler. Keep payload
serializers independent of the store/storage runtime and run workspace
typechecks as well as the contract test after changing this boundary.

Run that contract with the Node-based Vitest runner from `apps/web`:

```sh
node ../../node_modules/vitest/vitest.mjs run __tests__/lib/mobile-requirements-contract.test.ts
```

Use the same Faroway app with real local Supabase sessions and a deterministic
itinerary fixture. This is not a fake authenticated user or an API auth bypass.
No Apple/Google setup or model/supplier keys are needed.

## Run

Prerequisites: Bun, Node, Docker-compatible container runtime, Expo Go compatible
with SDK 54, and an iOS simulator. Native automation additionally needs Maestro
and Java 17 or newer. This harness pins Supabase CLI 2.76.15 because the globally
installed CLI binary failed to execute on the current machine.

From the repository root:

```sh
bun run dev:mobile:test
```

The first run downloads local Supabase images and installs the frozen dependency
lockfile into a temporary copy of the apps. The launcher excludes dotenv files,
clears inherited provider credentials and uses a dedicated stack named
`faroway-mobile-test-stack`. It does not reset, stop or use other local projects.
App edits require restarting the launcher because its source is a snapshot.

- API: `http://127.0.0.1:3011`
- Expo: `exp://127.0.0.1:8092`
- Direct test login: `exp://127.0.0.1:8092/--/onboarding/login`
- Local Supabase API: `http://127.0.0.1:55421`

Two synthetic accounts (`owner@mobile-test.invalid` and
`other@mobile-test.invalid`) have randomly generated passwords stored in
`accounts.json` under the dedicated stack directory printed by the launcher.
The file is created with mode 0600. Do not commit it or use real credentials.
The accounts use real Auth tokens, normal session storage and the normal mobile
auth-state listener. No service-role key is supplied to mobile.

In a second terminal:

```sh
bun run test:mobile:integration
bun run test:mobile:native -- YOUR_SIMULATOR_UDID
```

The integration probe signs in through Auth, checks guest rejection, creates and
generates a synthetic trip through the actual application API, checks saved
content and denies a second account through both the API and direct database
RLS. It leaves the local synthetic trip available for mobile review. Each probe
run adds one trip in this disposable local database.

The Maestro flow opens the test login, signs in with the local owner, opens My
Trips and checks a saved fixture itinerary. Its screenshot is saved in the temporary artifact directory printed by the runner. Use an emulator with Expo Go
installed; the launcher does not install or erase apps. If `JAVA_HOME` is stale,
set it to an installed Java 17+ runtime before running Maestro.

## Failure scenarios

Stop the app launcher with Ctrl-C, then restart with a scenario:

```sh
bun run dev:mobile:test failure
bun run dev:mobile:test timeout
```

`success` saves a clearly labeled synthetic itinerary. `failure` records a
synthetic terminal error. `timeout` retains an unresolved generation claim, so
recovery must preserve the trip rather than dispatch duplicate work. These
fixtures test client recovery behavior; they do not prove real provider or
workflow failure recovery. The automated integration probe expects `success`.

The launcher turns SSE off for the mobile pass so generation is observed through
the real polling endpoint. Streaming, signed builds, OAuth, push delivery,
physical-device behavior and live AI quality still require separate acceptance.
This loopback harness targets iOS Simulator. Android emulator support requires
matching emulator-to-host endpoint configuration; physical phones cannot use
these loopback URLs.

## Production isolation

Test login requires all of: a development bundle, explicit
`EXPO_PUBLIC_TEST_LOGIN=true`, and loopback Auth/API endpoints. It stays hidden
for hosted staging and production. Mobile release checks and production Expo
configuration reject the flag. Credentials are entered through a labeled local
panel, never through a production user shortcut.

`FAROWAY_TEST_GENERATION` accepts only `success`, `failure` or `timeout`; it fails
closed outside development, on Vercel, or with a hosted Supabase URL. It runs only
after the normal route auth/ownership checks and active generation claim. It
saves through the existing generation-fencing RPC. It never creates a trusted
fake user or bypasses row-level security. Fixture itineraries include no real
venues, affiliate URLs, supplier quotes or booking actions.

Ctrl-C stops the two app processes but leaves the dedicated database for repeat
runs. To stop that stack, use the printed stack directory:

```sh
bunx supabase@2.76.15 stop --workdir /absolute/path/to/faroway-mobile-test-stack
```

Do not use `db reset` or `stop --no-backup` against unrelated projects. This
harness never links to a hosted Supabase project or deploys code.
