\set ON_ERROR_STOP on
SET ROLE service_role;
DO $$
DECLARE
  trip UUID := '33333333-3333-4333-8333-333333333333';
  owner UUID := '11111111-1111-4111-8111-111111111111';
  version TIMESTAMPTZ; plan UUID; days JSONB; item TEXT; command JSONB; result JSONB; role_name TEXT;
BEGIN
  SELECT t.updated_at,t.plan_revision_id INTO version,plan FROM public.trips t WHERE t.id=trip;
  SELECT i.days INTO days FROM public.itineraries i WHERE i.trip_id=trip;
  item := days#>>'{0,morning,activities,0,planItemId}';
  command := jsonb_build_object('requestId',gen_random_uuid(),'expectedUpdatedAt','2026-01-02T00:00:00Z','expectedPlanRevision',NULL,'action','lock','itemId',item);
  result := public.edit_trip_plan(trip,owner,command,days,ARRAY[item]);
  IF result->>'state'<>'conflict' THEN RAISE EXCEPTION 'Stale revision accepted'; END IF;
  command := command||jsonb_build_object('requestId',gen_random_uuid(),'expectedUpdatedAt',version,'expectedPlanRevision',plan);
  result := public.edit_trip_plan(trip,owner,command,days||'[{"date":"2099-06-03"}]',ARRAY[item]);
  IF result->>'state'<>'conflict' THEN RAISE EXCEPTION 'Forged derived plan accepted'; END IF;
  BEGIN
    UPDATE public.itineraries SET overview='Unfenced write' WHERE trip_id=trip;
    RAISE EXCEPTION 'Unfenced itinerary write accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_function_privilege(role_name,'public.edit_trip_plan(uuid,uuid,jsonb,jsonb,text[])','execute')
       OR has_function_privilege(role_name,'public.report_trip_booking(uuid,uuid,jsonb)','execute')
       OR has_function_privilege(role_name,'public.read_trip_booking_reports(uuid,uuid,uuid)','execute')
       OR has_table_privilege(role_name,'public.trip_plan_revisions','select')
       OR has_table_privilege(role_name,'public.trip_booking_reports','select')
    THEN RAISE EXCEPTION 'Public history/RPC privilege for %',role_name; END IF;
  END LOOP;
  RAISE NOTICE 'PASS: stale revision and forged derived plan rejected, unfenced writes blocked, both public role privilege matrices';
END $$;
RESET ROLE;
