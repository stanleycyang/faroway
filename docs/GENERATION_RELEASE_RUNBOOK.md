# Trip generation: transaction rollout and verification

Status: implemented and tested locally, **not deployed or launch-approved**. September 4, 2026.

## What this change guarantees

The trip generation API uses `20260904000000_atomic_trip_generation.sql`:

- `begin_trip_generation` locks the owned trip and commits its search, compatibility tracking, preview, generation identity and rate-limit consumption together. Concurrent requests cannot create two active attempts for the same trip.
- `Idempotency-Key` identifies caller intent. Reusing the key and preferences returns the original search, including its terminal status, without another workflow dispatch or rate-limit charge. Reusing it for different preferences returns 409. A new key while a generation is active returns 409 with the current search ID. Legacy callers without a key remain accepted but do not get replay protection after an attempt finishes.
- Progress, failure and completion require the current trip/search identity. A superseded worker cannot replace the current itinerary or progress. Completion commits result rows, itinerary, spec, trip status, compatibility status and one notification together. Retrying that transaction does not overwrite subsequent user edits.
- Startup errors attempt to invalidate the claimed generation and retain trip/search/polling IDs in the response. If dispatch actually succeeded before returning an error, the worker must pass the same fencing checks.
- Cleanup locks trips before searches and checks search heartbeats. It repairs abandoned attempts, including legacy attempts missing search/tracking records. A legacy generating trip linked to a completed search is preserved and counted as `unreconciledTrips`; it needs an operator to establish whether its itinerary was actually saved.

These are database guarantees, **not exactly-once external execution**. The runtime can retry steps; provider calls are outside database transactions. A process can still die between committing initialization and dispatching the workflow. Durable dispatch recovery, stable client keys across restart, and reconnection UX remain open work. The standalone `/api/search/start` path is not migrated to these trip-specific transactions.

## Local and CI verification

Install PostgreSQL server tools (`initdb`, `pg_ctl`, `postgres`) and the `psql` client. Then run from the repository root:

```sh
bun run test:db:generation
```

If binaries are outside PATH, set `PG_TEST_BIN` to their directory and optionally `PG_TEST_PSQL` to the client executable. Do not run as root (`initdb` rejects it).

The runner creates a new temporary Unix-socket-only database, does not accept a database URL, and never connects to an existing Supabase project. It applies the relevant repository migrations with a minimal test auth schema, runs real concurrent SQL connections and injected rollback failures, stops the cluster, and retains diagnostics. It is not an end-to-end test of all historical migrations, real Supabase authentication/RLS, or the deployed Workflow runtime.

Local result: 12 tests passed on PostgreSQL 18.4. CI now has a required PostgreSQL 16 generation transaction job before the web build; the hosted CI run has not been observed. Tests cover concurrent starts/replays, shared per-user quota, ownership, changed trip snapshots, rollback, stale writes, retry-safe completion, provider string IDs, function privileges, request fingerprints, heartbeat cleanup, and legacy partial state.

## Deployment prerequisites — explicit approval required

1. Identify the exact staging/production project and compare its migration history and actual schema. Confirm a recent restorable backup and the migration rollback/recovery owner. Do not run `db push` against an assumed target.
2. Verify the full pending migration sequence in a production-like staging database, including the preceding security-function migration and all schema prerequisites. Inspect legacy generating trips, completed searches lacking a current saved itinerary, and `search_itineraries` activity-ID consumers.
3. Configure the secret rate-limit salt and authorized cleanup job. Missing salt fails closed in production. Do not rotate the salt casually: rotation changes quota bucket identities.
4. Stop admitting new generation requests and drain old deployed workflows before the coordinated cutover. Old workflow code writes directly to tables and does not acquire these fences. Do not claim mixed-version safety or zero downtime.
5. With approval, apply the reviewed migration to the exact target. The activity and meal ID arrays change from `UUID[]` to `TEXT[]` because they contain provider IDs, not foreign keys. Existing UUID values are preserved as strings. This alteration can acquire table locks: assess table size and schedule the change appropriately.
6. Deploy the matching API and workflow code, verify RPC availability and grants using the real service role, then verify ordinary users cannot invoke privileged functions or read another user's trips/searches. Restore admission only after smoke checks pass.

## Target smoke checks

Use an approved test account and provider test mode/inventory. Obtain authorization before incurring provider costs or modifying production records.

- Race multiple starts for one trip; observe one search and one workflow dispatch. Repeat the same key during execution and after completion; check identical IDs and no additional quota charge.
- Reject a reused key with changed preferences, another user's trip ID, and an obsolete trip snapshot. Verify a sixth generation within the quota window is denied across different trips.
- Exercise failure before dispatch, ambiguous dispatch, runtime retry, interrupted persistence and stale completion after a new attempt. Verify all three public states (trip, search and compatibility polling) agree and no notification/result rows duplicate.
- Reconnect both clients to the same trip after network loss. Separately test restart/background recovery once client persistence is implemented; do not substitute an API-only check.
- Check saved provider IDs resolve in itinerary reads, then verify completion and later user edits survive a retried worker.
- Run the authorized cleanup job; confirm active heartbeats survive, abandoned attempts settle, and `unreconciledTrips` is zero or every listed legacy case has an approved recovery plan. Never infer successful persistence solely from `searches.status = 'completed'` on pre-migration runs.
- Record actual runtime IDs, sanitized logs, row counts, monitoring alerts and test outcomes in the release evidence. No production verification has been performed as of this document.

## Recovery and rollback

Disable new generation admission first; retain existing trip/search IDs and do not delete user itineraries or request records to make tests pass. Drain or stop affected workers with operator approval. Prefer a forward fix to the transactional functions; do not run old unfenced workers alongside new active attempts.

The table/functions can remain present during an approved application rollback. Do **not** blindly convert activity arrays back to `UUID[]`: new provider string IDs cannot be cast and would require a reviewed data-preserving migration. Verify recovery in staging and restore from the approved backup only under an explicit recovery plan. Data restoration, migrations and deployment require separate authorization.
