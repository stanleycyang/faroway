# Build and bundle review — in progress

Current inventory: 472 app/workspace TS/TSX source files, 1,024 local import edges. Static inventory excludes tests and generated declarations; dynamic nonliteral consumers remain a limitation.

| Boundary | Evidence | Judgment |
| --- | --- | --- |
| Trip itinerary map | TripDetailClient renders the dynamic ItineraryMap only while mapOpen; Leaflet depends on browser APIs; fallback reserves h-64/sm:h-80. | Existing conditional chunk and ssr:false justified. |
| PlacesExplorer | Mounted alongside rendered itinerary; imports React and small local display validation, with no map SDK. Its collapsed panel starts no lookup unless opened with a place ID. | No demonstrated heavy hidden dependency; retain existing import pending measured bundle data. |
| ShareConsentDialog | Native dialog and a single React effect; no third-party dialog dependency. | Eager small dialog is not a heavy hidden-module finding. |
| Plan editing | PlanEditor imports Zod/local command validation; rendered only when feature enabled, plan exists and brief is current. | Conditional eager payload candidate; measure emitted chunks before claiming a performance improvement. |
| Common icons/date helpers | Installed Next16.2.11 config.js lines985–989 includes lucide-react/date-fns in default optimized imports. | Absence of explicit config entries is not a defect. |
| Social image fonts | Node font reads and explicit trace globs; compiledUX140 traces and allthreePNG routes passed. | Packaging verified at frozenUX140; current deployment execution pending. |

The category is incomplete: finish selected component dependency bodies, remaining workspace package manifests, Sentry namespace usage, and current emitted bundle sizes. Current-source inventory is newer than compiledUX140; do not treat that build as current full acceptance.


Supplemental source review through UX151: all workspace package manifests and root/web manifests read. Supabase uses explicit client/server/mobile exports; other shared packages expose their TS source entrypoint and are internal workspaces. Sentry client/server/edge configuration and root/blog/test error capture callers read: namespace calls serve initialization/integrations/capture rather than an indiscriminate local UI barrel. No new verified import defect from these bodies. Selected component dependency bodies and current emitted chunk measurement remain required before this category is complete.


UX152 route-boundary supplement: shared-token layout performs its own missing-link lookup above the leaf page. A parent shared-links layout/not-found boundary is required for the scoped recovery to catch that failure; both shared operational error and revoked-link stories are verified in actual Next browser checks. The leaf-only attempt rendered the root404 and was replaced rather than retained as redundant code. Installed boundary behavior was inspected with the official not-found component hierarchy reference: https://nextjs.org/docs/app/api-reference/file-conventions/not-found .


UX154/155 measured boundary review: two production snapshots of the same594-file set differ only in FadeInOnScroll imports. The hook facade’s useUser re-export retained a247371-byte Supabase SDK chunk in public route entries. Direct scroll/motion imports remove248994rawbytes (about65500offlinegzipbytes) from home/About/Support/article root/layout/page entry budgets. Both builds passed410staticpages/types;138public/mocked browser checks passed through154 and18content/motion/noJS checks passed through155. Auth/create and private planning-consent code retain their required SDK; private itinerary entry budget excludes the Leaflet SDK fingerprint, matching its conditional map chunk. Current social font traces and allthreePNG endpoints passed through155.

Measurements are emitted code budgets, not observed complete network transfer or speed. Artifacts compiled-route-chunks-ux154.json and compiled-route-chunks-ux155.json include selected entries and explicit excluded buckets. Broader build category remains in progress: finish remaining selected body/boundary judgments and final coverage matrix; profiling is not replaced with a gzip estimate.

Selected dependency-body supplement through UX160: reviewed complete PlacesExplorer, its display/URL normalization module, ShareConsentDialog, and PlanEditor save/read/disclosure boundaries. PlacesExplorer has no map SDK, aborts hidden/closed/unmounted requests, and validates normalized DTOs before rendering. ShareConsentDialog uses native modal semantics and safe cancel as initial focus; no large dialog library. PlanEditor retains command/schema validation and revision fencing; preserved disclosure state does not suppress keyed refresh. These bodies support the retained eager-small-component judgments above; they do not replace full remaining import-boundary coverage or observed network profiling.

UX176: SDK legacy client-config body was not included in prior production client chunks; current installed SDK entry discovery and actual compiled marker check confirmed the missing initialization boundary. Migrated unchanged configuration into Next instrumentation-client entry and exported router-transition hook. Fresh production build411pages/types plus51browser checks pass; live SDK options/query sanitization verified across3profiles. Current browser bundle now carries intended monitoring initialization; current startup/bundle-cost reconciliation and live delivery remain separate. No unsupported telemetry-delivery claim.
