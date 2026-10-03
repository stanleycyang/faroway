-- Owner RLS alone does not protect individual linkage/lifecycle columns.
-- Direct authenticated REST writes must not bypass generation/sharing APIs.
CREATE OR REPLACE FUNCTION public.protect_trip_lifecycle() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' OR NEW.search_id IS NOT NULL OR NEW.itinerary_id IS NOT NULL
      OR COALESCE(NEW.is_shared, FALSE) OR NEW.share_token IS NOT NULL OR NEW.shared_at IS NOT NULL THEN
      RAISE EXCEPTION 'Trip lifecycle fields are managed by the server' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.status IS DISTINCT FROM OLD.status OR NEW.search_id IS DISTINCT FROM OLD.search_id
    OR NEW.itinerary_id IS DISTINCT FROM OLD.itinerary_id OR NEW.is_shared IS DISTINCT FROM OLD.is_shared
    OR NEW.share_token IS DISTINCT FROM OLD.share_token OR NEW.shared_at IS DISTINCT FROM OLD.shared_at THEN
    RAISE EXCEPTION 'Trip lifecycle fields are managed by the server' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_trip_lifecycle ON public.trips;
CREATE TRIGGER protect_trip_lifecycle BEFORE INSERT OR UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.protect_trip_lifecycle();
