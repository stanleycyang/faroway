-- Apply before enabling NEXT_PUBLIC_HOTEL_SEARCH_ENABLED.
-- Hotel consent/room details must remain editable through the versioned RPC.
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
    (COALESCE(OLD.preferences, '{}'::jsonb) - ARRAY['travelerType','originCity','originAirport','adults','children','interests','hotelSearch']);
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
