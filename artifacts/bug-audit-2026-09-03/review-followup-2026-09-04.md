# Review regression follow-up — September 4, 2026

Scope: the five supplied P2 findings and directly related contract failures. Existing unrelated working-tree changes were preserved. No deployment, production account deletion, dependency upgrade, or database migration was performed.

## Fixes and regression coverage

1. **Legacy workflow polling.** Shared generation now returns `workflowId` and `statusUrl` alongside `searchId` and `streamUrl`, and persists a `workflow_runs` row before scheduling work. New public workflow IDs use the corresponding search ID as an opaque correlation key; previously stored runtime-generated IDs still work with the unchanged lookup contract. Completion/failure updates target that exact run, not every active run for the trip. Failure reporting is client-safe, and itinerary persistence failures cannot be reported as completed. A stateful database test exercises the real compatibility handler, canonical handler, planning workflow, and polling handler together. It covers running → completed/failed, itinerary results, startup/storage failures, ownership, rate limits, conflicts, and isolation from older runs.
2. **Account deletion authentication.** Both route aliases use the existing verified cookie-or-bearer authentication helper. SDK-boundary tests exercise the actual transport selection and verification path, including invalid identities, invalid bearer tokens alongside valid cookies, rate limits, deletion ordering, and data/credential deletion failures. No real accounts are deleted by these tests.
3. **Trip update serialization.** The shared mobile serializer preserves `start_date`, `end_date`, and `status`, accepts the supported canonical budget/preference fields, and documents canonical date/budget precedence over aliases. The API service uses that input type. Partial preference patches merge with stored preferences. Tests feed the real mobile serializer into the real web PATCH handler and verify persisted update arguments. The server still rejects client-controlled lifecycle transitions other than `draft`.
4. **Backup compatibility.** Removed import-only limits that contradicted the editor for notes, city/profile names, profile count, and photo length; visit counts accept the nonnegative values the editor permits. Structural validation, ISO matching, safe image types, and the 5 MB upload limit remain. Tests round-trip the actual store/export path, retain long notes in version-one and standalone-profile backups, and reject malformed values. A production-browser regression covers saving long notes in the editor, downloading the backup, rejecting an oversized upload, and restoring the downloaded file.
5. **Autocomplete fallback.** Only the caller's aborted signal suppresses results. Deadline, network, HTTP, and malformed-response failures fall back to local destinations. Results that settle after cancellation cannot overwrite newer suggestions. Fake-timer tests exercise the hook's callbacks and actual timeout wrapper with controlled fetches; state writes are captured through a lightweight React server-render harness (not a native-device UI test).

## Verification

- Web: `bunx vitest run` — 449 tests passed.
- Mobile: `bunx jest --runInBand --coverage=false` — 170 tests passed.
- Shared packages: `bunx turbo test --force --filter='!@faroway/mobile' --filter='!@faroway/web'` — 103 tests passed.
- Scripts: `bun run test:scripts` — 3 tests passed.
- Total: 725 passing unit/integration tests, 40 more than the prior recorded baseline.
- Workspace: `bunx turbo type-check lint format:check --force` — 11/11 tasks passed after correcting workflow-file formatting.
- Production build: `bunx next build` — passed, 1,414 static pages generated.
- Production browser/API: `CI=1 E2E_BASE_URL=http://localhost:3107 bunx playwright test --retries=0` — 72/72 passed across Chromium, Mobile Safari, and Mobile Chrome against a fresh local production server. The initial run was 65/66: a Safari test selected the first country before the filtered results updated. The test now explicitly selects Japan and checks its heading; the complete rerun passed without retries. Two additional signed-out deletion-route checks run on all three browser projects.
- CI: existing unit-test discovery includes the new regressions. The production-build job now installs Chromium/WebKit and runs the backup round-trip and protected-route browser tests against its built server. GitHub Actions execution itself was not run here.
- Whitespace: `git diff --check` — passed.

## Limits

These changes and tests close the supplied findings; they do not establish that every bug has been eliminated. Authenticated workflow and deletion tests use mocked external SDK/database boundaries. Live Supabase policies, deployed durable-workflow execution, vendor services, production credentials, and native iOS/Android behavior were not reverified in this follow-up. Previously documented deployment/account blockers remain unverified rather than assumed resolved. Dependency advisories were not re-audited; the earlier report's unsupported no-advisories assertion has been withdrawn.
