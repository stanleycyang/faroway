# Viator hosted checkout

This release adds a gated provider handoff for Viator experiences on owned web
itineraries. Viator hosts payment and booking support. Faroway does not collect
card data, reserve inventory, or submit a booking. This is not embedded payment
or a multi-provider cart.

## Enablement

The server requires `VIATOR_HOSTED_CHECKOUT_ENABLED=true`, an existing valid
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

## Traveler flow

1. Select a Viator experience in an owned itinerary.
2. Review the planned date and party, provider ownership, commission disclosure,
   and the need to confirm final price and cancellation terms on Viator.
3. Continue: the server verifies ownership and the itinerary item, resolves the
   canonical URL from Viator, and saves the handoff before returning a URL.
4. Navigate in the same tab. Browser back or reopening the trip reloads saved
   steps. Repeated requests reuse the same opaque attempt ID.

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
