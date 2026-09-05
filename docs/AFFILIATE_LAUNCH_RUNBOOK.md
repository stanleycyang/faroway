# Affiliate Launch Runbook

Last updated: September 4, 2026

Use this runbook before showing booking actions to live users. The application
is fail-closed: AI-only recommendations are informational, booking actions are
rendered only when a live provider supplies a URL, and the click endpoint
requires the URL host to match the named partner.

## What the code now guarantees

- Web booking links navigate through `GET /api/track/click`; recording is
  attempted before the browser receives a `307` redirect. A tracking failure
  must not be counted as a persisted click or verified commission attribution.
- Mobile booking links require confirmation, call `POST /api/track/click`, and
  open the returned tracked URL.
- Every tracked URL includes a unique `click_id`; persistence is confirmed only
  when the click insert succeeds. Viator links preserve provider-issued `pid`,
  `mcid`, `medium`, and API parameters. The outbound `campaign` value carries the
  click ID for partner report reconciliation. `mcid` is Viator's internal
  identifier and must never be overwritten. See [Viator's attribution guide](https://partnerresources.viator.com/blog/attribution/).
- Missing or malformed Viator product URLs are informational, not booking
  links. We do not construct a replacement product path or invent a partner ID.
- Hotel, activity, restaurant, and transport actions carry the trip ID when it
  is available.
- Partner URLs must use HTTPS and match the declared partner domain. A Booking
  URL labeled as Viator, an unknown partner, or an arbitrary URL is rejected.
- Affiliate disclosures appear next to monetized actions. Prices are labeled
  as estimates and availability, payment, cancellation, and changes are left
  to the partner.

## Activate the first live partner

Viator is the recommended first live partner because its sandbox integration
currently passes the repository vendor check.

1. Obtain production API and affiliate approval from Viator.
2. Set `VIATOR_API_KEY`, `VIATOR_PARTNER_ID`, and `VIATOR_SANDBOX=false` in the
   production Vercel environment. Do not put these values in mobile builds.
3. Run `cd apps/web && bun run vendors:check` against the production
   configuration. Viator must return real inventory and product URLs.
4. Generate a production-like itinerary and confirm that only live Viator
   results show a booking action; AI fallback activities must not show one.
5. Follow a booking action and confirm one `affiliate_clicks` row has the same
   ID as the outbound URL's `click_id` and Viator `campaign` values; verify that
   the original provider-issued `pid`, `mcid`, and `medium` are unchanged.
6. Confirm the click appears in the Viator partner dashboard or reporting
   export after its normal reporting delay.

Booking.com, GetYourGuide, Duffel, and other partners stay informational until
their production credentials and hosted booking URLs pass the same sequence.
Amadeus search results are intentionally informational: the current API offers
do not provide a Faroway affiliate checkout URL.

## Activate conversion reporting

`POST /api/track/conversion` is a normalized, signed internal ingestion
contract. It is not proof that a partner will send that exact payload.

Before counting bookings or commission in production:

1. Choose the partner-supported source: webhook, postback, or scheduled report
   import.
2. Implement or configure an adapter that verifies the partner's documented
   signature and converts its real payload to the internal conversion fields.
3. Configure credentials for the selected reporting mechanism. Existing
   server-only `*_WEBHOOK_SECRET` variables secure the normalized ingestion
   endpoint; they do not establish that a partner offers that webhook.
4. Replay signed fixtures for pending, confirmed, cancelled, duplicated, and
   unknown-click events. Duplicate reports must update one conversion row.
5. With explicit authorization, complete one controlled booking and cancellation
   or a partner-approved equivalent. Reconcile the partner
   order, `affiliate_conversions` row, click row, status, booking value,
   commission, and currency.

Until this section passes, use affiliate click-through rate as the monetization
signal and label conversion/revenue reporting as unavailable—not zero.

## Go/no-go checks

- `bun run env:check`
- `bun run check`
- `bun run test`
- `bun run build`
- `bun run release:check:mobile`
- `cd apps/web && bunx playwright test`
- Manual web and physical-device mobile tests cover accepted, cancelled,
  rejected-domain, offline/tracking-failure, and popup/new-tab paths.
- Legal copy and the partner program terms approve the disclosure text and
  link placement.

Go live with monetized CTAs only after the relevant partner-specific checks
pass. A provider being configured is not by itself evidence that attribution
or conversion reporting works.
