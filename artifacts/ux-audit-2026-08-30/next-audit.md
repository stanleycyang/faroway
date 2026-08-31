# Next.js 16 Repository Audit

## Audit Scope

- **Mode:** B (repository audit)
- **Routes:** 34 pages, 15 layouts, 33 route handlers, 8 loading/error/not-found surfaces, and 11 metadata/OG/sitemap/robots surfaces
- **Clients:** 65 client modules reviewed against their Server Component owners
- **Approach:** Category-major sweep across the entire App Router tree, followed by production build and route-runtime verification

## 1/9 Build & Bundle — Critical

**Scope:** Next configuration, root layout, all static/dynamic imports, font/image usage, client boundaries, and generated chunk inventory.

**Findings: 1 fixed**

1. Leaflet maps and the interactive world-map application are isolated behind client-only dynamic imports; secondary world-map dialogs are split again at interaction boundaries. No browser-only map dependency crosses into a Server Component.
2. Eighteen unreachable UI modules—including stale barrels, duplicate primitives, loading/animation wrappers, and a disconnected web JSON-render registry—were removed from the module graph. Vercel Analytics is now production-only so development does not load a blocked third-party script or pollute the QA console.

Lucide imports are named and tree-shakeable, fonts use `next/font`, and route images use `next/image` where optimization applies. No reachable heavy library is imported through a broad namespace or client barrel.

## 2/9 Caching — High

**Scope:** Segment cache configuration, React request caches, static generation, ISR, public/private data, metadata routes, and mutation freshness.

**Findings: 2 fixed**

1. Shared itinerary pages used one-hour ISR, so a revoked link could continue exposing trip details from cache. Shared pages are now force-dynamic and their generated social image has zero revalidation, making owner revocation effective on the next request.
2. Supabase-managed blog and category pages had no explicit freshness contract and could remain at build-time content. The blog subtree and sitemap now revalidate hourly while request-level React caches deduplicate layout/metadata/page reads.

Authenticated dashboard and trip routes are dynamic through cookie-backed Supabase clients. Static destination and travel-tool datasets remain build-time pages by design; third-party autocomplete/details calls explicitly bypass cache.

## 3/9 Server Components & Data Fetching — High

**Scope:** All 34 pages, layout metadata reads, server-only loaders, route-handler query chains, and client-boundary props.

**Findings: 2 fixed**

1. Independent search-param, Supabase-client, blog-list, category-list, article, and related-post reads were serialized in several routes. Independent work now starts with `Promise.all`; only authentication-dependent trip queries remain sequential.

Private trip loaders require the authenticated user ID and are request-deduplicated with React `cache`. Public shared-trip loaders enforce both the unguessable token and `is_shared`. Client Components receive serializable data and own only interaction-time fetches, streaming, or polling.

## 4/9 Routing & Navigation — High

**Scope:** Every internal link and redirect, proxy protection, dynamic params, not-found paths, auth callbacks, legacy URLs, and query contracts.

**Findings: 5 fixed**

1. The dashboard linked “View All Trips” to nonexistent `/trips` even though the dashboard already is the complete trip list. The dead duplicate action section was removed.
2. Popular-destination links on the 404 page targeted an ignored home-page query. They now open the canonical create flow with that destination preselected.
3. The live database contained a `Money` blog category that the hard-coded category route rejected. Static params, metadata, pills, validation, and pagination now use live categories with on-demand dynamic params.
4. Login/signup accepted raw `redirectTo` values for client navigation, while proxy and callback validation omitted backslash handling. All auth entry and exit paths now use the shared redirect validator, closing the client-side open-redirect edge case.
5. Two auth callback implementations had diverged, and the API variant could redirect to a nonexistent error page. `/auth/callback` is the single implementation; the legacy API URL safely preserves its query and redirects there for old configured links.

Invalid trip IDs, unknown content slugs, revoked shares, and unsupported tool destinations reach intentional not-found UI. `/trips/new` permanently redirects to the single `/create` experience before auth middleware adds an unnecessary hop.

## 5/9 Server Actions & Mutations — High

**Scope:** All POST/PATCH/DELETE handlers, auth/ownership checks, schemas, rate limits, client pending/error states, and post-mutation UI.

**Findings: 3 fixed**

1. A completed private trip rendered social share controls before a public link existed, causing them to share the protected `/trips/:id` URL. Social controls now appear only after the owner explicitly creates a public link.
2. Public sharing had a disable API but no owner UI, and a missing/non-owned trip could report successful revocation. Existing share state now hydrates with the trip, owners can turn off public access with pending/status feedback, and the API requires an updated owned row.
3. Partial date updates validated only when both dates were included, allowing an end-only or start-only patch to violate the stored range. The mutation now validates the merged stored-and-new range before updating.

This codebase intentionally uses route-handler APIs rather than Server Actions for mobile/web parity, streaming, and external callbacks. Reviewed mutations authenticate where user-owned data is involved, validate with bounded Zod schemas, rate-limit public abuse surfaces, and expose pending, success, or failure outcomes.

## 6/9 Streaming & Loading — Medium

**Scope:** Loading files, Suspense boundaries, auth/search-param CSR bailouts, itinerary SSE lifecycle, polling fallback, and root error recovery.

**Findings: 3 fixed**

1. Blog index, category, and guide routes could wait on live database reads with no route-level fallback. A shared blog skeleton now covers the subtree while the article keeps its more specific skeleton.
2. Trip SSE could end before a terminal event and leave the UI permanently assigned to a dead stream; fallback polling was disabled merely because a search ID existed. Premature stream completion now becomes a recoverable connection state that activates one-at-a-time polling until the persisted trip reaches a terminal state.
3. Existing route skeletons were visually useful but silent to assistive technology. Dashboard, trip, and blog loading surfaces now expose named busy status regions, while global reduced-motion rules suppress pulse motion when requested.

Search-param Client Components are wrapped in Suspense where a static parent requires it; the authenticated dashboard is request-dynamic. Root and global error boundaries capture failures and provide reset/home recovery.

## 7/9 Metadata & SEO — Medium

**Scope:** Page/layout metadata, title templates, canonical URLs, pagination, robots, sitemap, Open Graph/Twitter images, and JSON-LD.

**Findings: 4 fixed**

1. Several page titles included `| Faroway` even though the root template adds that suffix, producing duplicated browser titles. Shared, legal, report, and legacy-create metadata now provide unsuffixed titles.
2. The site-level `SearchAction` advertised `/?destination=...`, a query the home page does not consume. Structured search now targets the working `/create?destination=...` contract.
3. Paginated blog and category pages canonicalized every page to page one. Metadata now includes page-specific titles, canonical URLs, and Open Graph URLs for page 2+.
4. Blog guide indexes and cluster pages lacked explicit canonicals. Both levels now provide stable canonical paths under the nested blog title template.

Private/auth/report routes are noindex, shared links are noindex, and robots excludes API and user trip areas. Sitemap coverage includes static marketing pages, every valid destination/tool detail, live blog posts/categories, and guide clusters with hourly refresh.

## 8/9 Client Components — Medium

**Scope:** All 65 starting client modules, hydration-sensitive browser reads, dynamic imports, client-page boundaries, and server-to-client props.

**Findings: 3 fixed**

1. Packing-list persistence read local storage during initial client rendering and could disagree with server HTML. Hydration is now deterministic and storage applies after mount.
2. The shared `ShareButtons` accepted an omitted URL and read `window.location.href` during render, creating a browser-only fallback and enabling the protected-link sharing bug. Its contract now requires a server-known/public URL and contains no render-time browser read.
3. The entire 404 page was a Client Component only to support one history-back button. The page is now server-rendered with a tiny isolated client control for that interaction.

Leaflet and interactive world-map trees remain client-only and dynamically loaded. Browser storage, media queries, and URL reads occur after hydration; Server Components pass plain serializable props across every reviewed boundary.

## 9/9 Codebase Hygiene — Low

**Scope:** Full App Router inventory, recognized special files, compatibility endpoints, dead integrations, package dependencies, and direct-import conventions.

**Findings: 2 fixed**

1. `app/500.tsx` was a Pages Router convention ignored by the App Router and duplicated the real `error.tsx`/`global-error.tsx` recovery surfaces. The unreachable page was removed.
2. Two additional web JSON-render catalog/registry modules and their web-only dependencies remained after the active UI moved to streamed-spec rendering. The disconnected implementation and package entries were removed; the server-safe spec builder and mobile registry remain intact.

Legacy callback and itinerary/click API aliases are retained only where they provide explicit compatibility redirects or `410` migration responses. Route components use direct imports, and all remaining special files are recognized by Next.js 16.

## Coverage Summary

| Category | Scope covered | Findings | Status |
| --- | --- | ---: | --- |
| Build & Bundle | Config, root layout, imports, chunks, images/fonts | 2 | Fixed |
| Caching | Segment config, request caches, ISR, private/public freshness | 2 | Fixed |
| Server Components & Data Fetching | 34 pages, layouts, loaders, handlers | 1 | Fixed |
| Routing & Navigation | Links, redirects, proxy, params, callbacks, 404s | 5 | Fixed |
| Server Actions & Mutations | Every POST/PATCH/DELETE boundary and client outcome | 3 | Fixed |
| Streaming & Loading | Loading/error files, Suspense, SSE, fallback polling | 3 | Fixed |
| Metadata & SEO | Titles, canonicals, robots, sitemap, OG, JSON-LD | 4 | Fixed |
| Client Components | 65 starting client modules and hydration boundaries | 3 | Fixed |
| Codebase Hygiene | Full special-file/module/dependency inventory | 2 | Fixed |

**Next.js audit result:** 25 findings fixed, 0 intentionally deferred, 0 open.
