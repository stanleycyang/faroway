# React 19 Repository Audit

## Audit Scope

- **Mode:** B (repository audit)
- **Files in scope:** 244 UI-facing React/TypeScript modules — 41 mobile and 203 web; 190 TSX files, 11 hooks, 74 route/special entries, and 0 Server Action files
- **Approach:** Category-major targeted sweeps using the React 19 repository-audit heuristics, followed by a full-inventory codebase-hygiene pass

## 1/9 Concurrent Rendering — Critical

**Scope:** 15 highest-risk client components by size and interaction density.

**Findings: 3 fixed**

1. `apps/mobile/app/onboarding/index.tsx` — onboarding state depended on a programmatic scroll callback that did not fire reliably on Expo web, leaving the first slide stuck. Fixed by updating the requested index directly and treating scrolling as the visual synchronization step.
2. `apps/web/components/tools/world-map/WorldMap.tsx` — pointer-driven tooltip coordinates lived in the parent map component, so every mouse move rerendered and remapped the complete geography tree. Fixed by moving pointer-position updates to the tooltip DOM node while keeping semantic hover state in React.
3. `ShareLinkDialog` synchronized open/copy state by calling state setters during render. The dialog is conditionally mounted and now derives its initial copy state directly, eliminating render-phase updates.

No other concurrent-rendering breaks were found in the 15-file sweep: bounded filters are small, subscriptions clean up, and long-running work is scheduled outside render.

## 2/9 Server Components — Critical

**Scope:** All 34 web pages, 15 layouts, 52 client components, and the mobile route tree.

**Findings: 0 open**

Page-owned data is loaded in Server Components before crossing into interactive clients, browser-only map libraries are quarantined behind client-only dynamic wrappers, and route-level client boundaries are limited to genuinely interactive routes or framework error surfaces. Client-side fetches in autocomplete, feedback, sharing, and generation are user-triggered interactions rather than initial page-data waterfalls. No non-serializable server-to-client props were found.

## 3/9 Actions & Forms — High

**Scope:** 5 native forms, React Hook Form trip creation, 4 button-driven mutations, and their API/server validation paths.

**Findings: 1 fixed**

1. `app/auth/forgot-password/page.tsx` posted to a nonexistent API route, while both password-reset entry points redirected successful email callbacks to a nonexistent `/auth/reset-password` page. The reset request is now shared through the Supabase client, the new-password route is implemented with validation and expired-link recovery, and auth/report/newsletter outcomes use explicit status or alert semantics.

Trip generation remains an API-driven interaction because it coordinates persisted trips and a separate generation request; autocomplete, tracking, newsletter, reporting, and feedback endpoints retain server-side schema validation. All reviewed mutations expose pending and failure outcomes rather than silently reporting success.

## 4/9 Data Fetching — High

**Scope:** All Server Component data reads, route handlers, client fetches, and async blog/tool helpers.

**Findings: 1 fixed**

1. Blog article rendering and sitemap assembly serialized independent database reads. Related-post source data, article data, sitemap post metadata, and live category metadata now begin concurrently and use request-level React caches to deduplicate overlapping reads.

Route-level initial data remains server-owned. Client fetches are either explicitly user-triggered or polling/streaming after a mutation. Autocomplete requests cancel stale work, and third-party search integrations use bounded timeouts or abort signals.

## 5/9 State Management — Medium

**Scope:** Client state in trip creation/detail, auth, all seven travel tools, navigation, and blog interactions.

**Findings: 3 fixed**

1. `DestinationInput` copied a controlled value into local state but did not resynchronize when the form reset or changed it externally. It now synchronizes the display value and computes suggestions directly from the current query rather than storing delayed derived state.
2. The packing-list persisted state was read during the first client render, which could disagree with server HTML and trigger hydration recovery. Persistence now hydrates after mount while the server and first client render remain deterministic.
3. Packing-list persistence ran as a side effect inside a state updater, which is not safe when React replays updater functions. Storage writes now follow committed state in an effect gated by completed hydration.

Large route clients keep state local to the workflow they coordinate; cross-page auth and world-map data use dedicated stores/providers. No new global state is needed, and no reducer conversion would materially simplify the reviewed transitions.

## 6/9 Memoization & Performance — Medium

**Scope:** High-frequency events, large geography/itinerary trees, observers, derived collections, and lazy component boundaries.

**Findings: 3 fixed**

1. World-map pointer movement rerendered the full geography tree; tooltip coordinates now update imperatively without changing the semantic hover state.
2. The article table of contents rebuilt its heading array on every active-heading change, repeatedly disconnecting and recreating its observer. Heading extraction is memoized by article content.
3. The reading-progress bar updated React state for every scroll event and animated layout-affecting width. Updates are now coalesced to animation frames and rendered with a compositor-friendly scale transform.

Expensive itinerary totals, map statistics, markers, grouped field notes, and filtered country results are memoized at their actual data boundaries. Heavy Leaflet maps and world-map dialogs remain dynamically loaded. No blanket memoization was added to cheap values.

## 7/9 Effects & Events — Medium

**Scope:** Every client effect, timer, observer, global listener, request cancellation path, and repeated async event.

**Findings: 5 fixed**

1. Place autocomplete did not cancel its pending debounce or request on unmount. Both are now cleaned up, and clearing the field cancels stale work immediately.
2. Country search could resolve its lazy country list after closing/unmounting and used unmanaged focus timers. Resolution is cancellation-guarded and focus is now owned by a cleanup-safe animation-frame effect.
3. Legacy trip-generation polling used an async interval, allowing overlapping requests and work after unmount. It now uses one abortable recursive timeout with explicit cleanup and error handling.
4. World-map long-press timers and copy-feedback timers could outlive their owners. All reviewed timers now clear on unmount and replace any prior reset timer.
5. Share and import dialogs lacked keyboard event ownership. Escape handling, focus entry, focus containment, and restoration now install only while each dialog is open and clean up on close.

Scroll, media-query, storage, and click-outside subscriptions all return symmetric cleanup functions. Request effects are either aborted or guarded against late state writes.

## 8/9 Component Patterns — Low

**Scope:** Shared primitives, controlled components, modal/menu composition, interactive nesting, refs, and public component props.

**Findings: 4 fixed**

1. World-map share and import overlays were visual dialogs without dialog semantics or contained keyboard focus. Both now expose named modal dialogs with focus entry, Tab containment, Escape close, and focus restoration.
2. Profile rename rendered an input inside a profile-selection button, producing invalid nested interactive controls. Edit and select are now mutually exclusive sibling states with specific accessible names.
3. The trip header exposed an Export icon whose only behavior was a “coming soon” alert. The false affordance and its unused prop were removed; sharing remains the one clear header action.
4. Destination deep links from quiz results and “plan again” CTAs reached the create page but their `destination` query was ignored. The canonical create component now initializes a recommended or custom destination from that contract while preserving restored drafts as higher priority.

Selection controls use `aria-pressed`, disclosure controls expose expanded state where applicable, and controlled values remain owned by their parent workflow. No render-prop or context abstraction was introduced where ordinary composition is clearer.

## 9/9 Codebase Hygiene — Low

**Scope:** Full 244-file starting inventory, import/reference checks, route ownership, duplicate flows, stale barrels, and unused UI implementations.

**Findings: 2 fixed**

1. `/trips/new` maintained a second, older trip-creation experience with no live inbound links, different validation, and fewer capabilities. Old URLs now permanently redirect to `/create`, and the canonical page honors destination deep links. The duplicate form and destination input were removed.
2. Sixteen additional unreferenced UI modules were removed: obsolete button/card primitives, unused animation and loading wrappers, stale barrel files, a duplicate unused web JSON-render component registry, an unused counter, an unused itinerary skeleton, and the deprecated `forwardRef` button implementation.

Runtime JSON-render generation remains in `lib/json-render`; only the disconnected web component renderer was removed. Direct-import conventions remain consistent for route-used components, and no reachable module was removed.

## Coverage Summary

| Category | Scope covered | Findings | Status |
| --- | --- | ---: | --- |
| Concurrent Rendering | 15 high-risk interactive clients | 3 | Fixed |
| Server Components | 34 pages, 15 layouts, 52 client boundaries, mobile routes | 0 | Clear |
| Actions & Forms | Native forms, RHF flow, button mutations, server validation | 1 | Fixed |
| Data Fetching | Server reads, handlers, client fetches, async helpers | 1 | Fixed |
| State Management | Auth, trip workflows, tools, navigation, blog | 3 | Fixed |
| Memoization & Performance | Hot events, large trees/lists, observers, lazy boundaries | 3 | Fixed |
| Effects & Events | Every effect, timer, observer, listener, cancellation path | 5 | Fixed |
| Component Patterns | Shared primitives, dialogs, controls, refs, props | 4 | Fixed |
| Codebase Hygiene | Full starting inventory and reachability pass | 2 | Fixed |

**React audit result:** 22 findings fixed, 0 intentionally deferred, 0 open.
