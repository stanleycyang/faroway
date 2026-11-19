# Production acceptance

Use one release commit, immutable web deployment, iOS build number and Android
version code throughout acceptance. Record the artifact identities with every
result. A checked box requires observed evidence; older reports are baselines.

See the [October 20 checkpoint](release-evidence/production-readiness-20261020.md)
for the current local results and read-only hosted observations.

The [October 28 production cutover receipt](release-evidence/production-cutover-20261028.json) records the completed web/database rollout, installed migration identities, preservation checks and remaining configuration/device limitations. Earlier checkpoints remain historical evidence.

## Automated release gate

Run in a worktree without application dotenv files:

```bash
bun install --frozen-lockfile
cd apps/web
bunx playwright install chromium
cd ../..
bash scripts/verify-release-local.sh
```

Docker must be running. The script checks quality, unit/script tests, the offline
planning rubric, seven disposable PostgreSQL suites, synthetic desktop/mobile
planning, checkout and recovery browser journeys and the standalone production web build. The build uses local
dummy Supabase inputs, an empty read-only local catalog, and normal production
font downloads; it does not validate hosted credentials or production content.
Its output is verification-only and must never be deployed. The synthetic
browser build uses offline font fixtures.
The offline rubric does not establish actual model quality. The browser mobile
viewport does not establish native readiness.

The `Release Verification` workflow runs on pull requests from `release/` branches
or carrying the `release-verification` label, and reruns when their source changes.
It also supports manual dispatch. Logs and browser failure artifacts are retained
for seven days. Normal PR CI remains unchanged to preserve the existing runner
cost policy. Use a `release/` source branch for the final release so label removal
cannot disable the check. Configure repository protection to require
`Release acceptance` for the release process; adding this YAML alone does not
change GitHub branch protection. Require a successful run on the latest source,
not a skipped job or an older revision.

## Hosted staging journeys

First verify the immutable deployment uses `faroway-staging`
(`omovikloadpvzijoaqus`) for both client and server access. Resolve its deployment
ID and Git SHA before testing: a branch alias can still point to an older build
after a successful preview build. Record the immutable deployment identity;
never count a healthy alias as evidence for a different candidate. Use disposable accounts
A and B. Keep optional providers and push delivery disabled unless included in
the accepted launch scope. Use synthetic private data and avoid live bookings.

| Check           | Acceptance evidence                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth            | Signup/confirmation, sign-in/out, session expiry and password-reset link complete on the same deployment. Reset email arrives and the new password works.                                                   |
| Create/recovery | Create a trip; reload during generation; interrupt the response and reconnect. One trip, search and paid dispatch survive, with a completed plan or actionable failure.                                     |
| Persistence     | Reopen the saved trip after restart and in a second session; dates, travelers, currencies and transport identity agree. A failed retry preserves the last saved plan.                                       |
| Ownership       | B's direct authenticated GET/PATCH/DELETE requests for A's trip are denied without data disclosure or mutation. Check shared/revoked reads separately.                                                      |
| Concurrency     | Two sessions edit the same revision. The stale writer sees a conflict and can compare/reapply/discard without silently losing the newer edit.                                                               |
| Sharing         | Decline consent, enable, open as a guest, revoke and reopen the identical URL. Revocation removes public access; stale requests cannot restore it.                                                          |
| Deletion        | Delete a disposable account through the app. Private trip access, queued writes and push registration stop; interruption/retry finishes safely. Test Apple revocation with a real Apple account if enabled. |

Record HTTP status, redacted response, before/after row counts and deployment SHA.
Never store passwords, access tokens, recovery links or provider keys in evidence.

## Live planning quality

Use a newly confirmed bounded test budget; historical temporary Gateway keys and
spend allowances are not proof of current access. Run sequentially and record cost
and latency for each case. Include a normal city break, family with children,
dietary requirements, step-free/slow-paced travel, tight budget and sparse supply.

For every output, check calendar dates and time zones, party composition,
geographic grouping and travel time, daily pacing, explicit constraints, currency,
unknown prices and estimates. Verify a sample of venue facts against permitted
sources. Generic fallback output must be disclosed and recoverable. Include
provider timeout, partial output and retry, and verify no duplicate paid dispatch.
Saved-plan smoke must reject malformed, stale or explicitly conflicting timing
proposals even when titles, dates and meal counts are valid. A valid proposed
timetable still does not verify actual travel or venue hours.
Do not treat fixture calibration or an HTTP 200 as a quality pass. Restore the
staging planning pause after the exercise.

### AI authentication and false-success gate

A healthy API and a `planned` trip status do not establish that model calls work.
Before handing a QA backend to device testers, verify one authorized bounded
request against the exact deployment, inspect its workflow logs for Gateway
unauthenticated errors, and inspect saved activity/dining counts and provenance.
If model stages fail and only deterministic enrichment remains, fail acceptance
regardless of the completed workflow/status. Repair AI authentication independently
of optional supplier credentials; missing vendor configuration must not obscure
an unauthenticated core planning pipeline. Existing fallback trips are evidence
of the failure, not a reason to regenerate automatically or spend another budget.

For launch-path acceptance, disable `FAROWAY_SCHEDULE_EXPERIMENT` and clear
staging-only `PLANNING_MODEL_AGGREGATOR`, `PLANNING_THINKING_AGGREGATOR` and
`PLANNING_MAX_OUTPUT_TOKENS_AGGREGATOR` overrides. Record the exact immutable
deployment and effective profile with each receipt. An experimental compiler
pass or a capped-token experiment is not a pass for the default production path.
Do not dispatch a paid check while its target deployment/profile is ambiguous.

### Supplier-backed experience acceptance

Supplier acceptance is opt-in with `--brief tokyo-vendor-experiences` on the
staging smoke runner. Keep provider-specific briefs out of the default model
comparison batch: adding one must not silently expand paid dispatches. The live
vendor brief requires the independently configured `VIATOR_PARTNER_ID` before
any authentication or generation request; never derive the expected account
from the returned booking URL.

A saved plan must contain at least two distinct Viator experiences, with supplier
IDs, HTTPS photo URLs and valid attributed handoffs to that configured partner.
Repeated IDs or product paths, missing photos, generic planning ideas and links
to another account fail this contract. Photo URL presence is not successful image
delivery: separately download/decode and visually inspect the supplied photos on
both devices. Verify the vendor request, provider availability, browser handoff
and partner reporting separately; metadata checks do not prove commission credit.
Do not infer working inventory from the existence of a dashboard API key. Verify
its deployment environment and branch scope before spending a live test budget.

## Signed-device acceptance

Use signed iOS and Android staging builds bound to the same isolated backend.
Record OS/device, install method and binary identity. Include a smaller/older
supported phone, larger text, screen reader and reduced-motion settings.

- [ ] Fresh install, cold start and upgrade retaining existing local trips.
- [ ] Google and Apple login, callback/cancel, logout, expired session and recovery.
- [ ] Create/generate, background/resume, force-close/relaunch and reconnect.
- [ ] Airplane-mode read/edit/delete, reconnect, two-device conflict and account switch without cross-account queued writes.
- [ ] Deep links and public sharing through the native share sheet/clipboard.
- [ ] Keyboard, safe areas, Android back navigation, readable errors and accessible controls.
- [ ] Account deletion and provider revocation through the supported account flows.
- [ ] If enabled: push allow/deny/revoke, foreground/background/terminated delivery and notification-tap routing; verify opt-out stops delivery.

`bun run release:check:mobile` must pass with the intended release configuration.
Expo Doctor and static config checks are necessary but do not replace these tests.

## Production cutover and operations

Follow the dependency order and rollback limits in
[release-verification.md](release-verification.md) and
[release-approval-checklist.md](release-approval-checklist.md), reconciling their
historical branch snapshots with the current migration ledger. Do not blanket-push
migrations or replay the staging bootstrap on production.

- [ ] Reconcile actual schema/functions/grants and every hosted/local migration identity, including production-only changes.
- [ ] Record backup/PITR availability and a successful disposable restore rehearsal.
- [ ] Rehearse exact SQL against the current schema, measure lock bounds, and identify the compatible paused rollback artifact.
- [ ] Verify deployment hold, planning/editing pause, old HTTP writers, cron jobs and positive durable-workflow drain.
- [ ] Complete the reviewed migration/application sequence, verify security permissions, then run a bounded approved production canary before unpausing.
- [ ] Verify Sentry receives a tagged test error from web and signed native builds, source maps resolve, and the intended operator receives alerts.
- [ ] Observe generation latency/failure rate, API errors, AI spend and rate limits; define who pauses planning and how to roll back.
- [ ] Verify production recovery/confirmation email, support contact, privacy/deletion disclosures, store privacy/data-safety forms and reviewer access.

Commercial checkout has separate supplier approval, live quote, final-price,
attribution and cancellation/refund acceptance. Keep it outside the initial launch
unless those checks pass. A sandbox quote or tracked click is not a booking.

Latest scoped observations: [staging and native acceptance, October 20](release-evidence/staging-mobile-20261020.md).
AI quality gates: [evaluation strategy](ai-evaluation-strategy.md).

Local OAuth-independent testing: [mobile harness](mobile-testing.md) and
[verified local evidence](release-evidence/local-mobile-testing-20261020.md).
