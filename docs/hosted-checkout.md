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

Destination autocomplete now calls `places.googleapis.com/v1/places:autocomplete`
with a city-only filter, server-side `X-Goog-Api-Key`, explicit field mask,
no-store fetch, and bounded timeout. Details use `GET /v1/places/{placeId}`
with `displayName,location,attributions`; neither endpoint requests ratings,
reviews, photos, or opening hours. Response bodies retain the existing destination
selection contract. The compact prediction dropdown displays Google Maps text
attribution and separates Google predictions from the local fallback list.
Missing credentials and upstream failures leave local destination selection usable.

The existing `GOOGLE_PLACES_API_KEY` must belong to a project with Places API
(New) enabled, billing and appropriate API restrictions/quotas. A key being present
does not prove any of those conditions. No live credential validation or settings
changes were performed for this change. Autocomplete currently uses per-request
billing; session-token billing optimization remains a follow-up.

Google activity/dining enrichment previously entered AI aggregation and persisted
search/trip records. That ingestion is now closed, including the old exported
search helpers. A future transient attributed display must establish permitted
storage and model-processing behavior before restoring it. This is deliberately
not a migration of Google venue content into a new saved cache. Existing stored
content is not rewritten or deleted by this change.

Destination selection still passes a selected city name and coordinates into the
existing create-trip flow, including resumable drafts. Review that storage and
model-input path against the applicable agreement before production activation;
this patch does not certify it. The place-ID storage exception is not a blanket
exception for names, coordinates, predictions, photos, or reviews. Terms/privacy
pages and all eventual provider/author attributions also need launch review.

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

Regression coverage uses mocked providers only: API contracts, key placement,
field masks, missing configuration, upstream errors, malformed coordinates,
blocked enrichment ingestion, honest price/rating presentation, and desktop/mobile
browser selection, attribution, and local fallback. Viator approval gates remain
unchanged.
