# Faroway Full-Experience Audit

| Field | Result |
| --- | --- |
| Date | 2026-08-30 |
| Product surfaces | Expo mobile app, Expo web proxy, Next.js web app, shared API boundaries |
| Route coverage | 13 mobile screens, 34 web page templates, 33 route handlers, shared layouts and special states |
| Framework audits | [React 19 audit](react-audit.md) and [Next.js 16 audit](next-audit.md) |
| Outcome | Every reachable page template and critical guest journey reviewed; all app-owned critical, high, and medium findings resolved |

## Executive outcome

Faroway now presents a calmer, clearer experience around one central promise: choose a destination, shape the trip, and receive a useful itinerary. Guest users are no longer misled about account persistence, duplicate creation paths have been consolidated, dead controls have been removed, failure states recover, and private trips cannot be shared accidentally.

The two framework reviews surfaced 47 actionable implementation findings across React and Next.js. Some describe the same user-facing problem through different technical lenses; both audits now report zero open findings. The page-by-page product audit additionally covered mobile-native behavior, content truthfulness, guest states, forms, modals, responsive layout, and representative dynamic content.

### Remaining severity

| Severity | Open app-owned issues |
| --- | ---: |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

One non-blocking development warning remains upstream: React Navigation/Expo Router passes the deprecated React Native Web `pointerEvents` prop while mounting its internal screen container. Faroway source contains no `pointerEvents` prop usage. It has no functional or production-user impact and is recorded as a dependency watch item rather than an app defect.

## Page-by-page coverage

### Mobile and Expo web proxy

| Page or state | Primary purpose | Improvements and tested states | Result |
| --- | --- | --- | --- |
| Welcome `/` | Explain Faroway and offer one next step | Restored the previously blank web render; fixed unsupported notification initialization; added reduced-motion-safe entrance animation; verified Get Started and existing-account paths | Pass |
| Onboarding `/onboarding` | Introduce the value proposition in three short steps | Made slide advancement deterministic; corrected guest/account claims; persisted completion; removed the redundant preferences detour; verified next, skip, final CTA, and reload behavior | Pass |
| Sign in `/onboarding/login` | Explain account value and authenticate | Shows only platform-supported providers, uses working web OAuth, preserves the intended route and prepared trip through the Expo web redirect, keeps a clear guest path, and links policies correctly | Pass |
| Explore `/` after onboarding | Start a trip or browse inspiration | Clarified the primary create action, made guest copy truthful, improved semantics and reduced motion, and verified destination, inspiration, search, and tab entry points | Pass |
| My Trips `/trips` | Find saved trips or understand the signed-out state | Removed promotional repetition and fake preview clutter; reduced the guest decision to sign in or plan without an account; improved empty/loading/error actions | Pass |
| Profile `/profile` | Reach account and support settings | Removed the dead gear control, simplified the guest state, corrected Rate App behavior, and verified support/legal rows and authentication actions | Pass |
| Create `/create` | Configure a trip | Strengthened destination semantics, form states, traveler/vibe controls, validation, and draft preservation; verified empty, destination-selected, ready, and auth-gated states | Pass |
| Date picker modal | Choose a valid date range | Replaced the overloaded multi-month sheet with one focused month, labeled controls, clear start/end progression, a persistent completion action, 44-point targets, viewport-bounded sizing, and an internally scrollable calendar on short screens | Pass |
| Generate `/create/generating` | Show trustworthy progress and recover from generation outcomes | Rejects missing/authless direct entry, handles streaming and fallback states, cleans timers, honors reduced motion, and preserves clear retry/exit paths | Pass |
| Inspiration `/inspiration/[slug]` | Explain a travel theme and start planning | Added invalid-slug recovery, semantic actions, platform-safe motion/shadows, and a single clear planning CTA | Pass |
| Trip `/trip/[id]` | Review and act on a generated itinerary | Fixed cold deep links and ID matching; added hydration, fetch, retry, offline, auth, and not-found states; removed false favorite/export actions; clarified bookings and empty days | Pass |
| Edit profile `/profile/edit-profile` | Change identity details | Added route-level auth protection, real mutation failure handling, busy state, and accurate success feedback | Pass |
| Notifications `/profile/notifications` | Control notifications | Added auth protection, rollback on failed optimistic updates, busy state, and platform-safe behavior | Pass |
| Preferences `/profile/preferences` | Save travel preferences | Added auth protection, real response validation, failure feedback, and a clear save state | Pass |

Shared mobile controls were reviewed across their consumers: AuthGate, RatingPrompt, Button, Input, Card, PlacesAutocomplete, VibeSelector, SyncStatusBanner, loading skeletons, tab navigation, and route layouts. Native animation drivers remain enabled on iOS/Android and are disabled only on web, eliminating React Native Web animation warnings without weakening native performance.

### Next.js web app

| Route family | Templates reviewed | Purpose and changes | Result |
| --- | ---: | --- | --- |
| Marketing and legal | 6 | Home, About, Support, Privacy, Terms, and Report retain a focused marketing/support purpose; corrected metadata and policy/report semantics | Pass |
| Destinations | 2 | Index and dynamic destination template preserve browse-to-plan flow; deep links now enter canonical creation with a selected destination | Pass |
| Authentication | 4 | Login, signup, forgot password, and the new reset-password page form one complete recovery flow; redirects are validated against open-redirect variants | Pass |
| Authenticated app | 3 | Dashboard is the canonical trip list, trip detail exposes only real actions, and legacy `/trips/new` permanently redirects to `/create` | Pass |
| Create | 1 | Restores one-time, expiring drafts through same-tab or cross-tab authentication, consumes destination recommendations, traps focus in the responsive date dialog, and exposes validation/status clearly | Pass |
| Blog | 5 | Index, category, article, guide index, and guide detail use live categories, hourly freshness, correct pagination/canonicals, useful loading states, and dated-money disclaimers | Pass |
| Travel tools | 12 | Tool hub, best-time, currency, packing, quiz, cost, visa, and world-map templates have clearer CTAs, labels, persistence, keyboard interaction, and result states | Pass |
| Shared trip `/s/[token]` | 1 | Requires a valid active public token, is immediately revoked when sharing is disabled, uses fresh social metadata, and returns a true 404 for invalid links | Pass |
| Not found and global states | Special files | 404 is server-rendered with a small back control; loading states announce busy status; error boundaries retain recovery | Pass |

Representative dynamic pages were exercised against live local data, including Tokyo destination/best-time content, Fiji/Auckland blog pagination, a Money article, invalid content slugs, and invalid share tokens. The production build generated 1,413 static pages, covering the full destination/tool/blog parameter set rather than only the representatives opened manually.

### Route handlers and data boundaries

All 33 handlers were reviewed by concern: authentication/callbacks, trips and sharing, itinerary generation/streaming/workflows, places/search, blog/newsletter/views, reporting/tracking/affiliate, account/profile/push tokens, health, and maintenance. High-risk fixes included:

- Ownership-aware share revocation with affected-row verification.
- Merged-range validation for partial trip date updates.
- Premature SSE disconnect recovery through non-overlapping, abortable polling.
- A single canonical auth callback and strict same-origin redirect validation.
- Immediate shared-page freshness after revocation.
- Bounded validation, pending feedback, and honest failure outcomes at mutation call sites.

## Highest-impact defects resolved

| Area | Original failure | Resolution |
| --- | --- | --- |
| Mobile boot | Expo web opened blank because Metro selected an incompatible Zustand middleware build | Scoped Metro to the compatible CommonJS middleware entry |
| Mobile boot | Unsupported notification API covered web with an error overlay | Notification initialization is a web no-op and remains native on devices |
| Onboarding | Next could leave users stuck on slide one | Requested index now drives state; scrolling only synchronizes presentation |
| Trust | Guests were told trips were saved to an account they did not have | Copy now distinguishes local guest use from signed-in synchronization |
| Guest UX | Trips/Profile buried the main decision under promotional clutter | Reduced each page to one purpose, one primary action, and a restrained secondary path |
| Account setup | Provider buttons appeared on platforms where they could not work | Apple is iOS-only; Google uses Supabase OAuth on web and the native SDK on devices |
| Trip creation | Two divergent creation routes and ignored destination deep links | `/create` is canonical; `/trips/new` is a permanent redirect; recommendations initialize the form |
| Date selection | Four competing months overloaded a mobile sheet | One-month navigation, explicit range state, stable confirmation, and accessible targets |
| Direct routes | Cold trip links could spin forever or display the wrong cached trip | Exact-ID loading with hydration, remote fetch, auth/offline/not-found/retry recovery |
| Settings | Signed-out users could open account pages and failed saves could look successful | Group auth guard, checked API responses, rollback, busy/error states |
| Password recovery | Forgot password posted to a nonexistent API and redirected to a missing page | Shared Supabase request logic plus a complete reset-password route |
| Draft continuity | Auth interrupted web creation and discarded work, especially when email confirmation opened in another tab | Token-scoped, expiring local drafts survive the login/signup handoff across tabs; Expo web OAuth separately preserves its route and trip draft in session storage |
| World map | Pointer movement rerendered all geometry; dialogs lacked keyboard ownership | Imperative tooltip movement, semantic map summary, named dialogs, focus trap/Escape/restore |
| Quiz | The final answer could be omitted from the result | Result calculation includes the just-selected final response |
| Blog | Live categories could 404; content freshness and paginated metadata were inconsistent | Live category contract, hourly ISR, request caching, correct titles/canonicals, loading UI |
| Sharing privacy | Social buttons could publish a protected trip URL before public sharing existed | Social actions require a server-known public URL; owners can revoke sharing with feedback |
| Streaming | A naturally closed SSE connection could leave generation stuck or retain a failure banner after polling succeeded | Premature close activates one-at-a-time polling; a completed server state reconciles the stream to success and clears the transient disconnect error |
| Mutation integrity | End-only/start-only trip date patches could create invalid ranges | Stored and incoming dates are merged and validated before update |
| Security | Raw auth redirects admitted malformed external targets | All entry, proxy, and callback paths use one hardened redirect validator |
| Performance | Scroll/pointer events caused unnecessary React work and layout animation | rAF/coalesced updates, transform-based progress, memoized headings, parallel server reads |
| Accessibility | Reduced motion, dialog focus, loading announcements, names/states, and target sizes were inconsistent | Shared reduced-motion behavior, focus containment/restoration, status semantics, explicit labels/states |
| False affordances | Export, favorite, settings, and duplicate dashboard actions did nothing or led nowhere | Removed dead controls and retained only supported actions |
| Codebase cohesion | Duplicate primitives, registries, loaders, barrels, and forms increased drift | Removed 18 unreachable web modules plus obsolete mobile route/component code |
| Metadata/perceived speed | Duplicate title suffixes, stale canonicals, and avoidable LCP warnings weakened polish | Correct metadata contracts, eager above-fold imagery, appropriate dynamic/cache settings |

## Cross-app consistency and accessibility

- Primary actions are now singular and explicit on guest, create, auth, empty, and recovery screens.
- Copy no longer promises account storage, one-tap booking, public sharing, or successful saves before those states exist.
- Mobile and web use the same destination-to-create query contract.
- Empty, loading, error, offline, invalid-route, disabled, success, and retry states have an intentional outcome.
- Dialogs are named, focus enters them, forward and reverse Tab stay contained even from the dialog container, Escape closes them, and focus returns to the trigger.
- Selection and disclosure controls expose pressed/expanded/selected/busy states where relevant.
- Reduced motion disables nonessential entrance, pulse, smooth-scroll, and transform effects while preserving content.
- Web pages keep a skip link, coherent heading hierarchy, visible focus treatment, and descriptive controls.
- Native touch controls retain at least 44-point targets on the high-frequency create/date/auth flows.
- App-owned console warnings from shadows and native animation drivers were removed through shared platform-aware primitives.

## Verification

| Check | Result |
| --- | --- |
| Mobile TypeScript | Pass — `tsc --noEmit` |
| Mobile lint | Pass — ESLint |
| Mobile tests | Pass — 18 suites, 150 tests |
| Expo project health | Pass — Expo Doctor 18/18 checks |
| Web TypeScript | Pass — `tsc --noEmit` |
| Web lint | Pass — ESLint |
| Web tests | Pass — 59 files, 376 tests |
| Web production build | Pass — Next.js 16 build, 1,413 static pages generated |
| Diff integrity | Pass — no whitespace errors from `git diff --check` |
| Runtime route matrix | Pass — public routes 200; private guest routes redirect; `/trips/new` 308; invalid page/share 404 |
| Browser console | Next.js critical routes clean; Expo app-owned shadow/native-driver warnings cleared |
| Responsive runtime | Desktop and mobile create/date flows, blog, tools, 404, auth, world map, and Expo proxy inspected; date-picker controls verified at 300px, 420px, and 539px viewport heights |

Screenshots and two original repro recordings are retained in [`screenshots/`](screenshots/) and [`videos/`](videos/).

## Remaining risks and dependencies

These are verification dependencies, not known broken product behavior:

1. Complete Google/Apple authentication requires configured production provider credentials and cannot be concluded in an anonymous local session.
2. A valid authenticated Supabase trip is required for a true end-to-end vendor-generated itinerary, owner-only edit, and public-share lifecycle. Those boundaries are covered by code review and automated API tests.
3. Notification permission prompts, haptics, app-store review, universal links, and safe-area behavior should receive a final physical iOS/Android release-candidate pass.
4. Production itinerary quality and latency depend on configured AI, hotel, flight, and place vendors; the UI now reports and recovers from their failure states.
5. Track the upstream React Navigation/React Native Web `pointerEvents` development warning and remove this note when the framework adopts style-based pointer events.
