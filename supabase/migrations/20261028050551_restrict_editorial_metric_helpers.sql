-- These helpers are called only by the rate-limited server API routes.
-- Direct client RPC access bypasses those route controls and owner RLS.
REVOKE ALL ON FUNCTION public.get_destination_trip_counts(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_destination_search_counts(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_blog_view_count(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_destination_trip_counts(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_destination_search_counts(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_blog_view_count(text) TO service_role;
