-- Align production EXECUTE grants with staging for helpers that are not
-- client RPCs. Postgres grants EXECUTE to PUBLIC by default, and Supabase
-- default privileges also grant it to anon and authenticated. Revoke those
-- three and leave service_role. REVOKE/GRANT are idempotent, so this is safe
-- on staging (already restricted) and on production (still open for the
-- helpers below that 20261028050551 did not cover). The three editorial
-- metric functions are repeated so this file is complete on its own.
--
-- Server callers use the service-role client. No browser or mobile .rpc():
--   get_destination_trip_counts / get_destination_search_counts
--     apps/web/app/api/destinations/popular/route.ts
--     apps/web/app/api/destinations/trending/route.ts
--   increment_blog_view_count
--     apps/web/app/api/blog/views/route.ts (route already rate-limits per IP)
--   cleanup_old_workflow_data
--     no application caller; the cleanup cron uses other functions
--   normalize_destination
--     destinations.name_normalized is
--     GENERATED ALWAYS AS (normalize_destination(name)) STORED.
--     service_role is the writer (no anon/authenticated insert or update
--     policy). The count functions are SECURITY DEFINER and call it as
--     their owner. No view or policy references it. Reading the stored
--     column does not execute it.
--   update_updated_at_column / update_push_token_timestamp
--     trigger functions only. Existing triggers fire without EXECUTE.
--
-- public.rate_limit_buckets already has RLS, no policies, and table
-- privileges limited to service_role. Only consume_rate_limit and
-- cleanup_expired_rate_limits touch it, both via the service role
-- (apps/web/lib/security/rate-limit.ts and the cleanup cron). No policy.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';

REVOKE ALL ON FUNCTION public.get_destination_trip_counts(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_destination_search_counts(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_blog_view_count(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_workflow_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_destination(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_push_token_timestamp() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_destination_trip_counts(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_destination_search_counts(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_blog_view_count(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_workflow_data() TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_destination(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_push_token_timestamp() TO service_role;

COMMENT ON TABLE public.rate_limit_buckets IS
  'Intentionally service-role only. RLS is enabled with no policies, so anon and authenticated are denied. Only service_role reaches this table, through consume_rate_limit and cleanup_expired_rate_limits.';

NOTIFY pgrst, 'reload schema';
COMMIT;
