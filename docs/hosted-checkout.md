# Viator hosted checkout

This release adds a gated provider handoff for Viator experiences on owned web
itineraries. Viator hosts payment and booking support. Faroway does not collect
card data, reserve inventory, or submit a booking. This is not embedded payment
or a multi-provider cart.

## Content and processing approval gates

Viator API access and display are disabled unless both
`VIATOR_CONTENT_ENABLED=true` and a nonempty `VIATOR_CONTENT_APPROVAL_REF`
are configured. The reference is a non-secret identifier for the reviewed
commercial approval, not a credential or an assertion of legal certification.
Receiving a sandbox key or accepting a licence does not establish that the
current abbreviated product display is approved.

External AI and enrichment processing additionally require
`VIATOR_EXTERNAL_PROCESSING_ENABLED=true` and a nonempty
`VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF`. Without this separate approval,
Viator items do not enter aggregator prompts, the alternate AI agent's tools,
or TripAdvisor enrichment. Independently generated planning continues.

API calls are gated at the provider module. Read boundaries filter private and
shared trips, search results, and stream intermediates. New provider cards retain
the full description and a content-version marker. Legacy cards without that
marker remain hidden even when display is enabled; the code cannot recover
previously truncated text. Mixed legacy summaries are withheld when their
provider cards are removed. No stored trip is rewritten. Opaque cached
json-render cards are not replayed unless they carry the new source marker;
safe trip metadata, structured itineraries and progressive blocks remain available. Already-downloaded offline copies cannot be remotely
revoked by this server change.

Before enabling content, obtain review of required product fields, approved
display format, refresh/storage rules, copyright notices and takedown handling.
The current card is not certified to satisfy the licence's complete-product
information requirements. Keep provider wording separate from Faroway planning
prose; do not treat an AI rewrite as independent content. Noindex remains
required on private/shared itineraries.

## Enablement

The server requires the content approval gate above plus
`VIATOR_HOSTED_CHECKOUT_ENABLED=true`, an existing valid
`VIATOR_PARTNER_ID`, configured Viator API access, and production mode
(`VIATOR_SANDBOX` must not be `true`). The feature is disabled by default. Do not
enable it until the owner has verified the partner account, current terms,
attribution, and permitted API access. This change does not configure credentials
or apply a database migration.

The API-provided product URL must contain the configured account's PID, a numeric
provider MCID, and a medium. Faroway preserves these parameters and sends an
opaque attempt ID as campaign attribution. It does not put traveler names, email,
trip IDs, or traveler details in the URL. Missing/invalid links fail closed;
there is no invented product path or placeholder affiliate ID.

### Owner launch checklist

1. Confirm the partner account's permitted production API access, applicable
   terms, and the account PID. Confirm product-detail responses return canonical
   links containing that PID and provider-issued MCID/medium values.
2. Through the existing approved secrets-management process, configure
   `VIATOR_API_KEY` and `VIATOR_PARTNER_ID`; keep
   `VIATOR_HOSTED_CHECKOUT_ENABLED=false` until verification is complete. Use
   `VIATOR_SANDBOX=false` for the production API. Never put keys in source control.
3. Verify the deployed authentication, `affiliate_clicks` table, and rate-limit
   infrastructure. This release assumes the existing schema; no migration is added.
4. After approval to enable a controlled environment, turn on the gate and inspect
   an owned itinerary's handoff, provider product identity, canonical attribution
   parameters, final pricing/options, and recovery after returning. Do not pay or
   book during this check. Check partner reporting according to the account's
   reporting capabilities; a recorded click does not establish earned commission.
5. Confirm commission reconciliation with the partner's supported reporting
   process. A transaction-based attribution test requires separate authorization
   and provider-approved procedures. Enable production only after owner approval.
   Roll back handoffs with `VIATOR_HOSTED_CHECKOUT_ENABLED=false`; disable all
   API/content use with `VIATOR_CONTENT_ENABLED=false`. Restart/redeploy through
   the normal approved process when environment settings change.

These are owner actions, not setup performed by this change. The feature remains
blocked until account access, terms, and attribution are verified.

## Traveler flow

1. Select a Viator experience in an owned itinerary.
2. Review the planned date and party, provider ownership, commission disclosure,
   and the need to confirm final price and cancellation terms on Viator.
3. Continue: the server verifies ownership and the itinerary item, resolves the
   canonical URL from Viator, and saves the handoff before returning a URL.
4. Navigate in the same tab. Browser back or reopening the trip reloads saved
   steps. Repeated requests reuse the same opaque attempt ID and revalidate the
   canonical product with Viator; stored tracking URLs are never trusted on resume.

The existing `affiliate_clicks` ledger stores these steps with `checkout-` IDs
and an item key containing the activity ID and planned date. A prepared step is
not proof that navigation occurred, payment succeeded, or a booking exists.
The UI deliberately shows confirmation as unverified. Users must check Viator's
confirmation before paying again. Legacy conversion flags and browser query
parameters never confirm a booking in this UI.

Only the provider validates actual availability, options, traveler age bands,
final price, and cancellation terms. Product-detail retrieval is not a live
date-specific quote. Provider-supported prefill and confirmed-booking/report
reconciliation remain follow-up work. Other providers and public shared trips
retain their existing handoff paths.

Generated hotel/activity recommendations now have booking links and generated
review metrics removed in code, even if the model ignores its instructions.
This protects new generations; it does not rewrite historical itineraries.

## Verification

- `bun run check`
- `bun run test`
- From `apps/web`: `bunx playwright test -c playwright.checkout.config.ts`

The checkout browser suite bundles the actual component in an isolated local
fixture and mocks the API and provider navigation. It exercises consent,
keyboard dismissal, saved-history recovery, disabled configuration, failed
persistence, and retry identity on desktop and mobile Chromium. It is not a live
provider certification test or full authenticated Next.js journey.

For system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable.
Otherwise install the standard Playwright Chromium browser using your existing
development setup.

## Provider references

- [Viator attribution](https://partnerresources.viator.com/blog/attribution/)
- [Access levels](https://partnerresources.viator.com/travel-commerce/levels-of-access/)
- [Payments](https://partnerresources.viator.com/travel-commerce/api-payments/)

Embedded checkout is a separate scope requiring Full + Booking approval and
certification. Provider ownership of payment does not eliminate Faroway's
contractual, privacy, security, or applicable compliance obligations.

## Places API (New) and enrichment follow-up

Destination autocomplete calls `places.googleapis.com/v1/places:autocomplete`
with a city-only filter, server key headers, an explicit field mask and no-store,
bounded requests. Google predictions are now a separate live reference area.
Planning selection only accepts Faroway catalog facts or the traveler's own text;
clicking a Google reference never changes a planning input. Only catalog coordinates
reach the existing Leaflet preview. Native autocomplete uses the independent catalog
and explicit traveler input, and no longer calls Google's legacy endpoint.

Create drafts carry an explicit independent source marker and restore through a
whitelist. Legacy unmarked selections are not restored unless their ID/name match
the existing independent catalog. Dates and other trip preferences still restore.
Existing saved trips/offline copies are not modified or certified by this change.

`GOOGLE_PLACES_LIVE_ENABLED` defaults to false for all Google live references,
including city autocomplete. An existing API key alone cannot activate these
requests. `/api/places/autocomplete`, `/api/places/venues` and the details alias return a
graceful unavailable response before any provider or rate-limit-storage call while
the gate is off. Independent catalog/user-text planning remains usable. Enable
only after explicit billing, API restriction/quota and presentation/terms review.
The current public terms/privacy pages do not yet incorporate the required Google
Maps terms/privacy disclosures. Keep the gate off until that activation prerequisite
is resolved; this PR does not invent or certify legal terms.

When enabled, `/api/places/venues` serves user-triggered Text Search (New), capped at three results,
and lazy Place Details (New). `/api/places/details` is a compatibility alias to the
new display-only response; it no longer returns coordinates. Search requests only
ID, display name, address, Maps link and third-party attributions; details add business
status. These are Pro fields, not a free service. No enterprise ratings, hours, phone,
website, photos, reviews or AI summaries are requested. The panel makes no booking or
availability claims and includes Maps/provider attribution and source links.

The web trip page offers an independent live venue explorer. Responses stay in
component memory only while displayed, use no-store HTTP/fetch, clear on close/tab
hide, and are blocked from Sentry replay. No trip save callback, database write,
model invocation, persistent client cache, or cross-provider enrichment is wired to
the display. Detail requests use only the selected place ID. No Google data is
rendered on a non-Google map. Google activity/dining ingestion in the AI pipeline
remains closed. No Google data, including IDs, needs to be saved in this scope;
future saved references must persist IDs only and fetch display content afresh.

The existing `GOOGLE_PLACES_API_KEY` must belong to a project with Places API (New)
enabled, billing and appropriate API restrictions/quotas. Missing configuration,
provider failure and rate limiting leave planning usable. Key presence, billing,
actual cost and live access have not been tested. Autocomplete is per-request;
Text Search and Place Details use their Pro SKUs with no paid-field expansion.
Public terms/privacy and final provider presentation still need launch review.
The independent-source separation is an engineering boundary, not a legal opinion
about every applicable Google agreement or independently supplied destination fact.

Fallback and Tavily enrichment no longer invent stars; search relevance scores
are not customer ratings. Unpriced ideas carry `priceStatus: "unknown"` through
itinerary storage and web/mobile rendering. Positive displayed activity, dining,
and mobile hotel amounts are labeled estimates, and mobile budget summaries
explicitly warn that prices may be unknown. Generated dining reviews are cleared;
independent provider review fields are preserved. This does not revalidate legacy
saved ratings, confirm AI-generated venue names, or turn estimates into quotes.

References checked October 3, 2026:

- [Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Places policies and attribution](https://developers.google.com/maps/documentation/places/web-service/policies)

Regression coverage uses mocked providers only: independent destination/draft boundaries, lazy display/no-save browser flows, API contracts, key placement,
field masks, missing configuration, upstream errors, malformed coordinates,
blocked enrichment ingestion, honest price/rating presentation, and desktop/mobile
browser selection, attribution, and local fallback. Viator approval gates remain
unchanged.

## Optional MET Norway weather (disabled)

`MET_WEATHER_ENABLED` defaults to false. Activation also requires `MET_USER_AGENT`
identifying Faroway and a verified public business contact URL, the shared-cache
migration `20261003000000_met_weather_cache.sql`, Supabase service credentials and
`IP_HASH_SALT` for the existing distributed rate limiter. Do not substitute a made-up
contact. No API key or new account is needed. Nothing was enabled or migrated in
production; these are rollout prerequisites, not instructions executed by this PR.

The web trip panel loads only on a traveler click. Its backend accepts one of the
six existing catalog destination IDs and trip dates, never GPS coordinates or
traveler identity. Catalog coordinates are rounded to four decimals. Unsupported
locations are omitted; arbitrary free-text destination geocoding is out of scope.
Although MET has global coverage, this initial Faroway panel covers only that catalog.

The service-role-only shared cache stores forecasts plus `Expires`, `Last-Modified`
and fetch time. It serves cached data until expiry, uses conditional revalidation,
honors 304 and throttling `Retry-After`, and holds a 15-second distributed refresh
lock. The existing atomic shared rate limiter permits at most one aggregate upstream
request per second across destinations/instances, conservatively below MET's
20-per-second threshold. Cache/lock/rate-limit failure prevents upstream access;
there is no in-memory-only production fallback. An absent/past Expires backs off at
least one minute. Non-success responses are not displayed as forecasts. A 203
response carries an explicit deprecated-service warning.

Only actual forecast points overlapping upcoming trip dates are returned. Beyond
nine days the route returns unavailable without contacting MET; shorter actual
provider coverage is respected. The panel labels UTC timestamps, temperature,
precipitation interval and wind units, includes the provider update time, credits
MET Norway under CC BY 4.0, and identifies Faroway's selection/formatting. No
endorsement, precise long-range weather or trip availability is implied. Weather
is not passed into AI prompts or used to alter bookings.

Tests use synthetic forecasts and mock cache/provider calls. No live request,
contact verification, quota/load test or database migration execution was performed.
Before enablement, apply and verify the migration and service-role permissions in
an approved environment, check shared locking/rate limiting across instances, and
verify the public contact. The adapter deliberately fails closed otherwise.

- [MET Locationforecast HOWTO](https://docs.api.met.no/doc/locationforecast/HowTO)
- [MET terms](https://docs.api.met.no/doc/TermsOfService)
- [MET data license](https://docs.api.met.no/doc/License)

Ticketmaster remains deferred pending an applicable commercial/affiliate agreement.
