-- Separate approval from the trip-recovery rollout. No application table/RLS changes.
-- Current web/mobile token management uses owner-scoped table operations; these
-- privileged helpers and the global aggregate are server-only operations.
ALTER FUNCTION public.get_user_push_tokens(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.deactivate_push_token(TEXT) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.get_user_push_tokens(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deactivate_push_token(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_push_tokens(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_push_token(TEXT) TO service_role;
REVOKE ALL ON TABLE public.affiliate_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.affiliate_stats TO service_role;
