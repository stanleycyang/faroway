# Persistent activity booking checklist

This increment is a web checklist for itinerary activities, default off behind `FAROWAY_BOOKING_CHECKLIST_ENABLED`. It requires the reviewed PR23 schema plus `20261003008000_trip_booking_checklist.sql`. No production SQL, provider activation, payment, reservation or commission change is authorized by this document.

## What travelers can do

Each available activity starts at “Review / still needed”; this does not assert that a reservation is required. Travelers explicitly review and save “Still needed”, “I opened the provider” or “I booked this”. Opened/booked labels always say “reported by you”. The review explains that the action cannot make, change or cancel a reservation. Changing a booked report back to needed does not cancel the provider's booking.

Provider verification is explicitly unavailable. There is no independently verified booking ingestion or selectable verified status in this increment. A click, prepared handoff, provider URL, or traveler report cannot create a verified booking or commission. Affiliate ledger/conversion tables are never updated by checklist code. Hotels, flights, dining and native mobile checklist UI remain outside this smallest scope; their reservations stay with their providers.

## Persistence and recovery

An append-only report stores the authenticated owner, trip, stable activity identity, generation identity, observed trip timestamp, previous report, exact request command and canonical item snapshot. The database locks the trip and canonical itinerary, validates ownership/current brief/item, and compares the previous report before appending. Concurrent devices cannot silently overwrite one another. Reports do not advance the trip revision or invalidate checkout themselves.

A dedicated itinerary generation UUID rotates when generation updates generated_at; activity locks/swaps preserve it. Plan or brief changes preserve reports and mark them for review against the current trip. New generations do not inherit booked statuses even if an activity has the same name or positional ID. Previous reports remain available separately. Historical provider names are redacted when current content policy disallows them; there are no new outbound provider links.

Pending commands are retained per user/trip in browser storage. Checking saved progress fetches the server receipt for the exact request. A retry sends the same request identity; the database checks command equality, including after a plan changes. Older saved receipts remain checkable without transferring their status to a new generation. Discarding a pending retry does not delete a server report. Confirmed saves followed by failed refreshes offer refresh without resubmitting the save. Table UPDATE/DELETE are blocked except parent-trip deletion cascade.

## Rollout and validation

1. Keep the feature disabled. Obtain separate approval for 008000 and rehearse against an isolated database using the actual deployed schema, grants and triggers. Shared-database previews are not staging.
2. Verify 005000's monotonic trip timestamp fix and 007000's protected itinerary writes/history are installed. Apply only this reviewed migration; do not run a blanket migration push. Existing itineraries receive generation UUIDs; assess table size, locks, backup and bounded timeout before production approval.
3. Validate owner/cross-user isolation, no direct client RPC/table access, immutable reports, identical replay, rejected stale parents/briefs/generations, new generation separation, and no affiliate conversion mutation. The disposable PostgreSQL suite covers these with real SQL. Browser fixtures exercise the actual application routes with synthetic persistence; they are separate evidence from the real SQL checks.
4. Run desktop/mobile browser recovery tests, including lost POST replies, reload/receipt recovery, confirmed-save/failed-refresh, reviewed edits and regeneration. No real providers or shared preview database are involved.
5. Enable the flag only on an approved isolated deployment before seeking separate production rollout approval. Rollback by disabling the flag and retaining reports/schema. Dropping the report table loses traveler history and needs separate approval. Keep the generation trigger while compatible writers may run.

Verification of supplier bookings requires a future separately approved integration with authenticated provider evidence, idempotent event ingestion, cancellation/refund states and attribution reconciliation. Never promote self-reported statuses into that future evidence stream automatically.
