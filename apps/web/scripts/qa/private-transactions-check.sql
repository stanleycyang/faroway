\set ON_ERROR_STOP on
-- Seed only the disposable QA database, then exercise actual RPCs as service_role.
INSERT INTO public.trips(id,user_id,is_shared,share_token,updated_at)
VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',TRUE,'synthetic-old-link','2026-01-02T00:00:00Z');
INSERT INTO public.itineraries(trip_id,user_id,days,overview)
VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
'[{"date":"2099-06-01","morning":{"activities":[{"name":"Museum"}]},"afternoon":{"activities":[{"name":"Gallery"}]},"evening":{"activities":[]},"tips":[]}]','Original overview');
SET ROLE service_role;
DO $$
DECLARE
  trip UUID := '33333333-3333-4333-8333-333333333333';
  owner UUID := '11111111-1111-4111-8111-111111111111';
  stranger UUID := '22222222-2222-4222-8222-222222222222';
  days JSONB; item TEXT; other TEXT; revision TIMESTAMPTZ; plan_revision UUID;
  command JSONB; changed JSONB; result JSONB; report JSONB; generation UUID;
BEGIN
  SELECT public.stamp_plan_items(trip,i.days),i.booking_generation_id INTO days,generation FROM public.itineraries i WHERE i.trip_id=trip;
  item := days#>>'{0,morning,activities,0,planItemId}'; other := days#>>'{0,afternoon,activities,0,planItemId}';
  SELECT t.updated_at INTO revision FROM public.trips t WHERE t.id=trip;
  command := jsonb_build_object('requestId',gen_random_uuid(),'expectedUpdatedAt',revision,'expectedPlanRevision',NULL,'action','lock','itemId',item);
  result := public.edit_trip_plan(trip,stranger,command,days,ARRAY[item]);
  IF result->>'state'<>'conflict' THEN RAISE EXCEPTION 'Cross-owner edit accepted'; END IF;
  result := public.edit_trip_plan(trip,owner,command,days,ARRAY[item]);
  IF result->>'state'<>'applied' THEN RAISE EXCEPTION 'Lock not applied: %',result; END IF;
  IF EXISTS(SELECT 1 FROM public.trips t WHERE t.id=trip AND (t.is_shared OR t.share_token IS NOT NULL)) THEN RAISE EXCEPTION 'Edit retained public access'; END IF;
  result := public.edit_trip_plan(trip,owner,command,days,ARRAY[item]);
  IF result->>'state'<>'replayed' THEN RAISE EXCEPTION 'Exact edit replay failed'; END IF;
  result := public.edit_trip_plan(trip,owner,command||'{"action":"unlock"}',days,'{}');
  IF result->>'state'<>'conflict' THEN RAISE EXCEPTION 'Changed command reused request identity'; END IF;
  SELECT t.updated_at,t.plan_revision_id INTO revision,plan_revision FROM public.trips t WHERE t.id=trip;
  command := jsonb_build_object('requestId',gen_random_uuid(),'expectedUpdatedAt',revision,'expectedPlanRevision',plan_revision,'action','swap','itemId',item,'otherItemId',other);
  result := public.edit_trip_plan(trip,owner,command,days,ARRAY[item]);
  IF result->>'state'<>'conflict' THEN RAISE EXCEPTION 'Locked item swapped'; END IF;
  command := command-'otherItemId'||jsonb_build_object('action','unlock','requestId',gen_random_uuid());
  result := public.edit_trip_plan(trip,owner,command,days,'{}');
  IF result->>'state'<>'applied' THEN RAISE EXCEPTION 'Unlock not applied'; END IF;
  SELECT t.updated_at,t.plan_revision_id INTO revision,plan_revision FROM public.trips t WHERE t.id=trip;
  command := jsonb_build_object('requestId',gen_random_uuid(),'expectedUpdatedAt',revision,'expectedPlanRevision',plan_revision,'action','swap','itemId',item,'otherItemId',other);
  changed := jsonb_set(jsonb_set(days,'{0,morning,activities,0}',(days#>'{0,afternoon,activities,0}')||'{"timeOfDay":"morning"}'),'{0,afternoon,activities,0}',(days#>'{0,morning,activities,0}')||'{"timeOfDay":"afternoon"}');
  changed := jsonb_set(changed,'{0}',(changed->0)-'totalEstimatedCost'||'{"title":"Day 1","summary":"Schedule updated. Check travel times and opening hours.","tips":[]}');
  result := public.edit_trip_plan(trip,owner,command,changed,'{}');
  IF result->>'state'<>'applied' THEN RAISE EXCEPTION 'Swap not applied: %',result; END IF;
  IF (SELECT i.days#>>'{0,morning,activities,0,name}' FROM public.itineraries i WHERE i.trip_id=trip)<>'Gallery' THEN RAISE EXCEPTION 'Swap did not persist'; END IF;
  SELECT t.updated_at INTO revision FROM public.trips t WHERE t.id=trip;
  report := jsonb_build_object('requestId',gen_random_uuid(),'expectedUpdatedAt',revision,'generationId',generation,'itemId',item,'expectedReportId',NULL,'status','traveler_booked');
  result := public.report_trip_booking(trip,stranger,report);
  IF result->>'state'<>'conflict' THEN RAISE EXCEPTION 'Cross-owner report accepted'; END IF;
  result := public.report_trip_booking(trip,owner,report);
  IF result->>'state'<>'applied' THEN RAISE EXCEPTION 'Report not applied: %',result; END IF;
  result := public.report_trip_booking(trip,owner,report);
  IF result->>'state'<>'replayed' THEN RAISE EXCEPTION 'Exact report replay failed'; END IF;
  result := public.report_trip_booking(trip,owner,report||'{"status":"needed"}');
  IF result->>'state'<>'conflict' THEN RAISE EXCEPTION 'Changed report reused request identity'; END IF;
  result := public.read_trip_booking_reports(trip,owner,(report->>'requestId')::UUID);
  IF NOT (result->>'receipt')::BOOLEAN OR jsonb_array_length(result->'reports')<>1 THEN RAISE EXCEPTION 'Receipt/history read failed'; END IF;
  IF public.read_trip_booking_reports(trip,stranger,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Cross-owner history disclosed'; END IF;
  IF has_function_privilege('authenticated','public.edit_trip_plan(uuid,uuid,jsonb,jsonb,text[])','execute') OR has_function_privilege('anon','public.report_trip_booking(uuid,uuid,jsonb)','execute') THEN RAISE EXCEPTION 'Public mutation RPC privilege'; END IF;
  RAISE NOTICE 'PASS: owner guards, lock/unlock/swap, persistence, public revocation, exact replays, changed-identity conflicts, receipt/history and RPC grants';
END $$;
RESET ROLE;
