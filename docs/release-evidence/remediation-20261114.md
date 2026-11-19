# Planner, dependency and mobile remediation — 14 November 2026

Status: source fixes verified locally; live traveler acceptance, current compiled
builds and native visual acceptance remain open. Do not merge on this report.

## Planner

The compiler now screens complete proposed days while selecting visits, including
meal windows, inter-event buffers, traveler availability and supplied visit
windows. Previously that allocation check ran only for requested midday rest;
ordinary days could retain a known dinner conflict. Infeasible visits remain
unscheduled rather than being shortened or displacing meals.

The app's staging compiled workflow can now request one focused dining inventory
retry (at most 12 candidates for at most eight area targets). Existing closure,
identity and distance screens still apply; an unresolved gap stays visible.
Repaired restaurants are included in persistence alongside saved meal references.
Frozen-inventory aggregator replays do not opt in and cannot silently incur this
additional call. Generated candidates still need factual and suitability review.
This remains a staging experiment, not general production grounding.

[Pure compiler replay](compiler-regression-20261114.json) covers 12 frozen
**development** cases / 42 days: zero timing conflicts, 30 missing meal slots
across six cases and one activity-supply gap. It uses no paid calls, reviewed
hours/identity overlays or new inventory. It is not independent holdout or live
traveler acceptance. Reproduce from the repository root with:

```sh
bun --no-env-file scripts/uat/evaluate-compiler.ts \
  artifacts/uat/traces/compiled-long-visit-explanations-20261031 \
  /tmp/new-compiler-report.json
```

The command refuses to overwrite a prior report.

## Dependencies

Updated Vitest to 4.1.12, provider-utils to 4.0.33, selector-parser to 6.1.5,
Zod to 4.6.6 (including Workflow's transitive copies), UUID to 11.1.1, and modern
consumers of glob/minimatch to 14.0.2/11.0.1. Legacy callback-based glob and
minimatch consumers retain their compatible versions. The web Zod migration
requires an explicit string key schema for notification settings.

Four reproducible Bun patches preserve APIs while addressing remaining findings:

- `decode-uri-component@0.2.2`: upstream 0.5.1 decoder, adapted to CommonJS and
  retaining the older plus-to-space behavior. [Advisory](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).
- `image-size@1.2.1`: reject invalid/non-progressing container and ICNS entry
  lengths while retaining Metro's callable API. [Container advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq),
  [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).
- `deepmerge@4.3.1`: create own data properties in source, CommonJS and UMD
  implementations, avoiding the prototype setter when copying an own
  `__proto__` key. Upstream has no published fixed version in the
  [advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
- `nanoid@5.1.6`: backport 5.1.16's pool error handling and non-secure loop bound,
  preserving the old `customRandom` implementation required for Workflow replay.
  [Pool advisory](https://github.com/advisories/GHSA-xwg4-73v4-xw9w),
  [non-secure advisory](https://github.com/advisories/GHSA-28wg-ghj8-5hjv).

The version-based audit still reports seven entries across these four patched
packages. Do not describe this as a zero-finding audit or suppress their warnings.
`dependency-security.test.mjs` exercises resolved consumer dependencies and
runs malformed inputs in Node subprocesses with timeouts. Workflow's deterministic
ID sequence and serializer checks pass. All eight patched source files match a
clean isolated installation. Compiled/native verification remains necessary;
these are maintained backports, not upstream package-version upgrades.

## Mobile

Replaced the affected inspiration/vibe emoji with the already-bundled Ionicons
set. Decorative icons are hidden from accessibility and control labels remain.
No new font package is required. The keyboard fix from the earlier candidate and
these icon changes still need a fresh iOS artifact and visual acceptance.

## Verification

Using Bun 1.4.4 with automatic environment loading disabled:

- Web `vitest run`: 188 files / 1,729 tests passed, with loopback access for the
  six HTTP harness tests. Run from `apps/web`, not the repository-root `test`
  script when selecting web test files; the root script dispatches all workspaces.
- Mobile `jest --runInBand`: 70 suites / 725 tests passed after icon changes.
- `bun test scripts/__tests__`: 260 tests passed, including backport and replay
  regressions. Scripts TypeScript passed.
- Repository `bun run check`: 11 tasks passed, zero lint errors and nine existing
  warnings. Final source formatting/type checks must remain green before commit.
- Mobile preflight: staging identity guards, directly reachable healthy JSON API,
  all 79 catalog images, Java and Android SDK passed. This checks the configured
  fixture staging origin, not a new deployment of this candidate.
- Disk: 4.8 GiB free at inspection; local native build minimum remains 12 GiB.
  No Android/Apple device was visible. No cloud build or new preview was submitted.

## Acceptance still required

A new simulator source upload/build and a new protected staging preview with
credentials need the pending bounded approval. Reconcile the existing $20
allowance before a live retry; the prior settled total was $9.83443185. Preserve
failed results and stop the batch on the first failure. The dining repair may
add one inventory call, and must be included in actual usage/cost accounting.

Do not claim meal supply is resolved until saved plans pass evaluation and factual
review. Current native authenticated/recovery/offline/OAuth/accessibility flows,
operational recovery, live rate enforcement, alerting and email delivery remain
unverified. No production settings, credentials, deployment or merge changed.
