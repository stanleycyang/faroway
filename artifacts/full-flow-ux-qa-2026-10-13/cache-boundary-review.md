# Cache boundary review — selected scope

Fifteen risk-ranked bodies are reviewed: private/shared trip loaders; proxy; popular/trending destination routes; blog feed/layout/index/sitemap; weather cache/adapter/API; supplier runtime; LiteAPI; share API. This prioritizes ownership and persistent-cache boundaries. More than15 candidates match the whole-repository heuristics; remaining providers, routes and request fetchers are explicitly outside this targeted completion.

| Boundary | Judgment and evidence | Remaining |
| --- | --- | --- |
| Private trip reads | React request-scoped cache key includes trip and owner; owner filter on SQL read; operational failures do not become successful empty/404 views | Full private mutation/receipt/account-switch runtime |
| Shared trip reads | Active token plus is_shared filter; request cache deduplicates layout/page; force-dynamic route; real Next synthetic share/revoke/guest-reload checks passed | Live RLS and deployed cache behavior |
| Published blog | Persistent metadata cache keyed by public database URL; published-only projection; request dedup; paginated sitemap separate from listing cap | Remaining publisher invalidation paths and deployed timing |
| Public catalog | Explicit catalog/aggregate fields and response cache policy; no raw provider rows or traveler identities | Complete remaining catalog route scope |
| Weather | Shared destination-only rounded-coordinate key; no-store reads; TTL/conditional refresh/error backoff; global request permit; private/no-store API responses and request-date filtering | UX157 shared schema validates persisted/fresh/client forecasts; corrupt cache refresh remains lock/permit gated.25targeted and6actualNext synthetic stories pass. Live provider/deployed behavior remains separate |
| Supplier fetch | Defaults no-store; no hidden framework cache. UX156 keeps deadline through finite body methods and independent header acquisition | Current compiled/provider/network acceptance; direct raw readers rely on native fetch abort |
| LiteAPI | Sandbox-only configuration, date/occupancy/input guard, no-store quote read, strict sandbox response schema | Live sandbox contract/provider execution |
| Sharing mutations | Verified user/owner lookup and explicit public consent; revision check on creation; revoke active token; no persistent request cache | Native sharing and live RLS |

UX156: two stalled-response regressions failed beforefix.8runtime cases and complete834webtests/121suites passed afterfix; types/lint/whitespace passed. No real vendor, notification or paid planning request was performed.

UX158 supplementary mutation-reader bodies fully reviewed: plan/bookings GET/POST retain owner/revision/receipt guards, returnno-store, and defer actualwrites to atomicRPC. Readoutage now503, only realabsence404;20APItests and847fullwebtests pass. Actualbrowsereditor/report/receipt and liveSQLtransaction acceptance remainpending.

Current review supplement: actual private Next+isolated PostgreSQL editor/report cycles pass through UX168, and brief dates/stale-plan/reload cycle passes UX169. The transaction runner applies three actual brief/edit/report migrations, observes concurrent row lock, and passes14assertion groups. This supersedes the earlier pending-local-SQL sentence, while hosted JWT/RLS/full schema/deployed cache boundaries remain unproved. Shared/server Supabase client bodies reviewed: public cookie/bearer auth client is separate from lazily initialized privileged server client; no new confirmed attacker-controlled data-protection finding from these selected bodies. Browser import/deployment boundaries still require current compiled review; this is not security certification.
