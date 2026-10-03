# Editable trip brief: review and rollout

This draft stacks on the recovery/sharing draft. Nothing here authorizes deployment, production SQL, provider activation, or purchases. Follow `trip-recovery-rollout.md` first; production baseline is `4f68fe54eac618395a8ebb23d0d124f3799adb28`.

## Behavior and limits

The web editor retains destination, dates, party composition, budget tier, origin, interests, and vibes. Saving uses the exact loaded `updated_at` timestamp as a revision token. Missing tokens receive 428; stale versions or an active generation receive 409. Inputs remain visible after conflict so the traveler can choose to load the latest brief.

A changed brief becomes a private draft, revokes its old public link, detaches the previous generation, and preserves the previous itinerary for reference. Old choices cannot be checked out or shared until the traveler explicitly requests a new plan and that plan finishes. Saving alone does not dispatch paid planning. Generation claims include the observed brief timestamp, and final publication still uses the recovery attempt fence.

Mobile clients in this branch carry revision tokens. Conflicting offline mutations remain stored with a blocked reason instead of retrying or silently overwriting. **A mobile conflict resolution screen is not implemented.** Older installed clients and old queued mutations without a token cannot save through the new API; they need an updated client or the web editor. This is a launch compatibility decision, not a completed mobile experience.

## Proposed staged release (approval required)

1. Finish review and green exact-head CI for the price, recovery, and brief drafts. Rehearse against a disposable copy of the real schema, including existing triggers and roles; the included PostgreSQL harness uses a representative schema.
2. Complete the recovery document's ordered four-migration rollout and drain old deployments/runs using positive backend evidence. Keep new planning paused during cutover. Do not use a blanket migration push.
3. Back up and apply only `20261003005000_version_trip_briefs.sql` in staging first. It adds the service-only `update_trip_brief` function and a brief-protection trigger. Verify grants, timestamp precision, existing timestamp triggers, and direct owner-write rejection. No new columns are required.
4. Deploy the compatible application while paused, then drain older application instances. The old PATCH implementation lacks revision checks, so it must not remain an accessible writer. Release the corresponding mobile client or explicitly launch web-only editing with an actionable upgrade path.
5. Verify two-device conflicts, edits racing generation, previous-plan retention, public-link revocation, blocked stale checkout, no-op saves, offline mutation preservation, and generation completion clearing the stale-plan marker. Reopen planning only after separate approval and the recovery acceptance checks.

Missing RPC/schema fails saves closed with 503. Prefer rolling forward to a compatible application if problems occur. Rolling back only the UI is safe if the protected API remains. Do not restore the old unversioned PATCH writer or remove the trigger while new clients/runs are active. Removing the function requires first removing its callers; retaining the trigger and previous itinerary is the safer paused state. Never restore revoked share tokens or reset generation state based on elapsed time.

## Next draft: itinerary locks and swaps

Introduce immutable itinerary revisions with stable item IDs and an explicit parent revision. A lock or swap request must include the observed plan revision and brief timestamp. Validate ownership, reject stale parents, and preserve locked items in one atomic publication transaction. A late agent response cannot replace newer traveler edits.

The traveler should lock favorites, request alternatives for one item, compare the differences, and explicitly accept a replacement. Keep the last accepted plan available while alternatives load; cancellation or provider failure preserves it. Swaps must not silently regenerate the whole trip or initiate checkout. Prices remain dated estimates until verified by an approved provider, and checkout requires fresh explicit consent.

Required tests: simultaneous device edits, a swap racing brief changes, retries with one request ID, locked-item invariants, stale agent completion, partial provider failure, interrupted/reloaded review, and checkout rejecting a superseded plan revision. This subsequent scope is not implemented in this draft.
