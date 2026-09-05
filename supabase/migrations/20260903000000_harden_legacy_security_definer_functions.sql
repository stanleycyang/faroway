-- Legacy helper RPCs were created with the default PUBLIC execute grant.
-- Restrict privileged functions to the service role and pin every object
-- reference so caller-controlled search paths cannot change their behavior.

BEGIN;

ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog;
REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_blog_view_count(p_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE slug = p_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_blog_view_count(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_blog_view_count(TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_destination_trip_counts(
  since TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ
)
RETURNS TABLE(destination_normalized TEXT, trip_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  RETURN QUERY
    SELECT
      public.normalize_destination(t.destination) AS destination_normalized,
      COUNT(*)::BIGINT AS trip_count
    FROM public.trips AS t
    WHERE t.created_at >= since
    GROUP BY public.normalize_destination(t.destination);
END;
$$;

REVOKE ALL ON FUNCTION public.get_destination_trip_counts(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_destination_trip_counts(TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_destination_search_counts(
  since TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ
)
RETURNS TABLE(destination_normalized TEXT, search_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  RETURN QUERY
    SELECT
      public.normalize_destination(s.destination) AS destination_normalized,
      COUNT(*)::BIGINT AS search_count
    FROM public.searches AS s
    WHERE s.created_at >= since
    GROUP BY public.normalize_destination(s.destination);
END;
$$;

REVOKE ALL ON FUNCTION public.get_destination_search_counts(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_destination_search_counts(TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_push_tokens(target_user_id UUID)
RETURNS TABLE(token TEXT, platform TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  RETURN QUERY
    SELECT pt.token, pt.platform
    FROM public.push_tokens AS pt
    WHERE pt.user_id = target_user_id
      AND pt.is_active = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_push_tokens(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_push_tokens(UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.deactivate_push_token(target_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE public.push_tokens
  SET is_active = FALSE, updated_at = NOW()
  WHERE token = target_token;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_push_token(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_push_token(TEXT)
  TO service_role;

-- Public inserts bypass the API's validation and rate limits. All writes now
-- enter through the server-side service client.
DROP POLICY IF EXISTS "Anyone can subscribe"
  ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Service role can insert subscribers"
  ON public.newsletter_subscribers;
CREATE POLICY "Service role can insert subscribers"
  ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Anyone can log a view"
  ON public.blog_post_views;
DROP POLICY IF EXISTS "Service role can insert views"
  ON public.blog_post_views;
CREATE POLICY "Service role can insert views"
  ON public.blog_post_views
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Record the raw event and aggregate count in one transaction so the two
-- analytics sources cannot silently drift apart on partial failures.
CREATE OR REPLACE FUNCTION public.record_blog_view(
  p_slug TEXT,
  p_viewer_ip_hash TEXT,
  p_user_agent TEXT,
  p_referrer TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO public.blog_post_views (
    post_slug,
    viewer_ip_hash,
    user_agent,
    referrer
  ) VALUES (
    p_slug,
    p_viewer_ip_hash,
    p_user_agent,
    p_referrer
  );

  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE slug = p_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.record_blog_view(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_blog_view(TEXT, TEXT, TEXT, TEXT)
  TO service_role;

COMMIT;
