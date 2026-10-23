-- Pin the 11 public functions the 2026-10-22 advisor flagged as
-- function_search_path_mutable. search_path = '' stops them from inheriting
-- the caller's path. Every relation and helper they use is schema-qualified
-- so the empty path still resolves.
--
-- handle_new_user is only an auth.users trigger. It does not need an RPC
-- grant, so EXECUTE is revoked from PUBLIC, anon, authenticated, and
-- service_role. Existing triggers are not rechecked for EXECUTE when they fire.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_push_token_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_blog_view_count(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE slug = p_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_destination(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN pg_catalog.lower(pg_catalog.btrim(pg_catalog.split_part(raw, ',', 1)));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_destination_trip_counts(since TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ)
RETURNS TABLE(destination_normalized TEXT, trip_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT public.normalize_destination(t.destination) AS destination_normalized,
           pg_catalog.count(*)::BIGINT AS trip_count
    FROM public.trips t
    WHERE t.created_at >= since
    GROUP BY public.normalize_destination(t.destination);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_destination_search_counts(since TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ)
RETURNS TABLE(destination_normalized TEXT, search_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT public.normalize_destination(s.destination) AS destination_normalized,
           pg_catalog.count(*)::BIGINT AS search_count
    FROM public.searches s
    WHERE s.created_at >= since
    GROUP BY public.normalize_destination(s.destination);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_push_tokens(target_user_id UUID)
RETURNS TABLE (token TEXT, platform TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT pt.token, pt.platform
  FROM public.push_tokens pt
  WHERE pt.user_id = target_user_id
    AND pt.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_push_token(target_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.push_tokens
  SET is_active = false, updated_at = pg_catalog.now()
  WHERE token = target_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_anonymous_trips()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired anonymous trips (cascades to itineraries, workflow_progress, workflow_runs via FK)
  DELETE FROM public.trips
  WHERE user_id IS NULL
    AND expires_at IS NOT NULL
    AND expires_at < pg_catalog.now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Delete orphaned anonymous searches (no trip references them, older than 7 days)
  DELETE FROM public.searches
  WHERE user_id IS NULL
    AND created_at < pg_catalog.now() - INTERVAL '7 days'
    AND id NOT IN (SELECT search_id FROM public.trips WHERE search_id IS NOT NULL);

  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_workflow_data()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.workflow_runs
  WHERE completed_at < pg_catalog.now() - INTERVAL '30 days';

  DELETE FROM public.realtime_events
  WHERE created_at < pg_catalog.now() - INTERVAL '1 hour';

  DELETE FROM public.notifications
  WHERE read = TRUE AND created_at < pg_catalog.now() - INTERVAL '90 days';
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
