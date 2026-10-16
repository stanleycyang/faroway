-- Run only against the labelled, network-isolated Faroway QA database.
-- SQL claim injection exercises RLS; it does not verify JWT signatures or Auth HTTP.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id,email,raw_app_meta_data) VALUES
 ('11111111-1111-4111-8111-111111111111','owner@example.invalid','{"provider":"email"}'),
 ('22222222-2222-4222-8222-222222222222','stranger@example.invalid','{"provider":"email"}');
INSERT INTO public.trips(id,user_id,destination,start_date,end_date) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Paris','2099-06-01','2099-06-02');
INSERT INTO public.itineraries(trip_id) VALUES ('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.trips WHERE id='33333333-3333-4333-8333-333333333333') <> 1 THEN RAISE EXCEPTION 'Owner trip read failed'; END IF;
 IF (SELECT count(*) FROM public.itineraries WHERE trip_id='33333333-3333-4333-8333-333333333333') <> 1 THEN RAISE EXCEPTION 'Owner itinerary read failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ DECLARE changed integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.trips WHERE id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'Stranger trip leak'; END IF;
 IF EXISTS(SELECT 1 FROM public.itineraries WHERE trip_id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'Stranger itinerary leak'; END IF;
 UPDATE public.trips SET destination='Unauthorized' WHERE id='33333333-3333-4333-8333-333333333333';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Stranger write accepted'; END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.trips WHERE id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'Anonymous trip leak'; END IF;
 IF EXISTS(SELECT 1 FROM public.itineraries WHERE trip_id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'Anonymous itinerary leak'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE f record; role_name text; BEGIN
 FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('edit_trip_plan','update_trip_brief','report_trip_booking','read_trip_booking_reports') LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_function_privilege(role_name,f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Client RPC execute grant: % %',role_name,f.oid::regprocedure; END IF;
  END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM public.users WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'))<>2 THEN RAISE EXCEPTION 'Auth profile trigger failed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: full-schema owner/stranger/anonymous reads, stranger write, four RPC grants, signup profile trigger; fixtures rolled back' AS result;
