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
    (COALESCE(OLD.preferences, '{}'::jsonb) - ARRAY['travelerType','originCity','originAirport','adults','children','interests']);
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
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_trip_brief ON public.trips;
CREATE TRIGGER protect_trip_brief BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.protect_trip_brief();

CREATE OR REPLACE FUNCTION public.update_trip_brief(
  p_trip_id UUID, p_user_id UUID, p_expected_updated_at TIMESTAMPTZ, p_changes JSONB
) RETURNS SETOF public.trips LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_previous TEXT := current_setting('faroway.versioned_brief_write', TRUE);
BEGIN
  PERFORM set_config('faroway.versioned_brief_write', 'on', TRUE);
  RETURN QUERY UPDATE public.trips AS t SET
    destination = COALESCE(p_changes->>'destination', t.destination),
    start_date = COALESCE((p_changes->>'start_date')::DATE, t.start_date),
    end_date = COALESCE((p_changes->>'end_date')::DATE, t.end_date),
    travelers = COALESCE((p_changes->>'travelers')::INTEGER, t.travelers),
    budget_tier = COALESCE(p_changes->>'budget_tier', t.budget_tier),
    vibes = CASE WHEN p_changes ? 'vibes' THEN ARRAY(SELECT jsonb_array_elements_text(p_changes->'vibes')) ELSE t.vibes END,
    preferences = COALESCE(t.preferences, '{}'::JSONB) || COALESCE(p_changes->'preferences', '{}'::JSONB)
  WHERE t.id = p_trip_id AND t.user_id = p_user_id
    AND t.updated_at = p_expected_updated_at AND t.status <> 'generating'
  RETURNING t.*;
  PERFORM set_config('faroway.versioned_brief_write', COALESCE(v_previous, ''), TRUE);
END;
$$;
REVOKE ALL ON FUNCTION public.update_trip_brief(UUID, UUID, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_trip_brief(UUID, UUID, TIMESTAMPTZ, JSONB) TO service_role;
