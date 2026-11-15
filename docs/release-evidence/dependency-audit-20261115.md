# Dependency audit — 15 November 2026

`bun audit` with the pinned Bun 1.4.4, after `bun install --frozen-lockfile`,
reports 7 findings: 5 high, 1 moderate, 1 low. They are the four packages
already covered by `patchedDependencies`. The lockfile was not regenerated.

Draft PR #55's "26 findings (15 high, 8 moderate, 3 low)" and the July
`PROD_AUDIT.md` total of 42 are earlier snapshots. The 14 November workflow
note (20 findings) is also older than this install. This note does not claim
a clean audit. `bun audit` matches declared versions, so a maintained backport
still counts.

| Package              | Installed                        | Findings                                                                                 | Why it stays                                                                                                                                                                                                                                                                                                                    |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| decode-uri-component | 0.2.2                            | high GHSA-qr28-fpjm-wq7f (`<=0.5.0`), moderate GHSA-vcc3-ghjq-m6fr (`<=0.4.2`)           | query-string 7.1.3, required by React Navigation and Expo Router. It decodes mobile URLs. The patch keeps plus-to-space decoding and bounds malformed runs. `scripts/__tests__/dependency-security.test.mjs` covers both.                                                                                                       |
| deepmerge            | 4.3.1                            | low GHSA-gcqx-w48m-w2h4 (`>=4.2.0 <=4.3.1`)                                              | `@expo/config` and Jest. Not on the trip-planning request path. No upstream release past 4.3.1. The patch refuses `__proto__` pollution.                                                                                                                                                                                        |
| image-size           | 1.2.1                            | high GHSA-5p2g-fcmc-qvqq and GHSA-w3rx-r6r6-pgpr (both through 2.0.2)                    | Metro 0.83.3, used while bundling the app. It does not parse traveler uploads. The patch rejects non-progressing ICNS, HEIF, and JXL boxes. A version inside the advisory range would not clear the audit.                                                                                                                      |
| nanoid               | 5.1.6 via `@workflow/core` 4.6.2 | high GHSA-28wg-ghj8-5hjv (`>=4.0.0 <5.1.16`) and GHSA-xwg4-73v4-xw9w (`>=4.0.0 <5.1.11`) | Workflow calls `customRandom` with length 21. A 5.1.16 override changes those IDs and breaks replay, which is why the earlier override was rejected. The web app already depends on nanoid 5.1.16 directly. Navigation uses 3.3.18, outside these ranges. The patch rejects unsafe pool sizes. Do not override Workflow's copy. |

No other advisory was present in this audit, so there was no compatible
upgrade left to apply. Re-run `bun audit` when Expo, Metro, or Workflow
publishes a consumer that can take a fixed release.
