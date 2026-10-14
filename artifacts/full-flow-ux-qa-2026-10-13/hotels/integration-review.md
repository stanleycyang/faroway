# Saved hotel preferences and sandbox quotes

Scope: the complete hotel trip-flow feature, ported into the current account/retry-safe implementation. Existing unrelated original-checkout changes remain untouched. This is a focused final-diff review; the frozen ten-journey acceptance packet remains the release authority.

## Changes and resolved findings

- Create/edit briefs persist explicit nationality, destination country, room occupancy, children’s ages and versioned supplier consent. Complete preferences survive same-tab planner reload and sign-in draft handoff.
- Quote requests use saved trip details and a matching revision, enforce ownership and rate limits, and recheck authentication and revision after supplier completion. Caller-supplied guest overrides are ignored.
- The mounted UI rejects malformed nested prices, wrong trip/revision and non-sandbox replies. Account replacement, same-owner reauthentication, unmount and stalled response bodies abort or discard requests. An immediate lock prevents duplicate same-tick submissions.
- The old database trigger retained previous hotel preferences, including withdrawn consent. The new migration lets the versioned brief RPC update/clear hotel preferences while retaining protected receipt metadata and existing planning/share fences. Local SQL verifies edits, revocation, stale revision rejection and stranger rejection.
- Shared-trip responses omit hotel details; local full-schema owner/stranger/anonymous privacy checks also pass.
- Corrected the older quote normalizer’s multi-room selling-price floor. Offer-level minima apply to the combined stay; rate-level minima apply per room. Additional non-included taxes are shown separately. No unsupported cancellation promise is invented. Contract reference: https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure
- Fixed initial family-room adult counts, the planner restore omission, the consent label’s touch target and the two implementation type errors. Final lint reports no warnings.

## Local validation

| Check | Result | Evidence |
|---|---|---|
| Web regression | Passed | 131 files, 934 tests; final limited-worker run |
| Mobile regression | Passed | 57 suites, 601 tests; serial run |
| Constants / validation / API client | Passed | 59 / 44 / 33 tests |
| Script checks | Passed | 8 tests |
| Types, lint, formatting | Passed | 11 forced tasks; quality-summary.log |
| Production web build | Passed | Approved public staging configuration, hotel flag true, privileged key disabled; final build exit 0 |
| Persisted hotel edit/consent | Passed | database-check.log; real migration/RPC/trigger in network-isolated local Postgres; transaction rolled back |
| Existing RLS / RPC grants | Passed | privacy-check.log; fresh synthetic IDs avoid existing fixture collisions |
| Desktop/phone UI | Passed | browser-results.json and hotel-1440.png / hotel-390.png; actual components and compiled production CSS |

The initial unrestricted concurrent test run encountered timeouts; complete web and mobile suites passed with bounded workers. Browser fixture setup errors (missing process shim/UTF-8 and an incorrect expected friendly error string) were corrected before the successful run. They were fixture errors, not product regressions. Browser supplier/auth responses are synthetic. Preference changes remount the quote panel to model a saved revision; actual persisted revision and consent behavior is verified separately in SQL.

## Rollout and external gaps

`NEXT_PUBLIC_HOTEL_SEARCH_ENABLED` defaults off. Apply `20261014001000_hotel_brief_preferences.sql` after the registered recovery migrations before enabling it. The follow-up migration is pinned in the release-candidate manifest and has only been applied to the isolated local QA database. Hosted staging and production remain unapplied.

Searching also requires Vercel preview plus configured LiteAPI sandbox credentials. Production searches are rejected. No paid booking, prebooking, payment or cancellation implementation is added. Existing production and other branch configuration is untouched.

External verification required: hosted migration and sandbox credential activation, then a real authenticated sandbox search to verify supplier response compatibility. These are prerequisites to enabling this optional feature, not evidence currently claimed Passed. Existing signed-device/auth/real-planning/notifications/vendor-handoff acceptance gaps remain open. GitHub CI is waived by the user; local checks are required. PR remains draft until the frozen release acceptance gaps are verified or explicitly accepted.

## Follow-up backlog

Country/nationality selectors with friendly country names; room summaries with singular/plural copy; supplier images and richer amenity comparison; live inventory and full booking lifecycle. These do not expand the frozen release gates.
