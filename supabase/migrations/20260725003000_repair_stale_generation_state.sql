-- Generation normally completes within minutes. Repair abandoned workflow
-- state after one hour so clients can offer a retry instead of loading forever.

CREATE OR REPLACE FUNCTION public.cleanup_stale_generation_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_searches INTEGER;
  v_trips INTEGER;
BEGIN
  UPDATE public.searches
  SET
    status = 'error',
    error_message = COALESCE(
      error_message,
      'Generation timed out before completion. Please try again.'
    ),
    updated_at = clock_timestamp()
  WHERE status IN ('pending', 'searching')
    AND updated_at < clock_timestamp() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_searches = ROW_COUNT;

  UPDATE public.trips
  SET
    status = 'failed',
    updated_at = clock_timestamp()
  WHERE status = 'generating'
    AND updated_at < clock_timestamp() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_trips = ROW_COUNT;

  RETURN jsonb_build_object(
    'searches', v_searches,
    'trips', v_trips
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_generation_state()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_generation_state()
  TO service_role;

SELECT public.cleanup_stale_generation_state();
