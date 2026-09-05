# Production dependency assessment — September 4, 2026

Status: initial inventory and targeted call-site inspection, **not security clearance**. Owner: Codex. No dependency changes were made during this pass.

## Completed evidence

`bun audit` (Bun 1.3.9), run from the repository root, completed with exit code 1: **64 advisory entries: 41 high, 21 moderate, 2 low**, across 10 package names. Multiple entries can concern the same underlying advisory on different major-version ranges; these are not 64 independently demonstrated application exploits.

`bun audit --json` confirmed package names, affected ranges, severities and advisory links. Reading the current lockfile showed patched top-level dependencies alongside older transitive versions. Earlier claims of a clean audit must not be used as release evidence.

## Needs verification / remediation

| Package                | Locked versions observed                   | Initial context and next check                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `undici`               | 6.23.0, 6.28.0, 7.28.0                     | Older versions remain through Expo/workflow dependencies; AI SDK provider utilities already use 6.28.0. Identify deployed request/response paths and update within compatible major versions.                                               |
| `nanoid`               | 5.1.16, 5.1.6, 3.3.11, 3.3.16              | Direct web dependency is patched; workflow/navigation/PostCSS copies remain flagged. The app's direct callers use default size or constant 12, not an attacker-controlled size. Trace transitive generators and update compatible versions. |
| `decode-uri-component` | 0.2.2                                      | Included through Expo Router / query-string. The two inspected router call sites use `stringify`, not the vulnerable decoding operation; inspect other consumers before claiming a remotely reachable issue.                                |
| `js-yaml`              | 3.14.2, 4.1.1, 4.3.2                       | Old versions remain through gray-matter and tooling. The app-owned gray-matter import is a blog migration script reading repository MDX, not a public request handler. Update each compatible major and inspect all runtime consumers.      |
| `brace-expansion`      | 1.1.12, 2.0.2, 5.0.2, 5.0.6                | Multiple tooling trees; update without forcing incompatible export shapes across majors. Check whether any production path accepts user-defined glob patterns.                                                                              |
| `minimatch`            | 3.1.2, 3.1.5, 5.1.6, 9.0.5, 10.2.1, 10.2.5 | Patched and older versions coexist. Update compatible ranges and verify build/lint/workflow consumers.                                                                                                                                      |
| `picomatch`            | 2.3.1, 4.0.3, 4.0.5                        | Older nested Metro/Jest/Rollup/glob consumers remain. Trace any runtime pattern input; preserve major-version compatibility.                                                                                                                |
| `ws`                   | 6.2.3, 7.5.10, 8.19.0                      | Several native development/tooling paths. Identify whether any affected server is included in the deployed runtime, update supported branches, and retest native tooling.                                                                   |
| `image-size`           | 1.2.1                                      | Expo / React Native asset tooling. Verify accepted image formats and input origin; evaluate a compatible fix without silently breaking Metro's expected API.                                                                                |
| `uuid`                 | 7.0.3                                      | Expo dependencies. The advisory concerns specific generators with caller-provided buffers; inspect those call sites and compatibility before any major upgrade.                                                                             |

No exploit was reproduced in these limited checks. Absence of a reproduced exploit does not close the dependency gate.

## Remediation acceptance

1. Trace affected production and build-time consumers; record any concrete untrusted-input path separately from dependency inventory.
2. Prefer compatible patch/minor updates, preserving the existing worktree and lockfile changes. Avoid indiscriminate cross-major overrides.
3. Rerun the audit to completion. Any remaining advisory needs an explicit, evidence-backed disposition and release-owner acceptance; do not suppress the scanner globally.
4. Rerun unit/integration tests, quality checks, web production build/browser cases and mobile export/release checks after dependency changes. Installed-device verification is still required.
