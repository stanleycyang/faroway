# Revision-safe activity editing

This draft stacks on the editable-brief and recovery drafts. `FAROWAY_PLAN_EDITING_ENABLED` defaults off. It has not been enabled in production, and the SQL has only been exercised in a disposable local database.

## Delivered scope

Travelers can lock/unlock favorites and review a swap between two existing activities. The review identifies both dates and time slots. Only explicit confirmation publishes a swap. Provider names/descriptions/links remain unchanged; a swap never confirms opening hours, availability, price, travel time, or a reservation change. Hotel, flight, and dining edits and AI-generated alternatives are outside this increment.

Stable item identities survive moves. Both the observed trip timestamp and parent plan revision must match. The database computes the expected operation independently and compares the proposed schedule, so a caller cannot submit an arbitrary replacement or move locked items. Competing writes serialize on the trip row. A repeated request ID replays only the identical command whose result is still current. The browser keeps an interrupted command locally for explicit status checks or retry, without automatically starting work.

The first edit preserves the original schedule and overview; each subsequent revision stores its parent, full activity schedule, locks, command, and resulting timestamp. History is immutable and service-readable only; the owner API exposes approved item display data and history metadata. Public links are revoked after edits. Checkout publication remains bound to the observed trip timestamp. Swaps clear obsolete daily totals and generated schedule notes; they do not present a new live quote. A newly generated plan starts a new lock lineage while retaining previous history.

## Proposed staged rollout (requires separate approval)

1. Require green exact-head CI, independent review, and the recovery/brief rollout prerequisites. Rehearse all seven migrations in their documented order against the actual staging schema and roles. The local PostgreSQL harness uses a representative schema.
2. Keep editing disabled and planning paused. Drain old HTTP, cron, and durable workflow writers with positive backend evidence, including direct deployment URLs. This migration rejects unfenced legacy itinerary writes; a planning pause does not itself drain them.
3. Back up and apply only `20261003007000_revision_safe_plan_edits.sql` after migrations 005000 and 006000. It adds `trips.plan_revision_id`, the immutable history table, service-only edit RPC, itinerary/pointer protections, and a replacement generation RPC retaining the existing search-attempt fence. No traveler history is backfilled until an edit is accepted.
4. Deploy the matching application with editing still disabled. Verify unchanged generation completion, authenticated direct-write rejection, service-only history permissions, an exact lost-response replay, locked-item rejection, simultaneous edits, and rejection after brief changes. Confirm public-link revocation and old checkout attempts becoming non-resumable.
5. Obtain separate approval to enable editing after acceptance. Production write canaries, unpausing planning, and provider activation require their own approval; none are implied here.

## Rollback

Disable `FAROWAY_PLAN_EDITING_ENABLED` first; this disables the UI and both API methods. Preserve accepted revisions and the new generation RPC. A compatible rollback to the preceding application may keep the schema, but old generation code that writes itineraries directly is incompatible with the new trigger: pause ingress and drain it rather than dropping protections while work remains. Do not remove the generation RPC or history while queued compatible runs can resume. Do not restore revoked public tokens or infer a confirmed booking from a saved handoff. Any destructive history deletion or database restore is a separately reviewed operation.

## Remaining acceptance limits

Desktop/mobile web behavior uses the actual compiled app and local backend fixtures; real SQL invariants are tested separately in PostgreSQL. Native-device conflict-screen accessibility/layout and deployed Vercel workflow behavior still need staging verification. New AI alternatives need their own durable request/result persistence, stale-result rejection, comparison UI, and provider-content permissions; this draft deliberately offers existing-activity swaps and makes no claim that alternatives or live booking are enabled.
