-- Elapsed time is not evidence that a durable workflow stopped. Keep the cron
-- response shape, but leave uncertain attempts claimed for backend reconciliation.
CREATE OR REPLACE FUNCTION public.cleanup_stale_generation_state()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT jsonb_build_object(
    'searches', 0,
    'trips', 0,
    'awaiting_confirmation', (
      SELECT count(*) FROM public.trips
      WHERE status = 'generating' AND updated_at < clock_timestamp() - INTERVAL '1 hour'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.cleanup_stale_generation_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_generation_state() TO service_role;
