# LiteAPI integration and production acceptance checkpoint

## Implemented and verified

- Server-side LiteAPI v3 hotel-rate adapter with explicit destination, calendar dates, nationality and room occupancy. It refuses production keys before dispatch, requires an opt-in sandbox flag, validates sandbox responses, and preserves per-room totals, suggested public selling minimums, taxes and supplier terms.
- Authenticated, rate-limited preview-only `/api/hotels/liteapi` endpoint and `/hotels/sandbox` browser screen. Production cannot enable these sandbox routes. No booking, prebooking, payment, commission or supplier-confirmation claim is implemented.
- A real sandbox key was retrieved from the owner's signed-in Nuitee Connect dashboard, configured as a Secret only for `codex/release-candidate`, and omitted from chat/Git. Temporary credential files were removed.
- Direct sandbox search returned three hotels and three offers. Hosted browser → authenticated API → LiteAPI → UI acceptance passed on source `e1dd53092d9290541293e31772b530cdd4676b9d`, deployment `dpl_F2pdgZLao1VDcHQR3yv58n5PAzeB`. Included and additional taxes rendered separately. Screenshot: external review backup `staging-liteapi-quotes.jpg`.
- Corrected GetYourGuide's unsupported free-cancellation fallback and Duffel's inaccurate merchant/support code comment. Provider commercial access and production activation remain separate gates.
- All 1,113 unit/script tests passed (672 web, 318 mobile, 115 shared, 8 scripts), plus all 11 quality tasks. Six disposable database regression suites passed, including actual-schema bootstrap, ownership, sharing races, versioned edits/checkout, deletion recovery, creation replay and helper search paths. Offline rubric matched all 13 fixtures; it is not live-model quality evidence. Mobile release configuration and 18/18 Expo Doctor checks passed; no signed-device acceptance is claimed.
- Hosted staging RLS checks under the second test identity returned zero first-user trips, zero rows updated, and zero rows deleted. Each transaction rolled back. Direct authenticated HTTP edit/delete isolation remains unobserved.

## Live planning and sharing

A separate seven-day AI Gateway key, scoped only to the candidate preview, has an active $1 non-renewing budget. Preview SDK requests cap output at 8,000 tokens and disable SDK retries. The owner's total authorized AI test budget is $5. Gateway budgets are soft caps; output limits and sequential test dispatch preserve headroom. No team-wide budget or production key was changed.

The first synthetic New York run (Nov 8–9, two travellers) completed on source e1dd530. Trip `2f7c0d02-0669-4457-b24a-e4c29269024d` retained search `2d518e70-b24d-4500-ab57-0e35d3b568ee` and verified run binding `wrun_01M4PNJBC7R7X57SQ9KEDNMSAE` through a browser reload during generation. The second account had exactly one search after reload. Runtime logs and database state confirmed completion. Gateway spend observed afterward was $0.0586295.

Live quality failed this first case: hotel/activity/dining agents hit the 15-second test ceiling and the final itinerary relied on generic fallback suggestions. Source `9bae8957f6ba67e5770a603664f886e7cd403587` corrects defaults to 30-second orchestration, 60-second parallel AI agents and 30-second aggregation, retaining active aborts. It removes unsupported instant/60-second claims from create metadata. Its 672 web tests and 11 quality checks passed. The corrected preview is READY at `dpl_6nS6d6kLgxCNJMcBz54rEYEP6Zdm`. Retest awaits completion of the browser AI disclosure step; no second trip/search existed at the last database observation. Do not mark live quality passed yet.

Hosted synthetic sharing acceptance on the first completed itinerary passed: declining consent made no public link; enabling sharing displayed the shared itinerary; revoking sharing made the same token page show not found. Final database state was `is_shared=false`, with no share token. Native share-sheet/clipboard interoperability is not claimed from this test.

## Remaining production gates

1. Complete corrected live planning quality and failure/retry acceptance; keep stage spending bounded and restore the planning pause after the exercise.
2. Finish hosted API isolation, conflicting edits and disposable-account deletion acceptance. Password reset completion requires owner credential entry. Email delivery for one staging recovery email passed; production SMTP readiness remains pending.
3. Signed iOS/Android login, recovery, layout/accessibility, account deletion and provider-revocation acceptance.
4. Hotel room/nationality inputs in the normal trip flow, permitted supplier-content processing, production rate/checkout validation, cancellation/refund servicing, attribution and partner approvals. The sandbox hotel screen does not wire quotes into generated itineraries or enable commercial booking.
5. Production backup/restore evidence, dependency-ordered migrations, measured DDL bounds, positive old-writer/workflow drain, paused compatible deployment, health canary and rollback rehearsal. Main Git deployment hold remains enabled.

Read-only production reinspection at 2026-10-11 23:51 UTC confirms its migration ledger still ends at `20260725006000`; staged release/security migrations are not applied there. Security advisor still flags the owner-security `affiliate_stats` view, public privileged push helpers, mutable function search paths and disabled leaked-password protection. Some public functions are intentionally public; the advisor is not itself proof that every finding is exploitable. Existing reviewed security migrations and grants must be applied through the production cutover plan, not a blanket database push. No production SQL, deployment or provider activation was performed in this checkpoint.

References: [LiteAPI rates](https://docs.liteapi.travel/reference/post_hotels-rates), [white-label checkout](https://docs.liteapi.travel/docs/deeplinking-to-whitelabel), [Duffel agreement](https://duffel.com/services-agreement), [GetYourGuide API eligibility](https://partner.getyourguide.support/hc/en-us/articles/13981133907613-API-integration-and-requirements).
