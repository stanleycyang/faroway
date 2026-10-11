BEGIN;
-- REVIEW CANDIDATE ONLY. Apply as a separate transaction after the frozen bootstrap.
-- Reconciled from the preserved September local work; apply before keyed clients.
-- A durable creation identity precedes both trip creation and generation.
-- Keep tombstones after trip deletion: a delayed retry must not recreate it.
-- Store a fingerprint, not deleted trip inputs. Account deletion removes it.
CREATE TABLE public.trip_creation_requests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL CHECK (request_key ~ '^[A-Za-z0-9._:-]{1,128}$'),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  trip_id UUID UNIQUE REFERENCES public.trips(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_key)
);
ALTER TABLE public.trip_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_creation_requests FROM PUBLIC, anon, authenticated, service_role;
-- No direct API table writes, even for service_role; the function owns mutation.
GRANT SELECT ON public.trip_creation_requests TO service_role;

-- Adopt the previous keyed-client UUIDs and creation hashes without changing trips.
-- The new fingerprint includes the original creation hash, which remains stable after brief edits.
INSERT INTO public.trip_creation_requests(user_id, request_key, request_fingerprint, trip_id)
SELECT user_id, id::text,
  encode(sha256(convert_to(jsonb_build_object('id', id, 'creationRequestHash', preferences->>'creationRequestHash')::text, 'UTF8')), 'hex'), id
FROM public.trips
WHERE user_id IS NOT NULL AND preferences->>'creationRequestHash' ~ '^[0-9a-f]{64}$';

CREATE FUNCTION public.create_trip_once(p_user_id UUID, p_request_key TEXT, p_input JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_request public.trip_creation_requests%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_fingerprint TEXT;
  v_requested_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR p_request_key !~ '^[A-Za-z0-9._:-]{1,128}$'
    OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'Invalid trip creation request' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('account-write:'||p_user_id::text,0));
  v_requested_id := (p_input->>'id')::uuid;
  IF v_requested_id IS NULL OR v_requested_id::text <> p_request_key OR
    COALESCE(p_input->'preferences'->>'creationRequestHash','') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid keyed trip identity' USING ERRCODE='22023';
  END IF;
  -- The route supplies normalized defaults/integers so equivalent requests
  -- produce the same canonical JSONB representation.
  v_fingerprint := encode(sha256(convert_to(jsonb_build_object('id', v_requested_id, 'creationRequestHash', p_input->'preferences'->>'creationRequestHash')::text, 'UTF8')), 'hex');
  INSERT INTO public.trip_creation_requests(user_id, request_key, request_fingerprint)
    VALUES(p_user_id, p_request_key, v_fingerprint)
    ON CONFLICT (user_id, request_key) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.trips(id, user_id, destination, start_date, end_date, travelers,
      budget_tier, vibes, preferences, status)
    VALUES(COALESCE(v_requested_id, gen_random_uuid()), p_user_id, p_input->>'destination', (p_input->>'start_date')::date,
      (p_input->>'end_date')::date, (p_input->>'travelers')::integer,
      p_input->>'budget_tier', ARRAY(SELECT jsonb_array_elements_text(p_input->'vibes')),
      p_input->'preferences', 'draft') RETURNING * INTO v_trip;
    UPDATE public.trip_creation_requests SET trip_id = v_trip.id
      WHERE user_id = p_user_id AND request_key = p_request_key;
    RETURN jsonb_build_object('outcome', 'created', 'trip', to_jsonb(v_trip));
  END IF;

  -- Separate statement: after a uniqueness wait, READ COMMITTED sees the
  -- committed winner. Do not use a same-statement CTE snapshot for the lookup.
  SELECT * INTO v_request FROM public.trip_creation_requests
    WHERE user_id = p_user_id AND request_key = p_request_key;
  IF NOT FOUND OR v_request.trip_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'gone');
  END IF;
  IF v_request.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RETURN jsonb_build_object('outcome', 'key_conflict');
  END IF;
  SELECT * INTO v_trip FROM public.trips
    WHERE id = v_request.trip_id AND user_id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'gone'); END IF;
  -- Return current state, without overwriting edits or resetting generation.
  RETURN jsonb_build_object('outcome', 'replayed', 'trip', to_jsonb(v_trip));
END;
$$;
REVOKE ALL ON FUNCTION public.create_trip_once(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_trip_once(UUID, TEXT, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
