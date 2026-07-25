-- Atomic, shared rate limiting for serverless API routes.
-- Only the service role can consume or inspect buckets.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key TEXT PRIMARY KEY CHECK (char_length(key) = 64),
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limit_buckets TO service_role;

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires_at
  ON public.rate_limit_buckets (expires_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_in_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_key !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid rate-limit key';
  END IF;

  IF p_max_requests < 1 OR p_max_requests > 100000 THEN
    RAISE EXCEPTION 'Invalid rate-limit request maximum';
  END IF;

  IF p_window_ms < 1000 OR p_window_ms > 86400000 THEN
    RAISE EXCEPTION 'Invalid rate-limit window';
  END IF;

  INSERT INTO public.rate_limit_buckets (
    key,
    request_count,
    window_started_at,
    expires_at
  )
  VALUES (
    p_key,
    1,
    v_now,
    v_now + make_interval(secs => p_window_ms / 1000.0)
  )
  ON CONFLICT (key) DO UPDATE
  SET
    request_count = CASE
      WHEN public.rate_limit_buckets.expires_at <= v_now THEN 1
      ELSE public.rate_limit_buckets.request_count + 1
    END,
    window_started_at = CASE
      WHEN public.rate_limit_buckets.expires_at <= v_now THEN v_now
      ELSE public.rate_limit_buckets.window_started_at
    END,
    expires_at = CASE
      WHEN public.rate_limit_buckets.expires_at <= v_now
        THEN v_now + make_interval(secs => p_window_ms / 1000.0)
      ELSE public.rate_limit_buckets.expires_at
    END
  RETURNING request_count, expires_at
  INTO v_count, v_expires_at;

  RETURN QUERY SELECT
    v_count <= p_max_requests,
    GREATEST(0, p_max_requests - v_count),
    GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM (v_expires_at - v_now)) * 1000)::INTEGER
    );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM public.rate_limit_buckets
  WHERE expires_at < clock_timestamp() - INTERVAL '1 day';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limits()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits()
  TO service_role;
