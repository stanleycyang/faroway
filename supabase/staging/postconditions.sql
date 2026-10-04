-- Fail the whole bootstrap transaction if a required access boundary is missing.
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_tables WHERE schemaname='public')<>24 THEN
    RAISE EXCEPTION 'Unexpected application table inventory';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'Application table without RLS';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef
    AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) THEN
    RAISE EXCEPTION 'Client-accessible SECURITY DEFINER helper';
  END IF;
  IF has_table_privilege('anon','public.trips','SELECT') OR has_table_privilege('authenticated','public.affiliate_stats','SELECT')
    OR has_table_privilege('authenticated','public.trip_booking_reports','SELECT') THEN
    RAISE EXCEPTION 'Unexpected client relation access';
  END IF;
  IF NOT has_table_privilege('authenticated','public.push_tokens','INSERT') OR NOT has_table_privilege('service_role','public.trips','UPDATE') THEN
    RAISE EXCEPTION 'Missing explicit application grants';
  END IF;
  IF (SELECT count(*) FROM public.destinations)<>2 OR (SELECT count(*) FROM public.blog_posts)<>2
     OR EXISTS(SELECT 1 FROM public.destinations WHERE image IS NOT NULL)
     OR EXISTS(SELECT 1 FROM public.blog_posts WHERE cover_image IS NOT NULL) THEN
    RAISE EXCEPTION 'Unexpected synthetic-content fixture';
  END IF;
END $$;
