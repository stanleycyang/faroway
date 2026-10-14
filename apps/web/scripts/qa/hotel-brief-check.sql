-- Rollback-only checks for the full-schema, network-isolated QA database.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('99999999-9999-4999-8999-999999999991','hotel-owner@example.invalid'),
 ('99999999-9999-4999-8999-999999999992','hotel-stranger@example.invalid');
INSERT INTO public.trips(id,user_id,destination,start_date,end_date,preferences)
VALUES ('99999999-9999-4999-8999-999999999993','99999999-9999-4999-8999-999999999991','Paris','2099-06-01','2099-06-02',
 '{"creationRequestHash":"receipt-preserved","hotelSearch":{"countryCode":"FR","guestNationality":"US","rooms":[{"adults":2,"children":[]}],"consentVersion":"hotel-search-nuitee-v1"}}');
SET LOCAL ROLE service_role;
DO $$
DECLARE saved public.trips%ROWTYPE; old_revision timestamptz; count_rows integer;
BEGIN
 SELECT * INTO saved FROM public.trips WHERE id='99999999-9999-4999-8999-999999999993';
 old_revision := saved.updated_at;
 SELECT * INTO saved FROM public.update_trip_brief(saved.id,saved.user_id,saved.updated_at,
   '{"preferences":{"hotelSearch":{"countryCode":"FR","guestNationality":"CA","rooms":[{"adults":2,"children":[]}],"consentVersion":"hotel-search-nuitee-v1"}}}');
 IF saved.preferences->'hotelSearch'->>'guestNationality' IS DISTINCT FROM 'CA'
    OR saved.preferences->>'creationRequestHash' IS DISTINCT FROM 'receipt-preserved'
    OR saved.updated_at <= old_revision THEN RAISE EXCEPTION 'Hotel edit or receipt preservation failed'; END IF;
 SELECT count(*) INTO count_rows FROM public.update_trip_brief(saved.id,saved.user_id,old_revision,'{"preferences":{"hotelSearch":null}}');
 IF count_rows <> 0 THEN RAISE EXCEPTION 'Stale hotel write accepted'; END IF;
 SELECT count(*) INTO count_rows FROM public.update_trip_brief(saved.id,'99999999-9999-4999-8999-999999999992',saved.updated_at,'{"preferences":{"hotelSearch":null}}');
 IF count_rows <> 0 THEN RAISE EXCEPTION 'Stranger hotel write accepted'; END IF;
 SELECT * INTO saved FROM public.update_trip_brief(saved.id,saved.user_id,saved.updated_at,'{"preferences":{"hotelSearch":null}}');
 IF saved.preferences->'hotelSearch' IS DISTINCT FROM 'null'::jsonb
    OR saved.preferences->>'creationRequestHash' IS DISTINCT FROM 'receipt-preserved' THEN RAISE EXCEPTION 'Consent revocation failed'; END IF;
END $$;
ROLLBACK;
