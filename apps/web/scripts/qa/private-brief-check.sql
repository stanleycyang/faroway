-- Disposable rollback-only brief checks; real RPC and trigger bodies.
BEGIN;
INSERT INTO public.trips(id,user_id,is_shared,share_token)
VALUES('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111',TRUE,'synthetic-brief-share');
INSERT INTO public.itineraries(trip_id,user_id,days)
VALUES('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111','[]');
SET LOCAL ROLE service_role;
DO $$
DECLARE before_revision timestamptz; saved public.trips%ROWTYPE; count_rows integer;
BEGIN
 SELECT updated_at INTO before_revision FROM public.trips WHERE id='88888888-8888-4888-8888-888888888888';
 SELECT * INTO saved FROM public.update_trip_brief('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111',before_revision,'{"destination":"Tokyo","start_date":"2099-07-01","end_date":"2099-07-03"}');
 IF saved.destination <> 'Tokyo' OR saved.updated_at <= before_revision OR saved.status <> 'draft'
    OR saved.is_shared OR saved.share_token IS NOT NULL OR saved.preferences->>'planNeedsRefresh' <> 'true' THEN
   RAISE EXCEPTION 'Brief revision/publication invalidation failed';
 END IF;
 SELECT count(*) INTO count_rows FROM public.update_trip_brief(saved.id,saved.user_id,before_revision,'{"destination":"Stale"}');
 IF count_rows <> 0 THEN RAISE EXCEPTION 'Stale brief was applied'; END IF;
 SELECT count(*) INTO count_rows FROM public.update_trip_brief(saved.id,'22222222-2222-4222-8222-222222222222',saved.updated_at,'{"destination":"Stranger"}');
 IF count_rows <> 0 THEN RAISE EXCEPTION 'Stranger brief was applied'; END IF;
 UPDATE public.trips SET status='generating' WHERE id=saved.id;
 SELECT updated_at INTO before_revision FROM public.trips WHERE id=saved.id;
 SELECT count(*) INTO count_rows FROM public.update_trip_brief(saved.id,saved.user_id,before_revision,'{"destination":"Locked"}');
 IF count_rows <> 0 THEN RAISE EXCEPTION 'Generating brief was applied'; END IF;
END;
$$;
ROLLBACK;
