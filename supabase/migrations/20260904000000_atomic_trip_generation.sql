-- Generation identity is a fencing token, not just a progress pointer.
-- All trip lifecycle writes lock trips first, then searches. Never hold a
-- transaction open while calling the workflow runtime or a provider.
CREATE TABLE public.trip_generation_requests (
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL CHECK (char_length(request_key) BETWEEN 1 AND 128),
  search_id UUID NOT NULL UNIQUE REFERENCES public.searches(id) ON DELETE CASCADE,
  input JSONB NOT NULL CHECK (jsonb_typeof(input) = 'object'),
  request_fingerprint JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, request_key)
);
ALTER TABLE public.trip_generation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_generation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_generation_requests TO service_role;

CREATE FUNCTION public.begin_trip_generation(
  p_trip_id UUID,
  p_user_id UUID,
  p_request_key TEXT,
  p_input JSONB,
  p_preview JSONB,
  p_expected_updated_at TIMESTAMPTZ,
  p_rate_limit_key TEXT,
  p_request_fingerprint JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_request public.trip_generation_requests%ROWTYPE;
  v_search_id UUID;
  v_status TEXT;
  v_limit RECORD;
BEGIN
  SELECT * INTO v_trip FROM public.trips
    WHERE id = p_trip_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'not_found'); END IF;

  SELECT * INTO v_request FROM public.trip_generation_requests
    WHERE trip_id = p_trip_id AND request_key = p_request_key;
  IF FOUND THEN
    IF v_request.request_fingerprint IS DISTINCT FROM COALESCE(p_request_fingerprint, p_input) THEN
      RETURN jsonb_build_object('outcome', 'key_conflict');
    END IF;
    SELECT status INTO v_status FROM public.searches WHERE id = v_request.search_id;
    RETURN jsonb_build_object('outcome', 'replayed', 'searchId', v_request.search_id, 'status', v_status);
  END IF;

  IF v_trip.status = 'generating' THEN
    RETURN jsonb_build_object('outcome', 'in_progress', 'searchId', v_trip.search_id);
  END IF;
  IF v_trip.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('outcome', 'trip_changed');
  END IF;

  -- Replays/conflicts do not consume the generation allowance. A failed
  -- initialization rolls back this consumption together with all other writes.
  SELECT * INTO v_limit FROM public.consume_rate_limit(p_rate_limit_key, 5, 3600000);
  IF NOT v_limit.allowed THEN
    RETURN jsonb_build_object('outcome', 'rate_limited', 'retryAfter', ceil(v_limit.reset_in_ms / 1000.0));
  END IF;

  INSERT INTO public.searches (
    user_id, destination, start_date, end_date, travelers, traveler_type,
    vibes, budget, status, intermediate_results
  ) VALUES (
    p_user_id, v_trip.destination, v_trip.start_date, v_trip.end_date,
    v_trip.travelers, p_input->>'travelerType',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_input->'vibes', '[]'::jsonb))),
    COALESCE(v_trip.budget_tier, 'moderate'), 'pending',
    jsonb_build_object('days', p_preview, 'previewReady', true)
  ) RETURNING id INTO v_search_id;

  INSERT INTO public.trip_generation_requests (trip_id, request_key, search_id, input, request_fingerprint)
    VALUES (p_trip_id, p_request_key, v_search_id, p_input, COALESCE(p_request_fingerprint, p_input));
  INSERT INTO public.workflow_runs (id, trip_id, user_id, status)
    VALUES (v_search_id::text, p_trip_id, p_user_id, 'running');
  INSERT INTO public.workflow_progress (trip_id, user_id, step, progress, message)
    VALUES (p_trip_id, p_user_id, 'queued', 0, 'Starting trip planning...')
    ON CONFLICT (trip_id) DO UPDATE SET step = EXCLUDED.step,
      progress = 0, message = EXCLUDED.message, updated_at = now();
  UPDATE public.trips SET status = 'generating', search_id = v_search_id, updated_at = now()
    WHERE id = p_trip_id;
  RETURN jsonb_build_object('outcome', 'created', 'searchId', v_search_id, 'status', 'pending');
END;
$$;

CREATE FUNCTION public.advance_trip_generation(
  p_trip_id UUID, p_search_id UUID, p_progress JSONB,
  p_step TEXT, p_percent INTEGER, p_message TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM 1 FROM public.trips WHERE id = p_trip_id
    AND search_id = p_search_id AND status = 'generating' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.searches SET status = 'searching', progress = p_progress, updated_at = now()
    WHERE id = p_search_id AND status IN ('pending', 'searching');
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.workflow_progress (trip_id, step, progress, message)
    VALUES (p_trip_id, p_step, p_percent, p_message)
    ON CONFLICT (trip_id) DO UPDATE SET step = EXCLUDED.step,
      progress = EXCLUDED.progress, message = EXCLUDED.message, updated_at = now();
  RETURN true;
END;
$$;

CREATE FUNCTION public.fail_trip_generation(p_trip_id UUID, p_search_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_current BOOLEAN;
BEGIN
  SELECT search_id = p_search_id AND status = 'generating' INTO v_current
    FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.workflow_runs WHERE id = p_search_id::text AND trip_id = p_trip_id
  ) THEN RETURN false; END IF;
  -- A delayed failure must not turn a successfully committed run into a failure.
  UPDATE public.searches SET status = 'error',
    error_message = 'Generation failed. Please try again.', completed_at = now(), updated_at = now()
    WHERE id = p_search_id AND status IN ('pending', 'searching');
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.workflow_runs SET status = 'failed',
    error_message = 'Generation failed. Please try again.', completed_at = now()
    WHERE id = p_search_id::text AND status IN ('pending', 'running');
  IF NOT COALESCE(v_current, false) THEN RETURN false; END IF;
  UPDATE public.trips SET status = 'failed', updated_at = now() WHERE id = p_trip_id;
  INSERT INTO public.workflow_progress (trip_id, step, progress, message)
    VALUES (p_trip_id, 'error', 0, 'Generation failed. Please try again.')
    ON CONFLICT (trip_id) DO UPDATE SET step = EXCLUDED.step, progress = 0,
      message = EXCLUDED.message, updated_at = now();
  RETURN true;
END;
$$;

-- These arrays contain provider/agent IDs (e.g. viator_123), not foreign keys
-- to generated search_results UUIDs. The API resolves them against data.id.
-- Casting preserves UUID values in existing rows as text.
ALTER TABLE public.search_itineraries
  ALTER COLUMN morning_activities TYPE TEXT[] USING morning_activities::TEXT[],
  ALTER COLUMN afternoon_activities TYPE TEXT[] USING afternoon_activities::TEXT[],
  ALTER COLUMN evening_activities TYPE TEXT[] USING evening_activities::TEXT[],
  ALTER COLUMN meals TYPE TEXT[] USING meals::TEXT[];

CREATE FUNCTION public.complete_trip_generation(
  p_trip_id UUID, p_search_id UUID, p_itinerary JSONB, p_spec JSONB,
  p_results JSONB, p_days JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_status TEXT;
  v_itinerary_id UUID;
BEGIN
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR v_trip.search_id IS DISTINCT FROM p_search_id THEN RETURN false; END IF;
  SELECT status INTO v_status FROM public.searches WHERE id = p_search_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_status = 'completed' THEN RETURN true; END IF;
  IF v_trip.status <> 'generating' OR v_status NOT IN ('pending', 'searching') THEN RETURN false; END IF;

  -- Persistence and completion are one transaction. Retried durable steps do
  -- not duplicate rows or notifications, or overwrite subsequent user edits.
  DELETE FROM public.search_itineraries WHERE search_id = p_search_id;
  DELETE FROM public.search_results WHERE search_id = p_search_id;
  INSERT INTO public.search_results (
    search_id, category, name, description, data, affiliate_url,
    affiliate_partner, price_amount, price_currency, rating
  ) SELECT p_search_id, r.category, r.name, r.description, r.data, r.affiliate_url,
    r.affiliate_partner, r.price_amount, r.price_currency, r.rating
    FROM jsonb_to_recordset(p_results) AS r(category TEXT, name TEXT, description TEXT,
      data JSONB, affiliate_url TEXT, affiliate_partner TEXT,
      price_amount NUMERIC, price_currency TEXT, rating DOUBLE PRECISION);
  INSERT INTO public.search_itineraries (
    search_id, day_number, date, title, summary, morning_activities,
    afternoon_activities, evening_activities, meals, estimated_cost, cost_currency, tips
  ) SELECT p_search_id, d.day_number, d.date, d.title, d.summary, d.morning_activities,
    d.afternoon_activities, d.evening_activities, d.meals, d.estimated_cost, d.cost_currency, d.tips
    FROM jsonb_to_recordset(p_days) AS d(day_number INTEGER, date DATE, title TEXT,
      summary TEXT, morning_activities TEXT[], afternoon_activities TEXT[],
      evening_activities TEXT[], meals TEXT[], estimated_cost NUMERIC, cost_currency TEXT, tips TEXT[]);

  INSERT INTO public.itineraries (
    trip_id, user_id, destination, start_date, end_date, overview, total_cost,
    days, days_data, packing_list, general_tips, generated_at
  ) VALUES (
    p_trip_id, v_trip.user_id, v_trip.destination, v_trip.start_date, v_trip.end_date,
    p_itinerary->>'overview', p_itinerary->'total_cost',
    p_itinerary->'days', p_itinerary->'days',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_itinerary->'packing_list', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_itinerary->'general_tips', '[]'::jsonb))), now()
  ) ON CONFLICT (trip_id) DO UPDATE SET
    user_id = EXCLUDED.user_id, destination = EXCLUDED.destination,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    overview = EXCLUDED.overview, total_cost = EXCLUDED.total_cost,
    days = EXCLUDED.days, days_data = EXCLUDED.days_data,
    packing_list = EXCLUDED.packing_list, general_tips = EXCLUDED.general_tips,
    generated_at = EXCLUDED.generated_at
  RETURNING id INTO v_itinerary_id;

  UPDATE public.searches SET status = 'completed', completed_at = now(), updated_at = now(),
    json_render_spec = p_spec, error_message = NULL,
    progress = '{"orchestrator":"done","hotels":"done","activities":"done","dining":"done","transport":"done","enrichment":"done","aggregator":"done"}'::jsonb
    WHERE id = p_search_id;
  UPDATE public.trips SET status = 'planned', itinerary_id = v_itinerary_id, updated_at = now()
    WHERE id = p_trip_id;
  INSERT INTO public.workflow_progress (trip_id, step, progress, message)
    VALUES (p_trip_id, 'complete', 100, 'Your itinerary is ready!')
    ON CONFLICT (trip_id) DO UPDATE SET step = EXCLUDED.step, progress = 100,
      message = EXCLUDED.message, updated_at = now();
  UPDATE public.workflow_runs SET status = 'completed', completed_at = now(), error_message = NULL
    WHERE id = p_search_id::text;
  INSERT INTO public.notifications (user_id, type, title, message, data, read)
    VALUES (v_trip.user_id, 'itinerary_ready', 'Your Itinerary is Ready!',
      'Your trip itinerary is ready to view.',
      jsonb_build_object('trip_id', p_trip_id, 'itinerary_id', v_itinerary_id, 'search_id', p_search_id), false);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_trip_generation(UUID, UUID, TEXT, JSONB, JSONB, TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_trip_generation(UUID, UUID, JSONB, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_trip_generation(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_trip_generation(UUID, UUID, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_trip_generation(UUID, UUID, TEXT, JSONB, JSONB, TIMESTAMPTZ, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_trip_generation(UUID, UUID, JSONB, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_trip_generation(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_trip_generation(UUID, UUID, JSONB, JSONB, JSONB, JSONB) TO service_role;

-- Cleanup must follow the same trip -> search lock order as workers. Live
-- search heartbeats protect a trip even though its own updated_at is older.
CREATE OR REPLACE FUNCTION public.cleanup_stale_generation_state()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_trip RECORD;
  v_search public.searches%ROWTYPE;
  v_trips INTEGER := 0;
  v_searches INTEGER := 0;
  v_changed INTEGER;
  v_unreconciled INTEGER := 0;
  v_orphans INTEGER;
BEGIN
  FOR v_trip IN
    SELECT t.id, t.search_id FROM public.trips t
    LEFT JOIN public.searches s ON s.id = t.search_id
    WHERE t.status = 'generating'
      AND GREATEST(t.updated_at, s.updated_at) < clock_timestamp() - INTERVAL '1 hour'
    ORDER BY t.id FOR UPDATE OF t SKIP LOCKED
  LOOP
    SELECT * INTO v_search FROM public.searches
      WHERE id = v_trip.search_id FOR UPDATE;
    -- Recheck after acquiring the locks: never act on an old heartbeat snapshot.
    IF FOUND AND v_search.updated_at >= clock_timestamp() - INTERVAL '1 hour' THEN
      CONTINUE;
    END IF;
    IF v_search.status = 'completed' THEN
      -- Legacy split writes may leave a completed search without a persisted
      -- itinerary. Preserve its data for reconciliation; do not invent success
      -- from an unrelated, older itinerary or downgrade completed search data.
      v_unreconciled := v_unreconciled + 1;
      CONTINUE;
    END IF;
    -- Older attempts can have no search, no workflow_runs row, or a search
    -- already marked error. Cleanup must still release those stuck trips.
    UPDATE public.searches SET status = 'error', completed_at = now(),
      error_message = 'Generation timed out before completion. Please try again.', updated_at = now()
      WHERE id = v_trip.search_id AND status IN ('pending', 'searching');
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    v_searches := v_searches + v_changed;
    UPDATE public.trips SET status = 'failed', updated_at = now() WHERE id = v_trip.id;
    UPDATE public.workflow_runs SET status = 'failed', completed_at = now(),
      error_message = 'Generation timed out before completion. Please try again.'
      WHERE trip_id = v_trip.id AND status IN ('pending', 'running');
    INSERT INTO public.workflow_progress (trip_id, step, progress, message)
      VALUES (v_trip.id, 'error', 0, 'Generation timed out before completion. Please try again.')
      ON CONFLICT (trip_id) DO UPDATE SET step = EXCLUDED.step, progress = 0,
        message = EXCLUDED.message, updated_at = now();
    v_trips := v_trips + 1;
  END LOOP;
  UPDATE public.searches s SET status = 'error', completed_at = now(),
    error_message = 'Generation timed out before completion. Please try again.', updated_at = now()
    WHERE s.status IN ('pending', 'searching')
      AND s.updated_at < clock_timestamp() - INTERVAL '1 hour'
      AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.search_id = s.id);
  GET DIAGNOSTICS v_orphans = ROW_COUNT;
  RETURN jsonb_build_object('trips', v_trips, 'searches', v_searches + v_orphans,
    'unreconciledTrips', v_unreconciled);
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_stale_generation_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_generation_state() TO service_role;
