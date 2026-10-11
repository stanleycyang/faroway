-- Apply in one transaction before enabling reconciliation in the new app.
-- Existing run bindings were writable by owners and are not trusted retroactively.
ALTER TABLE public.searches ADD COLUMN IF NOT EXISTS workflow_run_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.protect_search_lifecycle() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Search attempts are managed by the server' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_search_lifecycle ON public.searches;
CREATE TRIGGER protect_search_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON public.searches
FOR EACH ROW EXECUTE FUNCTION public.protect_search_lifecycle();
