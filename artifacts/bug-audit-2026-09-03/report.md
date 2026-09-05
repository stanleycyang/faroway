# Faroway Production Bug Audit and Hardening Report

Date: 2026-09-03

Scope: web app, mobile app, shared packages, API routes, authentication, Supabase/RLS and functions, itinerary workflows, affiliate attribution/conversions, accessibility, configuration, dependencies, builds, and production browser journeys.

## Outcome

The September 3 pass addressed twenty-five defect groups, but its earlier claim that no discoverable P0-P2 defects remained was too strong. Subsequent review identified five P2 compatibility and fallback regressions despite passing checks. See [the September 4 follow-up](./review-followup-2026-09-04.md) for their fixes and additional behavioral tests. Passing checks provide bounded evidence, not proof that the app is bug-free.

The repository is not yet deployable as a production affiliate product because four required web secrets are absent, the new Supabase hardening migration has not been applied to the target project, and several optional inventory vendors are either unconfigured or not entitled. These are deployment/account blockers, not hidden code failures.

The following counts describe the initial pass, before the five review findings:

| Severity | Discovered | Fixed | Open in code |
| -------- | ---------: | ----: | -----------: |
| P0       |          0 |     0 |            0 |
| P1       |          5 |     5 |            0 |
| P2       |         18 |    18 |            0 |
| P3       |          2 |     2 |            0 |

## P1 fixes

1. Revoked public access to legacy `SECURITY DEFINER` functions that could expose or mutate push-token data; pinned function search paths and service-only privileges in `supabase/migrations/20260903000000_harden_legacy_security_definer_functions.sql`.
2. Prevented mobile offline edits and deletes from being discarded after three retries or overwritten by a subsequent server pull; manual retry remains available and new edits reset the retry budget.
3. Removed the Google Places key from the public mobile bundle and routed autocomplete, details, and static maps through bounded server endpoints.
4. Repaired the non-stream itinerary path so it persists the correct trip and itinerary records instead of writing a nonexistent `trips.itinerary` field.
5. Collapsed duplicate generation implementations into the owner-checked canonical route, preventing client-controlled legacy payloads from diverging from stored trip data.

## P2 fixes

1. Made affiliate conversions financially bounded, partner-matched, idempotent across retries, and failure-aware when click finalization fails.
2. Restricted affiliate links to declared HTTPS partner domains and stripped unowned trip/search attribution IDs.
3. Replaced provider, workflow, and stored internal errors with stable client-safe responses.
4. Tightened profile/account schemas, removed email mutation through profile PATCH, and routed account deletion through one implementation.
5. Stopped dashboard and private/shared trip loaders from representing database outages as empty accounts or 404s.
6. Added failure recovery when a trip cannot be linked to a generation search.
7. Fixed a production-only `NextRequest` private-state crash in the legacy workflow adapter while keeping its body stream intact.
8. Replaced the read-modify-write blog counter with an atomic RPC and bounded request fields.
9. Made abuse-sensitive rate limits distributed and fail-closed in production, with HMAC-hashed identifiers.
10. Added timeouts and controlled gateway errors to Places and provider requests.
11. Added mobile request timeouts, authenticated polling, encoded route IDs, and consistent network/timeout errors.
12. Normalized mobile create/update payloads to the strict server contract and preserved nested preferences during queued edits.
13. Made trip dates and provider-local flight times deterministic across user/server time zones.
14. Fixed dashboard logout: the UI now submits the route's required POST instead of navigating with a failing GET.
15. Fixed protected-route prefix matching and preserved query strings through authentication redirects.
16. Replaced unsafe World Map backup casts with bounded, migration-aware schema validation and a 5 MB input limit.
17. Cleared mobile navigation timers on unmount to prevent stale redirects and state updates.
18. Repaired accessible names and expanded/collapsed semantics for trip creation, FAQ, itinerary, navigation, dashboard filtering, and mobile input controls.

## P3 fixes

1. Updated the Sentry Next.js config import before its v11 removal.
2. Updated vulnerable/stale dependency resolutions and corrected the Expo vector-icons install mismatch. The previous no-advisories claim is withdrawn: completed audit output was not retained, and the September 4 compatibility follow-up did not reverify dependency advisories.

## Changed-file map

The working diff contains 109 tracked file changes (3,522 additions and 2,849 deletions) plus new regression/support files. The principal production changes are grouped below; the adjacent `__tests__` and `e2e` trees contain their regressions.

- Web/API: `apps/web/app/api/**`, `apps/web/app/(app)/**`, `apps/web/app/create/page.tsx`, `apps/web/proxy.ts`, and `apps/web/next.config.ts`.
- Itinerary and affiliate core: `apps/web/lib/affiliates/**`, `apps/web/lib/search/**`, `apps/web/lib/json-render/**`, `apps/web/workflows/plan-trip.ts`, and `apps/web/lib/trips/**`.
- Web UI/accessibility: `apps/web/components/Header.tsx`, `apps/web/components/dashboard/TripFilters.tsx`, `apps/web/components/support/FAQAccordion.tsx`, `apps/web/components/trips/**`, and `apps/web/components/tools/world-map/**`.
- Mobile: `apps/mobile/app/**`, `apps/mobile/components/ui/Input.tsx`, `apps/mobile/hooks/**`, `apps/mobile/lib/**`, `apps/mobile/services/**`, and `apps/mobile/stores/tripStore.ts`.
- Shared/configuration: `packages/types/src/index.ts`, `packages/validation/src/index.ts`, `scripts/check-env.ts`, `package.json`, workspace package manifests, `bun.lock`, release documentation, and the Supabase hardening migration.
- New focused coverage: dashboard/loaders/time formatting, workflow adapters, affiliate redirects/conversions, Places proxies, blog views, World Map imports, mobile offline synchronization, authenticated mobile APIs, and signed-out create-flow E2E.

## React 19 whole-repository coverage

The category tables below record the initial review's observations. “Clean” means no finding was recorded in that pass; it is not a guarantee against regressions or undiscovered defects.

Scope inventory: 490 TypeScript/TSX files (357 web, 88 mobile, 18 shared, 27 tests/tooling), including 64 client components, 14 hooks, and 87 tests.

| Category             | Web   | Mobile           | Shared | Tests/tooling |
| -------------------- | ----- | ---------------- | ------ | ------------- |
| Concurrent rendering | clean | clean            | clean  | clean         |
| Server Components    | clean | n/a              | n/a    | clean         |
| Actions and forms    | clean | n/a              | clean  | clean         |
| Data fetching        | clean | clean            | clean  | clean         |
| State management     | clean | clean            | clean  | clean         |
| Memoization          | clean | clean            | clean  | clean         |
| Effects              | clean | 2 findings fixed | clean  | clean         |
| Component patterns   | clean | clean            | clean  | clean         |
| Codebase hygiene     | clean | clean            | clean  | clean         |

Category 9 full-tree result: no high-confidence dead production module, duplicate component family, or unnecessary client-boundary consolidation remained. Compatibility route adapters are intentional. Knip candidates were reviewed but not deleted when framework conventions or public package exports made them false positives.

## Next.js 16 whole-repository coverage

Scope inventory: 357 web TypeScript/TSX files, 34 pages, 15 layouts, 33 route handlers, and 64 client/configuration files.

| Category          | Pages/layouts   | Route handlers  | Components/loaders | Config/tooling   |
| ----------------- | --------------- | --------------- | ------------------ | ---------------- |
| Build and bundle  | clean           | clean           | clean              | clean            |
| Caching           | clean           | clean           | clean              | clean            |
| Server/data       | 1 finding fixed | clean           | 2 findings fixed   | clean            |
| Routing           | clean           | 1 finding fixed | clean              | 2 findings fixed |
| Server Actions    | n/a             | n/a             | n/a                | n/a              |
| Streaming         | clean           | clean           | clean              | clean            |
| Metadata/SEO      | clean           | n/a             | clean              | clean            |
| Client Components | clean           | n/a             | 2 findings fixed   | clean            |
| Codebase hygiene  | clean           | clean           | clean              | clean            |

Category 9 full-tree result: legacy route adapters are deliberately thin and canonical; no additional high-confidence remove/deduplicate/reuse/consolidate finding remained.

## Security review

The high-confidence review covered authentication, authorization/ownership, input validation, injection, XSS, CSRF, SSRF, deserialization, cryptography, data protection, file import, logging, error handling, CORS/headers, modern JavaScript threats, dependency supply chain, and Supabase privileges.

No remaining high-confidence exploitable application-code vulnerability was found after remediation. Secret-pattern scanning found environment-variable reads and documentation placeholders, not a committed credential value. Affiliate redirects are HTTPS/domain allowlisted, service-role data queries are owner-scoped or intentionally public, webhook signatures use HMAC with constant-time comparison, and sensitive routes fail closed.

The database hardening migration is code-reviewed but still requires application to and verification against the target Supabase project.

## Verification evidence

| Gate                                      | Result                                                         |
| ----------------------------------------- | -------------------------------------------------------------- |
| Git whitespace validation                 | passed                                                         |
| Uncached workspace type-check/lint/format | 11/11 tasks passed                                             |
| Unit/integration tests                    | 685 passed, 0 failed                                           |
| Mobile open-handle rerun                  | 159 passed serially, no open handle reported                   |
| Next.js production build                  | passed; 1,414 static pages generated                           |
| Production browser/API E2E                | 63/63 passed across Chromium, Mobile Safari, and Mobile Chrome |
| Expo Doctor                               | 18/18 passed                                                   |
| Android production export                 | passed; Hermes bundle generated                                |
| iOS production export                     | passed; Hermes bundle generated                                |
| Dependency audit                          | prior clean claim withdrawn; requires a completed audit        |
| Connected streaming schema                | searches columns and merge RPC passed                          |
| Viator sandbox inventory                  | passed; Tokyo product inventory returned                       |
| Google Places live check                  | passed for activity and dining results                         |

## Deployment and account blockers

1. Add production values for `IP_HASH_SALT`, `CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, and `VIATOR_WEBHOOK_SECRET`. `bun run release:check:web` intentionally fails until all four exist.
2. Apply `20260903000000_harden_legacy_security_definer_functions.sql` to the target Supabase project, then rerun database/RLS checks.
3. TripAdvisor currently returns HTTP 403 for hotels, restaurants, and attractions; obtain the required API entitlement or keep that vendor disabled.
4. Booking.com, Amadeus, Duffel, GetYourGuide, and Tavily are not configured. Either configure the vendors needed for launch or change the strict vendor launch policy to the supported set. AI-only fallback items must not receive affiliate CTAs.
5. Complete a signed partner conversion/webhook reconciliation with a real test booking before reporting affiliate revenue. Inventory and click/conversion code paths are verified, but an external booking settlement cannot be simulated locally.

## Dogfood note

An initial exploratory observation suggested the signed-out create CTA lost its draft. Deterministic browser reproduction did not confirm it; the completed flow preserved the draft and redirected to login. A regression test now locks that behavior. The mobile back-button accessibility issue from the same session was confirmed and fixed.
