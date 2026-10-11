-- Incremental helper hardening; no permission or cleanup-policy changes.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';
ALTER FUNCTION public.update_push_token_timestamp() SET search_path = pg_catalog;
ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog;
ALTER FUNCTION public.normalize_destination(TEXT) SET search_path = pg_catalog;
CREATE OR REPLACE FUNCTION public.cleanup_expired_anonymous_trips()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired anonymous trips (cascades to itineraries, workflow_progress, workflow_runs via FK)
  DELETE FROM public.trips
  WHERE user_id IS NULL
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Delete orphaned anonymous searches (no trip references them, older than 7 days)
  DELETE FROM public.searches
  WHERE user_id IS NULL
    AND created_at < NOW() - INTERVAL '7 days'
    AND id NOT IN (SELECT search_id FROM public.trips WHERE search_id IS NOT NULL);

  RETURN deleted_count;
END;
$$;
ALTER FUNCTION public.cleanup_expired_anonymous_trips() SET search_path = pg_catalog;
CREATE OR REPLACE FUNCTION public.cleanup_old_workflow_data()
RETURNS void AS $$
BEGIN
    -- Delete workflow runs older than 30 days
    DELETE FROM public.workflow_runs
    WHERE completed_at < NOW() - INTERVAL '30 days';

    -- Delete realtime events older than 1 hour
    DELETE FROM public.realtime_events
    WHERE created_at < NOW() - INTERVAL '1 hour';

    -- Delete read notifications older than 90 days
    DELETE FROM public.notifications
    WHERE read = TRUE AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
ALTER FUNCTION public.cleanup_old_workflow_data() SET search_path = pg_catalog;
NOTIFY pgrst, 'reload schema';
COMMIT;
