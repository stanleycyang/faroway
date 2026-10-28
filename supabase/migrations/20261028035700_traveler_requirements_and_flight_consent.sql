-- Apply before enabling traveler requirements and flight-search consent edits.
-- Requires the recovery migrations. Deploy callers only after this migration.
CREATE OR REPLACE FUNCTION public.protect_trip_brief() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_changed BOOLEAN;
  v_server BOOLEAN := current_user IN ('service_role', 'postgres', 'supabase_admin');
BEGIN
  v_changed := ROW(NEW.destination, NEW.start_date, NEW.end_date, NEW.travelers, NEW.budget_tier, NEW.vibes,
    COALESCE(NEW.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh') IS DISTINCT FROM
    ROW(OLD.destination, OLD.start_date, OLD.end_date, OLD.travelers, OLD.budget_tier, OLD.vibes,
    COALESCE(OLD.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh');
  IF NOT v_server AND (v_changed OR NEW.preferences IS DISTINCT FROM OLD.preferences) THEN
    RAISE EXCEPTION 'Use the versioned trip brief API' USING ERRCODE = '42501';
  END IF;
  -- Preserve server metadata even when older clients send a partial preferences object.
  NEW.preferences := (COALESCE(NEW.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh') ||
    (COALESCE(OLD.preferences, '{}'::jsonb) - ARRAY['travelerType','originCity','originAirport','adults','children','interests','hotelSearch','flightSearch','requirements']);
  IF v_changed THEN
    IF current_user = 'service_role' AND COALESCE(current_setting('faroway.versioned_brief_write', TRUE), '') <> 'on' THEN
      RAISE EXCEPTION 'Brief writes require the versioned RPC' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'generating' THEN
      RAISE EXCEPTION 'Trip brief is locked while planning' USING ERRCODE = '40001';
    END IF;
    NEW.status := 'draft';
    NEW.search_id := NULL;
    NEW.is_shared := FALSE;
    NEW.share_token := NULL;
    NEW.shared_at := NULL;
    NEW.preferences := NEW.preferences || jsonb_build_object('planNeedsRefresh', EXISTS (SELECT 1 FROM public.itineraries WHERE trip_id = OLD.id));
  ELSIF v_server AND OLD.status = 'generating' AND NEW.status = 'planned' AND NEW.search_id IS NOT DISTINCT FROM OLD.search_id THEN
    NEW.preferences := NEW.preferences - 'planNeedsRefresh';
  END IF;
  RETURN NEW;
END;
$$;

-- Private traveler reports; a report is not an independent verification.
CREATE TABLE IF NOT EXISTS public.trip_venue_evidence (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_revision timestamptz NOT NULL,
  venue_id text NOT NULL CHECK (char_length(venue_id) BETWEEN 1 AND 200),
  requirement text NOT NULL CHECK (requirement IN ('allergy', 'dietary', 'step_free_entrance', 'accessible_restroom', 'accessible_seating', 'accessible_parking', 'other_mobility')),
  status text NOT NULL CHECK (status IN ('confirmed', 'contradicted', 'unknown')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500 AND (status = 'unknown' OR pg_catalog.btrim(note) <> '')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id, venue_id, requirement)
);
ALTER TABLE public.trip_venue_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trip_venue_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_venue_evidence TO service_role;

CREATE OR REPLACE FUNCTION public.save_trip_venue_evidence(
  p_trip_id uuid, p_user_id uuid, p_trip_revision timestamptz,
  p_venue_id text, p_requirement text, p_status text, p_note text
) RETURNS SETOF public.trip_venue_evidence
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
BEGIN
  SELECT * INTO v_trip FROM public.trips
  WHERE id = p_trip_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_trip.updated_at IS DISTINCT FROM p_trip_revision OR v_trip.status = 'generating'
     OR COALESCE(v_trip.preferences->>'planNeedsRefresh', 'false') = 'true' THEN
    RAISE EXCEPTION 'Trip revision unavailable' USING ERRCODE = '40001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.itineraries i
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(i.days) = 'array' THEN i.days ELSE '[]'::jsonb END
    ) AS day(value)
    CROSS JOIN LATERAL (VALUES (day.value->'morning'), (day.value->'afternoon'), (day.value->'evening')) AS slot(value)
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(slot.value->'activities') = 'array' THEN slot.value->'activities' ELSE '[]'::jsonb END ||
      CASE WHEN pg_catalog.jsonb_typeof(slot.value->'meals') = 'array' THEN slot.value->'meals' ELSE '[]'::jsonb END
    ) AS item(value)
    WHERE i.trip_id = p_trip_id AND i.user_id = p_user_id AND item.value->>'id' = p_venue_id
  ) THEN
    RAISE EXCEPTION 'Venue not in current itinerary' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY INSERT INTO public.trip_venue_evidence AS e
    (trip_id, user_id, trip_revision, venue_id, requirement, status, note, observed_at)
  VALUES (p_trip_id, p_user_id, p_trip_revision, p_venue_id, p_requirement, p_status, COALESCE(p_note, ''), pg_catalog.now())
  ON CONFLICT (trip_id, user_id, venue_id, requirement) DO UPDATE SET
    trip_revision = EXCLUDED.trip_revision, status = EXCLUDED.status, note = EXCLUDED.note, observed_at = EXCLUDED.observed_at
  RETURNING e.*;
END;
$$;
REVOKE ALL ON FUNCTION public.save_trip_venue_evidence(uuid, uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_trip_venue_evidence(uuid, uuid, timestamptz, text, text, text, text) TO service_role;
