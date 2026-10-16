# Real Next routes with a synthetic private account

`private-next-routes-qa.spec.ts` exercises the actual proxy, Server Components,
RSC card slots, client hydration, private itinerary day navigation, and the Next
trip error boundary. It uses `private-route-service.mjs`, a loopback-only,
synthetic Supabase HTTP service on port4017. It is read-only by default. The fixture returns two
synthetic account identities, one saved two-day Paris trip, and deliberate read
failures. It never forwards to an upstream provider. With the explicit
`PRIVATE_ROUTE_MUTATIONS_QA=true` flag, it permits only sharing-field PATCHes
on the synthetic trip and a local fixture reset; mutations remain in memory unless the isolated SQL mode below is explicitly enabled.

Run the fixture from `apps/web` with `node e2e/fixtures/private-route-service.mjs`.
Start the Next dev server on3124 from an environment containing only the shell
runtime variables and these test values:

- `CI=true`, `NEXT_TELEMETRY_DISABLED=1`
- `NEXT_PUBLIC_SUPABASE_URL=https://faroway-private-route-fixture.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-public-key`
- `SUPABASE_SERVICE_ROLE_KEY=qa-disabled-privileged-key`
- `FAROWAY_PLANNING_PAUSED=true`
- `NEXT_PUBLIC_BASE_URL=http://localhost:3124`
- `NODE_OPTIONS=--import=<absolute-path-to-e2e/fixtures/private-route-fetch.mjs>`

The QA-only Node preload redirects every request to the synthetic Supabase
hostname into the loopback service. The hostname keeps image URLs compatible
with the app’s existing HTTPS Supabase image allowlist; it never forwards to a
real Supabase project. Do not add localhost to the production image allowlist.
The browser suite blocks HTTPS calls. Run browser checks with
`PRIVATE_ROUTE_SYNTHETIC_HOST=true` so the synthetic cookie matches that hostname.

The isolated QA checkout must not contain active `.env` files. Its Next server
must be the sole writer to its `.next/dev` directory. Run:

```sh
CI=true PRIVATE_ROUTE_QA=true PRIVATE_ROUTE_SYNTHETIC_HOST=true E2E_BASE_URL=http://localhost:3124 bunx playwright test e2e/private-next-routes-qa.spec.ts --workers=1 --retries=0 --timeout=60000
```

To include the sharing consent/canceled-sheet/revocation story, start the fixture
and browser command with `PRIVATE_ROUTE_MUTATIONS_QA=true`. These are synthetic
local-state writes, with real Next share handlers and public rendering; they do
not change any staging or production row. The default command skips that story.

The explicit flags keep this dedicated suite out of ordinary browser runs. The
suite blocks browser HTTPS requests and intercepts the weather lookup. Fonts
use the normal server font loader; the system-font component fixture is not
compatible with this Turbopack runtime.

Synthetic JWT cookies and provider responses are test inputs. Passing these
checks proves app routing/rendering/recovery at this boundary, not real OAuth,
Supabase JWT verification, RLS, production data correctness, paid generation,
external booking, or deployed acceptance. The fixture's `GET /__qa/requests`
contains request paths/query filters without tokens or credential headers.

## Synthetic planning observation

For list pagination only, `PRIVATE_ROUTE_LIST_QA=true` returns205 synthetic owned
trip summaries from the existing loopback trip-read endpoint, honoring its limit
and UUID continuation boundary. This verifies actual Next page sizes and client
continuation without hosted rows; it does not implement full PostgREST semantics
or prove real database ordering. Individual-trip reads stay on the fixed fixture.

For observation-only planning checks, use `PRIVATE_ROUTE_GENERATION_QA=true`
on the loopback fixture, with SQL and mutation flags absent. This mode offers
only fixed local `POST /__qa/generation/begin`, `/hotels`, `/itinerary`, and
`/complete` phase controls. Owner-filtered search/trip reads expose the synthetic
job to the actual Next SSE route. Keep `FAROWAY_PLANNING_PAUSED=true` on Next;
this fixture never dispatches a workflow or calls an AI provider. Generation
and SQL modes are rejected when combined. These controls test observation and
UI recovery, not durable generation or real provider output. The fixed
`POST /__qa/generation/read-fail` and `/read-recover` controls toggle only local
search-read availability, preserving the existing partial chapters and job ID.

## Isolated SQL mode

### Complete-schema creation story

`PRIVATE_ROUTE_CREATION_QA=true` is a separate fixture mode for the
`full-schema creation` browser case. Do not combine it with SQL, generation,
native, or list mode. It uses `private-creation-sql.mjs`, which verifies that
`faroway-ux-full-schema-qa` is running without a network or published ports and
has the expected `full-schema` QA label before executing anything.

The database must already contain the reviewed complete application schema.
The reset endpoint changes only the fixed synthetic QA owner's local rows.
Creation and brief updates execute the actual `create_trip_once` and
`update_trip_brief` functions as `service_role`. Trip reads honor flat column
projections, so absent owner fields are not hidden by the fixture.

Run the browser case with `PRIVATE_ROUTE_QA=true`,
`PRIVATE_ROUTE_CREATION_QA=true`, and `PRIVATE_ROUTE_SYNTHETIC_HOST=true`.
Keep planning paused on Next. The case declines consent, loses a committed
creation reply, reloads and retries the same identity, reopens the single saved
trip, and saves/reopens an edited brief. Synthetic authentication still does
not prove hosted JWT validation, RLS, or live AI execution.

The editor and booking-report stories additionally require
`PRIVATE_ROUTE_SQL_QA=true` on both the fixture and browser command. Enable
`FAROWAY_PLAN_EDITING_ENABLED=true` and
`FAROWAY_BOOKING_CHECKLIST_ENABLED=true` on the dedicated Next process. Keep
`PRIVATE_ROUTE_MUTATIONS_QA=true` on the fixture.

This mode requires the disposable Docker container
`faroway-ux-transactions-qa`, labeled
`faroway.qa=full-flow-ux-2026-10-13`, running PostgreSQL with network `none` and
no published ports. The adapter verifies these properties before accepting
requests. Initialize this container with
`scripts/qa/private-transactions-bootstrap.sql`, then the actual migrations
`20261003005000_version_trip_briefs.sql`,
`20261003007000_revision_safe_plan_edits.sql` and
`20261003008000_trip_booking_checklist.sql` from the repository. This is a
minimal transaction substrate, not the complete application schema.

Each SQL story explicitly resets only the synthetic trip. Reset is atomic and
clears its cascaded history/reports. Editor/report RPC calls execute the actual
PostgreSQL functions; trip reads return persisted rows. Sharing PATCHes also
persist in this container. The loopback service never forwards to hosted data.

```sh
CI=true PRIVATE_ROUTE_QA=true PRIVATE_ROUTE_SYNTHETIC_HOST=true PRIVATE_ROUTE_SQL_QA=true PRIVATE_ROUTE_MUTATIONS_QA=true E2E_BASE_URL=http://localhost:3124 bunx playwright test e2e/private-next-routes-qa.spec.ts --grep SQL-backed --workers=1 --retries=0
```

Passing this mode proves the selected UI → Next handler → SQL function →
persisted reload cycle. Authentication and REST projection are synthetic, and
it does not prove the full production schema, hosted JWT/RLS, real bookings,
or native device behavior.

To verify the parent shared-layout loading boundary, start the read-only fixture with `PRIVATE_ROUTE_DELAY_QA=true`. This delays only shared-trip reads by three seconds per provider request. Run the browser command with the same flag and `--grep "delayed shared layout"`; the story asserts visible loading followed by focused recovery and removal of loading. Provider retry behavior can extend the total recovery time; the test allows 20 seconds for recovery, without changing production deadlines.

The sign-out recovery story requires `PRIVATE_ROUTE_LOGOUT_QA=true` on the browser command, with the default read-only fixture. Its rejected logout endpoint exercises unconfirmed sign-out; the current SDK clears the local cookie, so retry completes to sign-in. This does not prove hosted session revocation. Use `--grep "failed sign-out form"`.

The SQL-backed brief story executes `update_trip_brief` and verifies changed dates, preserved explicitly stale previous plan, and reload persistence. The adapter supplements minimal SQL rows with synthetic template metadata; it does not claim full PostgREST/schema coverage. Use `--grep "SQL-backed brief save"`.

Read-only shared-data recovery cases: synthetic tokens `qa_unreadable_days_token` and `qa_unreadable_tips_token` return a public trip envelope with malformed days or tips. They exercise actual Next loader/layout recovery, including focus, retry and help, without database writes or hosted share access. Their existence does not prove hosted token/JWT/RLS behavior.

Native QA mode: PRIVATE_ROUTE_NATIVE_QA=true enables only an owner-filtered synthetic users row (GET/PATCH) and local logout204. All profile changes are in-memory. The isolated native worktree may use a declared loopback-gated startup override with an unsigned synthetic session; authoritative production Auth code is untouched. No signup/provider/email/account-deletion endpoint is enabled. This verifies native UI→actualNext→localREST behavior, not JWT signatures, hosted RLS, release OAuth or native notification delivery.

Native mode alone also enables loopback POST `/__qa/profile-read/fail` and `/__qa/profile-read/recover` to toggle synthetic users GET503 for recovery checks. These controls affect only fixture memory; PATCH behavior is unchanged. Provider restart resets the synthetic profile and clears this fault. They are never production endpoints.

Native fixture mode additionally offers fixed `POST /__qa/logout/fail` and
`/recover` controls, switching only its synthetic Auth logout response between
503 and204. The actual Next/Supabase SDK recovery story checks the error page,
local session-check exit, retry, successful synthetic provider response, cleared
cookies and denied private dashboard access. A failed provider response can
still clear the local SDK session; this is not confirmation of hosted remote
session revocation. Fixture request logs include method/path/query only.

`PRIVATE_ROUTE_AUTH_DELAY_QA=true` adds only a synthetic PKCE token exchange for the literal qa-stalled-code/qa-synthetic-verifier pair. It waits25seconds then rejects400; no session or credential is issued. Request log omits body/verifier. This exercises actual Next/SDK callback deadline without upstream forwarding.
