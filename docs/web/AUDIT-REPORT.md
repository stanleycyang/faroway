# TripGenie Web Security & UX Audit Report

**Date:** 2026-02-16  
**Auditor:** Automated audit via OpenClaw

---

## Security Issues Found & Fixed

### 🔴 Critical

1. **Open Redirect in Auth Callback** (`app/auth/callback/route.ts`)
   - The `next` query param was used directly in redirects without validation
   - **Fix:** Added validation to only allow relative paths, blocking `//`, `:`, and `\` chars

2. **Open Redirect in Middleware** (`middleware.ts`)
   - `redirectTo` param passed unchecked to `NextResponse.redirect()`
   - **Fix:** Added same relative-path validation

### 🟠 High

3. **Missing Security Headers** (`next.config.ts`)
   - No HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy
   - **Fix:** Added comprehensive security headers via `next.config.ts` `headers()` config
   - Also disabled `X-Powered-By` header

4. **Health Endpoint Leaking Config** (`app/api/health/route.ts`)
   - Exposed whether API keys were set, Vercel URL, node env, service key presence
   - **Fix:** Reduced to only `status` and `timestamp`

5. **No Input Validation on Trip CRUD** (`app/api/trips/route.ts`, `app/api/trips/[id]/route.ts`)
   - POST accepted arbitrary body without schema validation
   - PUT accepted any fields without validation
   - **Fix:** Added Zod schemas for both create and update operations, plus ID format validation

6. **Webhook Secret Optional in Production** (`app/api/webhooks/workflow-complete/route.ts`)
   - `WORKFLOW_WEBHOOK_SECRET` not required, allowing unauthenticated webhook calls
   - **Fix:** Made it required in production (returns 500 if missing)

### 🟡 Medium

7. **No Rate Limiting on API Routes**
   - AI generation and search endpoints had no rate limiting
   - **Fix:** Added in-memory rate limiter (`lib/security/rate-limit.ts`) applied to `/api/itinerary` (10/min) and `/api/search/start` (5/min)

8. **Missing Environment Variable Validation**
   - No validation that required env vars (Supabase URL, keys) are set
   - **Fix:** Added `lib/env.ts` with Zod validation, registered via `instrumentation.ts`

9. **No Input Validation on Search Start** (`app/api/search/start/route.ts`)
   - Accepted unvalidated body
   - **Fix:** Added Zod schema validation

### ✅ Already Good
- Auth uses Supabase (no custom JWT handling needed for Next.js app)
- Supabase RLS handles row-level security
- No hardcoded API keys or secrets found in source
- CSRF protection via SameSite cookies (Supabase default)
- Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`) not exposed to client bundles (only used in server files)

---

## UX Issues Found & Fixed

### 🔴 Critical

1. **Broken Navigation Links** (`components/Header.tsx`)
   - "Sign In" linked to `/login` (doesn't exist) instead of `/auth/login`
   - "Get Started" linked to `/create-trip` instead of `/create`
   - **Fix:** Corrected both links

2. **Create Page Had No Error Handling** (`app/create/page.tsx`)
   - Generate button used `setTimeout` with fake redirect instead of actual API call
   - No error display if API call fails
   - **Fix:** Replaced with real API call to `/api/trips`, added error state and error display with `role="alert"`

### 🟡 Medium

3. **Missing Skip-to-Content Link** (`app/layout.tsx`)
   - No keyboard navigation shortcut to skip header
   - **Fix:** Added screen-reader-visible skip link

4. **Missing ARIA Labels & Accessibility** (`app/create/page.tsx`)
   - Date inputs had no `id`/`htmlFor` association
   - Counter buttons had no `aria-label`
   - Destination cards had no `aria-pressed` state
   - Image `alt` text was just city name, missing country
   - **Fix:** Added all missing ARIA attributes, `htmlFor` labels, `aria-live` on counter, keyboard support on destination card

5. **Missing `aria-label` on Main Nav** (`components/Header.tsx`)
   - `<nav>` element had no accessible label
   - **Fix:** Added `aria-label="Main navigation"`

### ✅ Already Good
- Error boundary exists (`app/error.tsx`) with good UX
- 404 page exists (`app/not-found.tsx`) with helpful navigation
- 500 page exists (`app/500.tsx`)
- Loading states present (`app/(app)/dashboard/loading.tsx`)
- Good responsive design throughout
- Form validation UX in `TripForm` component with step-by-step flow
- Empty states in dashboard
- Good meta tags & SEO (OG, Twitter cards, structured data, sitemap, robots)
- Font optimization via `next/font`
- Image optimization via `next/image`

---

## Files Modified
- `next.config.ts` — Security headers, disabled poweredBy
- `middleware.ts` — Open redirect fix
- `app/auth/callback/route.ts` — Open redirect fix
- `app/api/health/route.ts` — Removed config leak
- `app/api/trips/route.ts` — Zod input validation
- `app/api/trips/[id]/route.ts` — Zod validation, ID format check
- `app/api/itinerary/route.ts` — Rate limiting
- `app/api/search/start/route.ts` — Rate limiting, Zod validation
- `app/api/webhooks/workflow-complete/route.ts` — Required webhook secret in prod
- `app/layout.tsx` — Skip-to-content link
- `app/create/page.tsx` — Error handling, accessibility, real API integration
- `components/Header.tsx` — Fixed broken links, ARIA label

## Files Created
- `lib/security/headers.ts` — Security headers constants
- `lib/security/validate-redirect.ts` — Redirect URL validation utility
- `lib/security/rate-limit.ts` — In-memory rate limiter
- `lib/env.ts` — Environment variable validation
- `instrumentation.ts` — Startup env validation
