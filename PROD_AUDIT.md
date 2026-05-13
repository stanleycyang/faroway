# Production Readiness Audit — Faroway

**Date:** 2026-05-12  
**Auditor:** Claude Sonnet 4.6  
**Scope:** Full monorepo — `apps/mobile`, `apps/web`, `packages/*`, `supabase/`

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| **P0** | Production-blocking — ships broken or exploitable |
| **P1** | Must fix before launch — causes data loss, crashes, or missing docs |
| **P2** | Fix before soft-launch — degrades quality/security/observability |
| **P3** | Polish — noticeable but not blocking |

---

## P0 — Production-Blocking

### P0-1: OG/social image (`/og-image.png`) missing from public assets

**File:** `apps/web/app/layout.tsx:75`, `apps/web/app/layout.tsx:88`  
**Impact:** Every social share (Twitter, LinkedIn, iMessage, Slack) shows a broken image or blank card. OG image is the single most visible first impression.  
**Evidence:** `apps/web/public/` contains icons and favicons but no `og-image.png`; all OG meta tags point to `/og-image.png`.  
**Fix:** Create a 1200×630 OG image (static or via `/api/og` dynamic route) and place it at `apps/web/public/og-image.png`. Consider generating it from the brand wordmark. See `/api/og/world-map/route.tsx` for the pattern using `next/og`.

---

### P0-2: No error monitoring — zero production visibility

**Files:** searched all `apps/` — no Sentry, Datadog, or equivalent found  
**Impact:** Silent crashes and server-side exceptions will go completely unnoticed. No stack traces, no user context, no release tracking. The first sign of a production incident will be user churn, not an alert.  
**Fix:** Add `@sentry/nextjs` to `apps/web` and `@sentry/react-native` to `apps/mobile`. Wire up source maps, user context (anonymized ID), and environment/release tags. Verify Sentry receives a test error end-to-end before launch.

---

### P0-3: Most expensive API endpoint has no rate limiting

**File:** `apps/web/app/api/workflows/generate-itinerary/route.ts`  
**Impact:** The itinerary generation endpoint (calls OpenAI/Anthropic + Amadeus + external vendors) has **zero rate limiting**. A single bad actor can exhaust API credits in minutes. Other lighter endpoints (destinations, places, search) have rate limiting; this one was skipped.  
**Evidence:** `grep -c "checkRateLimit" route.ts` returns `0`.  
**Fix:** Add `checkRateLimit` call at the top of the POST handler, scoped per authenticated user ID, with a conservative limit (e.g., 5 generations per hour per user, 20 per day).

---

### P0-4: In-memory rate limiter is non-functional on Vercel serverless

**File:** `apps/web/lib/security/rate-limit.ts:1-60`  
**Impact:** The rate limiter stores state in a `Map` that lives in process memory. On Vercel, every serverless invocation may spin up a new instance with an empty map, so rate limits **never actually accumulate** across real traffic. All rate-limited endpoints (places autocomplete, destinations, search, blog views, etc.) have no real protection.  
**Comment in source:** `"For production, use Vercel's built-in rate limiting or Redis."` — this is the fix, but it hasn't been done.  
**Fix options (in priority order):**
1. Vercel Rate Limiting (built-in, zero infra) — see Vercel docs for `@vercel/functions` `ipRateLimit`.
2. Upstash Redis via `@upstash/ratelimit` — requires `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars.

---

## P1 — Must Fix Before Launch

### P1-1: Root README is missing

**Impact:** Any new team member, contractor, or reviewer cannot set up or understand the project. No documented architecture, setup steps, scripts, or deploy process.  
**Fix:** Create `README.md` at repo root covering: prerequisites, `bun install`, local dev (`bun dev`), env setup, Supabase setup (`bun db:start`), mobile run (`bun dev:ios`), deploy, and monorepo package overview.

---

### P1-2: Auth race condition — `initialized: true` set before profile hydration

**File:** `apps/mobile/hooks/useAuth.ts:89-100`  
**Impact:** `initSession()` sets `initialized: true` and then `await hydrateUser(session)`. Any component that renders based on `isAuthenticated && initialized` will see an authenticated state with an empty user store for the duration of the async profile fetch. This can cause flashes of wrong content or premature redirects.  
**Code (current):**
```ts
setAuthState({ user: session?.user ?? null, session, loading: false, initialized: true }); // ← too early
if (session) {
  await hydrateUser(session); // ← user store is empty until this resolves
}
```
**Fix:** Only set `initialized: true` after `hydrateUser` completes (or after a timeout of ~3s to prevent indefinite loading on API failure).

---

### P1-3: Unhandled promise rejection on home screen destination fetch

**File:** `apps/mobile/app/(tabs)/index.tsx:77-82`  
**Impact:** Both `getPopularDestinations().then(...)` and `getTrendingDestinations().then(...)` have no `.catch()`. On any network error (timeout, 5xx, offline), the promise rejects silently. React Native will log a warning but no user-facing error state is shown. This is also an unhandled rejection that could crash older React Native versions.  
**Code (current):**
```ts
getPopularDestinations({ limit: 5 }).then((res) => {
  if (res.data?.destinations?.length) setApiPopular(res.data.destinations);
});
// ← no .catch()
```
**Fix:** Add `.catch(() => { /* silently fall back to hardcoded popularDestinations */ })` to both calls, and consider showing a subtle error indicator if both fail.

---

### P1-4: Privacy policy claims analytics — nothing is integrated

**File:** `apps/web/app/(marketing)/privacy/page.tsx`  
**Impact:** The privacy policy states "We use privacy-focused analytics." No analytics tool is installed anywhere in the codebase. This is a legal misrepresentation. Conversely, `NEXT_PUBLIC_GA_MEASUREMENT_ID` is documented in `.env.example` but unused — suggesting Google Analytics was planned but never implemented.  
**Fix:** Either (a) add a privacy-preserving analytics tool (e.g., Plausible, Fathom, or PostHog in cookieless mode) and implement it, or (b) remove the analytics claim from the privacy policy.

---

## P2 — Before Soft Launch

### P2-1: `NEXT_PUBLIC_BASE_URL` missing from `apps/web/.env.example`

**File:** Used in 15+ files (`layout.tsx`, `sitemap.ts`, `robots.ts`, all blog/destination OG tags, share route)  
**Impact:** Has a production fallback hardcoded to `https://www.faroway.ai`, so it won't break, but staging/preview deployments will generate OG tags and sitemaps pointing to the production URL unless this is explicitly configured. Causes SEO confusion across environments.  
**Fix:** Add `NEXT_PUBLIC_BASE_URL=https://www.faroway.ai` to `apps/web/.env.example` with a comment explaining staging overrides.

---

### P2-2: `/tools/world-map` missing from sitemap

**File:** `apps/web/app/sitemap.ts`  
**Impact:** The world-map tool has full JSON-LD structured data and is a shareable feature, but it is absent from `sitemap.ts` `toolSlugs` and has no direct sitemap entry. Search engines won't discover it.  
**Fix:** Add `world-map` to `toolSlugs` in `sitemap.ts` or add an explicit entry for the world map.

---

### P2-3: `as unknown as` type casts without runtime validation in web API routes

**Files:**
- `apps/web/app/(app)/trips/[id]/page.tsx:306,355,410`
- `apps/web/app/api/search/[searchId]/route.ts:113,123,133,143`
- `apps/web/app/api/trips/[id]/stream/route.ts:574`

**Impact:** If Supabase schema changes or returns unexpected shapes (e.g., a nullable field that wasn't nullable before), these casts will silently produce malformed data that crashes downstream rendering.  
**Fix:** Replace with Zod schema validation. The `@faroway/validation` package exists and should be the right home for these schemas. At minimum, add narrow type guards before the casts.

---

### P2-4: No E2E test coverage on critical flows

**Impact:** Unit tests exist for `useStreamingItinerary`, `api.ts`, `searchService`, and `tripStore`. But there are no end-to-end tests for: auth (Google/Apple sign-in), trip creation and generation, the streaming itinerary view, or the booking affiliate click flow. A regression in any of these would only be caught in manual QA.  
**Fix:** Add Playwright E2E tests covering:
1. Unauthenticated trip creation (anonymous flow)
2. Sign-in via Google (mocked)
3. Streaming generation with a mocked SSE response
4. Booking link click (affiliate URL validation)

---

### P2-5: CI does not build or type-check mobile app

**File:** `.github/workflows/CI.yml`  
**Impact:** The `build-web` job only runs `bun turbo build --filter=@faroway/web`. The mobile app's TypeScript and Expo configuration are not checked. A broken mobile type error would only surface locally or in an EAS build.  
**Fix:** Add `bun turbo type-check --filter=@faroway/mobile` to the `quality` job. Mobile build itself (EAS) is expensive to run in CI, but type checking is cheap.

---

### P2-6: Generate-itinerary workflow endpoint missing auth rate limit

**File:** `apps/web/app/api/workflows/generate-itinerary/route.ts`  
**Note:** See also P0-3. Even after adding rate limiting, it should be scoped per `user.id`, not per IP, since mobile clients may share IPs (CGNAT/Wi-Fi). The existing search endpoint correctly uses IP; this one should use user ID.

---

## P3 — Polish

### P3-1: `prefers-reduced-motion` not respected in animations

**Files:** `apps/mobile/app/create/generating.tsx`, `apps/mobile/app/(tabs)/index.tsx`  
**Impact:** Users with vestibular disorders who set `prefers-reduced-motion: reduce` will still see full looping animations and parallax effects. Required for WCAG 2.1 AA (success criterion 2.3.3).  
**Fix:** Use `useReducedMotion()` from `react-native-reanimated` or `AccessibilityInfo.isReduceMotionEnabled()` to gate animations.

---

### P3-2: `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `.env.example` but unimplemented

**File:** `apps/web/.env.example`  
**Impact:** Documented as if GA is present, but no GA snippet, `<Script>` tag, or pageview tracking exists in the codebase. Creates confusion for anyone onboarding.  
**Fix:** Remove the GA env var from `.env.example` until analytics is actually implemented (see P1-4).

---

### P3-3: Missing `Article` JSON-LD on blog posts

**Files:** `apps/web/app/blog/[slug]/page.tsx`, `apps/web/app/blog/guides/[slug]/page.tsx`  
**Impact:** The root layout has `Organization`, `WebSite`, and `SiteLinksSearchBox` JSON-LD, but individual blog posts lack `Article` structured data. Google may not surface rich snippets (author, date, breadcrumbs) for blog content.  
**Fix:** Add per-post `Article` schema using post frontmatter (`title`, `author`, `datePublished`, `dateModified`, `image`).

---

### P3-4: Blog article schema and destination `TouristDestination` schema missing

**Files:** `apps/web/app/destinations/[slug]/page.tsx`  
**Impact:** Destination guide pages lack `TouristDestination` or `TravelAction` schema. Given the SEO-critical nature of these pages (they target high-intent "travel to X" queries), structured data would meaningfully increase rich result eligibility.

---

### P3-5: CI has no preview deploy step

**File:** `.github/workflows/CI.yml`  
**Impact:** PRs cannot be visually reviewed without pulling and running locally. Vercel preview URLs could be auto-posted to PRs.  
**Fix:** Add the Vercel GitHub integration or a `deploy-preview` job that posts the preview URL as a PR comment on each push to non-main branches.

---

### P3-6: Mobile test suite missing coverage for `useAuth` and offline sync

**Files:** `apps/mobile/__tests__/`  
**Impact:** The two most critical and complex hooks (`useAuth.ts`, `useOfflineSync.ts`) have no unit tests. Auth flows with multiple providers and offline sync with conflict resolution are high-risk areas.  
**Fix:** Add unit tests for: Google sign-in cancel, Apple sign-in credential mapping, `deleteAccount` flow, anonymous trip claiming, and offline queue flush/retry logic.

---

## Summary Table

| ID | Area | Severity | Status |
|----|------|----------|--------|
| P0-1 | OG image missing | P0 | Open |
| P0-2 | No error monitoring | P0 | Open |
| P0-3 | `/generate-itinerary` unrated | P0 | Open |
| P0-4 | In-memory rate limiter | P0 | Open |
| P1-1 | README missing | P1 | Open |
| P1-2 | Auth race condition | P1 | Open |
| P1-3 | Unhandled rejection home screen | P1 | Open |
| P1-4 | Analytics claim vs. reality | P1 | Open |
| P2-1 | `NEXT_PUBLIC_BASE_URL` undocumented | P2 | Open |
| P2-2 | World-map missing from sitemap | P2 | Open |
| P2-3 | `as unknown as` casts | P2 | Open |
| P2-4 | No E2E tests | P2 | Open |
| P2-5 | CI skips mobile typecheck | P2 | Open |
| P2-6 | Generate endpoint rate limit scoping | P2 | Open |
| P3-1 | `prefers-reduced-motion` | P3 | Open |
| P3-2 | Dead GA env var | P3 | Open |
| P3-3 | Missing Article JSON-LD | P3 | Open |
| P3-4 | Missing TouristDestination schema | P3 | Open |
| P3-5 | No preview deploys in CI | P3 | Open |
| P3-6 | Missing auth/offline sync tests | P3 | Open |

---

## Strengths (Do Not Break)

The following areas are solid and should be preserved:

- **RLS policies** — all tables have correct row-level security with `(SELECT auth.uid())` wrapping for plan-time caching; service role properly scoped
- **Auth flows** — Google and Apple sign-in use ID tokens (not passwords or JWT leakage); anonymous trip claiming is handled correctly
- **Offline support** — comprehensive AsyncStorage-backed queue with retry and conflict detection (`docs/OFFLINE_SYNC.md`)
- **Streaming implementation** — SSE with XHR for React Native is the correct approach; 5-minute timeout, abort controller, and reconnect path are all present
- **Affiliate security** — `isAllowedAffiliateUrl()` with explicit HTTPS enforcement and domain allowlist
- **Input validation** — `GenerateItineraryRequestSchema` uses Zod with date range superRefine; date-only format validated before hitting AI pipeline
- **SEO foundation** — sitemap, robots, OG tags, Twitter cards, JSON-LD on tools pages are all implemented
- **Legal pages** — Privacy policy, Terms of Service, Support, and account deletion all exist and are linked
- **CI pipeline** — lint, type-check, format-check, tests, and web build run on every push/PR with `concurrency` cancel-in-progress

---

## Fix Order Recommendation

1. Create OG image (P0-1) — 1 hour
2. Add rate limiting to `/generate-itinerary` (P0-3) — 2 hours
3. Migrate rate limiter to Vercel/Upstash (P0-4) — 4 hours
4. Add Sentry to web + mobile (P0-2) — 4 hours
5. Write README (P1-1) — 2 hours
6. Fix auth race condition (P1-2) — 1 hour
7. Fix home screen `.catch()` (P1-3) — 30 minutes
8. Resolve analytics claim (P1-4) — 2 hours (implement or remove)
9. P2 items in parallel — 1–2 days
10. P3 items as bandwidth allows
