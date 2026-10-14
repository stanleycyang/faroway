# Next streaming and loading review

Scope: all five route loading files, five route/root error files, and five explicit Suspense consumers found in the current app source. Bodies/callers were read with all five streaming rule shapes. This targeted category review does not establish every async route or streamed agent flow is accepted.

| Bucket | Reviewed sources | Findings / remaining evidence |
| --- | --- | --- |
| Loading routes | dashboard; private trip; shared trip; blog index; article | Named status and static skeletons; shared/private trip use common TripViewLoading. Dashboard dimensions correspond to current header/stats/filter/grid. Exact CLS and delayed-route visual comparison unmeasured. |
| Error routes | root error; global-error; private trips; shared trips; blog | Client retry/focus/recovery patterns present. UX145 corrects root-layout fallback contrast, focus and independent home navigation. Root-layout fault injection in actual Next remains unverified. |
| Suspense consumers | login; signup; forgot password; reset password; shared world-map | Boundaries guard search-parameter consumers. Auth recovery labels already readable; UX145 reuses MapLoading for the parent shared-map fallback. No independent server data siblings in these five consumers requiring nested reveal. |
| Recovery consolidation | TripRecovery; AuthPageFrame; MapLoading | UX134/139/142/145 converge presentation; runtime scopes stay distinct. No synthetic timing claims. |

Broader gaps: async routes without a local loading boundary need separate route-inventory comparison; SDK/SSE durable completion and cancellation are reviewed through their own flow evidence, not established by this category. No WCAG, CLS or complete-flow certification.

## UX161 — Async-route boundary comparison

Inventoried current async/default and metadata entrypoints in async-route-boundaries.json. Dashboard/private trip have local loading for owner-bound reads. Blog index/article/category/guides/cluster inherit blog/loading and blog/error. Destination/climate/cost/visa pages resolve params then local synchronous datasets; report resolves searchParams before its form. Shared world-map metadata resolves searchParams and decodes local URL data; its client consumer has Suspense. Preview hotel sandbox awaits auth without local loading; preview acceptance remains pending.

Shared token layout awaits loadSharedTrip above its own child loading boundary. Added app/s/loading.tsx with existing TripViewLoading to cover that layout lookup from the parent. Retained inner boundary for page suspension. Delayed shared-layout runtime navigation, metadata timing, status behavior and CLS remain unverified. Root-layout fault injection and native recovery remain open.

UX161 runtime follow-up: delayed shared-layout checks passed across desktop Chromium/mobile Safari/mobile Chrome (3 checks, 1 worker, zero retries, 1.1m). Each asserts visible named loading after initial document commit, then focused existing recovery heading and removal of loading. Initial three failures used an obsolete heading assertion; corrected assertion also allows 20s for existing provider retries with 3s delay per request. No production deadline changed. Loopback request paths captured in shared-delayed-read-requests.json, including both runs, without credentials. Targeted ESLint and whitespace pass; owned runtimes stopped after acceptance.
