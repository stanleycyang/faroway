# Database access boundaries and isolated staging

This draft changes code and a proposed migration only. It does not change production grants, Vercel settings, credentials, or infrastructure. Migration `20261004001000_restrict_privileged_database_helpers.sql` requires its own reviewed approval, separate from the six trip-recovery migrations. Do not run a blanket migration push.

## Narrow permission fix

Existing `get_user_push_tokens(uuid)` and `deactivate_push_token(text)` are SECURITY DEFINER helpers without caller ownership checks. The migration revokes PUBLIC/anon/authenticated execution, preserves service_role execution, and fixes search_path to public, pg_temp. It revokes client privileges on the global owner-security affiliate_stats view and preserves server SELECT. It changes no table policies or user data.

Checked-in web notification handlers and mobile token registration/removal use direct table operations, not these helper RPCs. Owner-scoped table operations remain available. Review any external consumers before rollout; an aggregate view is not a traveler-facing reporting API. No commission confirmation mechanism is added by this fix.

Disposable PostgreSQL tests load the actual token and affiliate migrations plus already-deployed July affiliate policies. They reproduce the old exposure, reject anonymous/authenticated helper and aggregate access after the fix, preserve service operations, and verify owner token upsert/delete while another user's rows remain inaccessible. Seed tokens are synthetic. Run `python3 scripts/test-database-access-boundaries.py` with Docker; the container has no network, ports, mounts, or credentials.

## Current environment boundary

Authorized read-only inspection reported production, preview, and development Vercel scopes all point to Supabase project `jcnephijkxgtprsutgsf`; service-role variable metadata is scoped to all three. There are no isolated Supabase development branches. Existing preview URLs are therefore not staging, regardless of their hostname. Do not send write/canary tests to them.

The Next configuration now refuses Vercel preview/development builds unless:

- `FAROWAY_STAGING_SUPABASE_PROJECT_REF` explicitly identifies a separately approved project;
- `NEXT_PUBLIC_SUPABASE_URL` exactly matches that project's HTTPS Supabase origin;
- the project reference differs from the known production project.

This check uses public project metadata only, never credential values, and errors do not echo configuration. Existing production builds and synthetic local tests are unchanged. An automatic preview build with today's shared configuration is expected to fail safely. This does not invalidate already-built previews or establish a production deployment hold. Non-Vercel local commands are outside this guard; use only disposable fixtures until isolated configuration is verified.

## Operator setup requiring approval

1. Approve the isolated staging project/branch, owner, region, spending limits and retention. Do not assume that creating infrastructure is free or already authorized.
2. Provision a separate empty database; apply reviewed schema to it and seed synthetic users/trips. Do not copy production traveler rows, authentication users, tokens, provider keys, or service credentials.
3. Remove production secret/URL inheritance from preview/development scopes and overrides. Set the public staging URL/reference and separately issued staging anon/service credentials through the provider's secret manager. Verify credential provenance and scope without pasting/decrypting values into chat or test logs. URL validation alone does not prove credential isolation.
4. Keep paid provider integrations and outbound notifications disabled; use approved sandbox endpoints or local fixtures. Configure staging auth redirect URLs to staging domains. Verify no production webhooks or cron writers are configured.
5. Rebuild a new preview from an approved commit. Independently verify its immutable deployment's database binding and scoped credential metadata. Old previews retain their built configuration; disable/restrict them only with explicit runtime-change approval.
6. Only after isolation is verified, authorize staging writes and migration rehearsal. Check cross-user denial, server-only helpers, token management, and the reviewed trip lifecycle tests. Migration success alone does not approve production rollout.

Production application of the permission migration needs target/schema verification, backup/rollback planning, external-caller review and explicit approval. Prefer retaining these restrictions during application rollback; restoring broad client RPC/view grants would reopen the exposure and needs separate risk approval. The six trip-recovery migrations do not fix these helper/view permissions by themselves.
