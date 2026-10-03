-- Apply before deploying callers. No production execution is part of this change.
-- The trip row lock serializes generation claims, progress and final writes.
CREATE OR REPLACE FUNCTION public.apply_trip_generation_update(
  p_trip_id UUID, p_search_id UUID, p_state TEXT, p_payload JSONB DEFAULT '{}'::JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_itinerary_id UUID;
BEGIN
  IF p_state NOT IN ('progress', 'failed', 'planned') THEN
    RAISE EXCEPTION 'Invalid generation update state';
  END IF;
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR v_trip.search_id IS DISTINCT FROM p_search_id THEN RETURN FALSE; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.searches WHERE id = p_search_id AND user_id = v_trip.user_id) THEN RETURN FALSE; END IF;
  -- A repeated terminal write is acknowledged without rewriting the itinerary,
  -- progress or notification. A stale or canceled attempt cannot publish.
  IF v_trip.status = p_state AND p_state IN ('failed', 'planned') THEN RETURN TRUE; END IF;
  IF v_trip.status <> 'generating' THEN RETURN FALSE; END IF;

  IF p_state = 'planned' THEN
    SELECT id INTO v_itinerary_id FROM public.itineraries WHERE trip_id = p_trip_id ORDER BY created_at LIMIT 1 FOR UPDATE;
    IF v_itinerary_id IS NULL THEN
      INSERT INTO public.itineraries (trip_id, user_id, destination, start_date, end_date, overview, total_cost, days, packing_list, general_tips, generated_at)
      VALUES (p_trip_id, v_trip.user_id, v_trip.destination, v_trip.start_date, v_trip.end_date, p_payload->>'overview', p_payload->'total_cost', p_payload->'days', '{}', '{}', NOW())
      RETURNING id INTO v_itinerary_id;
    ELSE
      UPDATE public.itineraries SET user_id = v_trip.user_id, destination = v_trip.destination, start_date = v_trip.start_date, end_date = v_trip.end_date,
        overview = p_payload->>'overview', total_cost = p_payload->'total_cost', days = p_payload->'days', packing_list = '{}', general_tips = '{}', generated_at = NOW()
      WHERE id = v_itinerary_id;
    END IF;
    UPDATE public.trips SET status = 'planned', itinerary_id = v_itinerary_id, updated_at = NOW() WHERE id = p_trip_id;
    INSERT INTO public.notifications (user_id, type, title, message, data, read)
    VALUES (v_trip.user_id, 'itinerary_ready', 'Your Itinerary is Ready!', 'Your trip itinerary is ready to view.', jsonb_build_object('trip_id', p_trip_id, 'search_id', p_search_id, 'itinerary_id', v_itinerary_id), FALSE);
  ELSIF p_state = 'failed' THEN
    UPDATE public.trips SET status = 'failed', updated_at = NOW() WHERE id = p_trip_id;
  END IF;

  INSERT INTO public.workflow_progress (trip_id, user_id, step, progress, message, updated_at)
  VALUES (p_trip_id, v_trip.user_id,
    CASE WHEN p_state = 'planned' THEN 'complete' WHEN p_state = 'failed' THEN 'error' ELSE p_payload->>'step' END,
    CASE WHEN p_state = 'planned' THEN 100 WHEN p_state = 'failed' THEN 0 ELSE (p_payload->>'progress')::INTEGER END,
    CASE WHEN p_state = 'planned' THEN 'Your itinerary is ready!' ELSE p_payload->>'message' END, NOW())
  ON CONFLICT (trip_id) DO UPDATE SET user_id = EXCLUDED.user_id, step = EXCLUDED.step, progress = EXCLUDED.progress, message = EXCLUDED.message, updated_at = EXCLUDED.updated_at;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_trip_generation_update(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_trip_generation_update(UUID, UUID, TEXT, JSONB) TO service_role;
