# Faroway staging-only bootstrap approval

Prepared against release PR26, exact source `39e18f4049413f9c47b71da2bbf74e587352b7c9`. The owner-provided isolated target is **faroway-staging**, project **omovikloadpvzijoaqus**, Testimonio, Micro, Oregon, PostgreSQL **17.11**. Target metadata is supplied by the parent review; this task did not connect to it or execute external SQL. Production remains unchanged. No duplicate bootstrap work was present when the workspace resumed.

## Exact reviewable bundle

- [SQL approval artifact](../supabase/staging/approval/bootstrap.sql)
- [SHA-256 approval receipt](../supabase/staging/approval/approval.json)
- [Ordered migration manifest, including exclusions and original hashes](../supabase/staging/manifest.json)
- [Supplemental permissions](../supabase/staging/permissions.sql), [synthetic content](../supabase/staging/synthetic-content.sql), [fresh-install guard](../supabase/staging/guard.sql), [postconditions](../supabase/staging/postconditions.sql)

SQL SHA-256: `09b820436a77967f95024abf4f724f4f2f1bb1d3378ee33b73656593ba729939`.

Reproduce without a connection, credentials or SQL execution:

```sh
python3 scripts/build-staging-bootstrap.py --project-ref omovikloadpvzijoaqus --output-dir /tmp/faroway-staging-approval
python3 scripts/test-staging-bootstrap.py
```

The renderer refuses other project references, source checksum changes and unreviewed migration inventory changes. These are artifact safeguards, not proof of the operator's actual remote connection. Before external execution, independently verify that the selected connector/connection is bound to omovikloadpvzijoaqus. Never infer the target from a SQL comment, user-supplied setting or database name.

## Included schema and excluded production content

There are 36 pre-October migrations. The bundle installs 33 of them and excludes exactly:

1. `20260220200000_seed_destinations.sql` — production-storage destination images/content.
2. `20260725004000_repair_broken_blog_cover_images.sql` — production-storage image repair.
3. `20260725005000_repair_all_missing_blog_cover_images.sql` — production-storage image repair.

All 10 October schema files are included, **including `20261003000000_met_weather_cache.sql`**, which is required for a complete fresh schema in addition to the nine previously enumerated release files. Total: **43 original application migrations**. Source hashes remain pinned to PR26. Lifecycle 002000 follows 001000/003000/004000; this fresh target has no old application writers, but the release dependency remains explicit. Corrected005 and007 precede008.

Replacement content is two clearly synthetic destinations and two synthetic blog records (one published, one draft), with NULL image references. No real travel plans, people, Auth accounts, Storage objects, provider data or production URLs are copied. The historical images-bucket schema/policies create an empty public-read bucket; no files are uploaded. Synthetic test identities exist only in the disposable local test and are not part of the external SQL artifact.

## Atomicity and failure handling

The artifact is one transaction, ending in permissions, synthetic content, security postconditions and PostgREST schema-reload notification. The historical best-practices file's outer BEGIN/COMMIT is folded into the bundle transaction; its schema statements are unchanged. Generated output trims historical trailing whitespace; original-file hashes are retained in the manifest. No intermediate PUBLIC function access is committed. The fresh-install guard refuses an existing application schema and any PostgreSQL version other than the tested 17.11. Proposed execution limits are 2-second lock timeout and 60-second statement timeout. A failure must roll back the whole transaction; do not continue statement-by-statement, auto-retry, relax the guard or mark migrations as applied after a partial failure.

Use a trusted operator/connector able to execute the complete transaction. Do not use blanket `db push`; old filenames and the intentional three exclusions are recorded by this staging bootstrap manifest, not presented as a normal production migration chain. The operator must record the exact bundle hash, target, time and success evidence in the staging change record. Future incremental migrations require a separate plan; do not mislabel the skipped content files as installed. This is not a production upgrade script.

## Explicit Data API access with automatic exposure off

Grants and RLS are separate. The supplement grants no anonymous trip/profile/search access and no direct anonymous tracking/newsletter writes; those existing application routes use the service client and rate limiting. Public readers receive only destinations and published blog posts through existing RLS. Authenticated readers receive the existing owner-scoped surfaces. Direct itinerary and search writes remain server-only; lifecycle and version triggers continue to fence trip changes.

Native push-token registration/upsert/removal remains owner-scoped. Profile UPDATE is restricted to display name, avatar, preferences and notification settings; subscription/auth identity fields are not client-writable. Notifications permit only the read flag. Feedback updates exclude trip/user reassignment. The service role receives explicit current application table grants, while revision/report history remains SELECT/INSERT-only. Analytics and the affiliate aggregate remain server-only. No broad client GRANT ALL or automatic default table exposure is enabled.

The legacy SECURITY DEFINER `get_destination_trip_counts(timestamptz)`, `get_destination_search_counts(timestamptz)` and `increment_blog_view_count(text)` were callable by PUBLIC even with automatic table grants off. The supplement fixes their search paths and removes direct client execution. Existing callers in destination and blog API routes use the service client and remain functional. It also fixes the Auth profile trigger's path and removes PUBLIC/anon/authenticated execution from current non-extension application functions, preserving server execution. Extension members and Auth/Storage platform permissions are excluded from this supplement. Existing Auth trigger execution still works in the local model.

These are separately reviewable staging permissions. They do not claim that production already has these restrictions or authorize applying them there.

## Local validation evidence and limits

The test uses pinned image `postgres:17.11-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` with no network, mounted volumes, published ports or credentials. It replays every included repository migration in order, reproduces legacy helper exposure, applies the supplement and tests the complete resulting schema. A second empty database executes the exact committed bundle in one transaction and repeats the functional/security matrix. The test asserts that the rendered SQL equals the approval artifact and hash.

Passing checks cover all 24 application tables with RLS; denied client privileged RPC/view access; public published-only reads; owner/cross-user profile/trip/search/token/feedback behavior; actual-schema generation, notification and analytics paths; immutable plan/report history; same-request replay; stale checkout rejection; monotonic timestamp revisions; rate limits/cache/cleanup; and owned deletion cascades. Reapplying the fresh bootstrap is rejected. This full baseline check supplements, rather than replaces, existing race and browser suites.

The local platform fixture models the Auth/Storage objects, roles and Realtime publication required by these migrations; it is **not included in the external bundle**. It does not prove hosted Auth behavior, Storage HTTP behavior, Realtime streaming, Supabase-managed operator permissions or actual remote schema installation. Those require a separately approved staging smoke test. No App Store/native readiness is inferred. Release browser evidence is corrected to **54 cases: 28 checkout plus 26 recovery**, as shown by the actual CI logs.

## Secure configuration plan — no settings changed

1. Verify the staging target is still empty, PostgreSQL 17.11 and separate from production. Authorize this exact SQL hash on this project only, including its grants/helper restrictions and synthetic content. No production SQL is included.
2. Keep application traffic, new signups and provider calls off during bootstrap. After commit, verify catalog grants, RLS, helper permissions and fixture counts with bounded staging-only reads. Any staging write canaries beyond the approved synthetic bootstrap require explicit approval.
3. Separately authorize Vercel preview/development changes: set `NEXT_PUBLIC_SUPABASE_URL=https://omovikloadpvzijoaqus.supabase.co` and `FAROWAY_STAGING_SUPABASE_PROJECT_REF=omovikloadpvzijoaqus`; use only separately issued staging publishable/anon and private server credentials through the provider's secret manager. Verify provenance and deployment scope without decrypting or pasting values into chat. Never copy production credentials or alter production-scoped values.
4. Keep `FAROWAY_PLANNING_PAUSED=true`, plan editing/checklist off, provider/content-processing/live weather/places flags off, and paid AI/provider keys absent. Use synthetic/local fixtures until paid test authorization. Keep outbound email/push/cron/webhooks unconfigured or disabled. Review test-only Auth redirect URLs and account flows before authorizing login tests.
5. Build only an approved integrated source containing the isolation guard. Verify the immutable deployment binding and credential scope before any preview write request. Restrict or remove old shared-database previews only under separate approval; a new guard does not protect them retroactively.
6. Mobile staging builds must use explicit staging API/Auth configuration and remain separate from production distribution. Native signing, Apple agreements/credentials, TestFlight, device validation and App Store submission are separate gates. The new mobile audit findings remain follow-up work, not silently included in this schema bundle.

## Proposed next approval

“Approve the exact staging bootstrap SQL SHA-256 above, only on empty faroway-staging omovikloadpvzijoaqus, including the 43 listed schema files, supplemental grants/privileged-helper restrictions and four synthetic content rows. Use the specified bounded transaction and record the result. This does not approve production SQL, Vercel/credential changes, paid calls, deployment, signing or App Store submission.”

This is a prepared approval request, not received execution authorization.

Documentation reviewed: [Supabase API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api), [changelog](https://supabase.com/changelog). Markdown endpoints were unavailable; HTML references were reviewed. The 17.11 security-update notice concerns ltree/legacy PGP/btree_gist/custom operators; none are introduced by this app baseline. No package or extension upgrade was performed on a remote project.
