-- Requires 007000; separate, default-off rollout. No provider or financial writes.
ALTER TABLE public.itineraries ADD COLUMN IF NOT EXISTS booking_generation_id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE OR REPLACE FUNCTION public.rotate_booking_generation() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN NEW.booking_generation_id := gen_random_uuid(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS rotate_booking_generation ON public.itineraries;
CREATE TRIGGER rotate_booking_generation BEFORE UPDATE OF generated_at ON public.itineraries
FOR EACH ROW EXECUTE FUNCTION public.rotate_booking_generation();

CREATE TABLE IF NOT EXISTS public.trip_booking_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence BIGINT GENERATED ALWAYS AS IDENTITY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  generation_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  parent_report_id UUID,
  request_id UUID NOT NULL,
  trip_version TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('needed','provider_opened','traveler_booked')),
  command JSONB NOT NULL,
  item_snapshot JSONB NOT NULL,
  activity_date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(trip_id, request_id)
);
CREATE INDEX IF NOT EXISTS trip_booking_reports_latest ON public.trip_booking_reports(trip_id,generation_id,item_id,sequence DESC);
ALTER TABLE public.trip_booking_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_booking_reports FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.trip_booking_reports TO service_role;
GRANT USAGE ON SEQUENCE public.trip_booking_reports_sequence_seq TO service_role;
-- Reuse the immutable-history guard from 007000 (permits parent-trip cascade only).
DROP TRIGGER IF EXISTS protect_booking_reports ON public.trip_booking_reports;
CREATE TRIGGER protect_booking_reports BEFORE UPDATE OR DELETE ON public.trip_booking_reports
FOR EACH ROW EXECUTE FUNCTION public.protect_plan_history();

CREATE OR REPLACE FUNCTION public.read_trip_booking_reports(p_trip_id UUID,p_user_id UUID,p_request_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql SET search_path=public,pg_temp AS $$
SELECT jsonb_build_object(
  'reports',COALESCE((SELECT jsonb_agg(to_jsonb(r)-'command') FROM (
    SELECT DISTINCT ON (generation_id,item_id) * FROM public.trip_booking_reports
    WHERE trip_id=p_trip_id AND user_id=p_user_id
    ORDER BY generation_id,item_id,sequence DESC
  ) r),'[]'::JSONB),
  'receipt',EXISTS(SELECT 1 FROM public.trip_booking_reports WHERE trip_id=p_trip_id AND user_id=p_user_id AND request_id=p_request_id)
) WHERE EXISTS(SELECT 1 FROM public.trips WHERE id=p_trip_id AND user_id=p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.report_trip_booking(p_trip_id UUID,p_user_id UUID,p_command JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE t public.trips%ROWTYPE; i public.itineraries%ROWTYPE; previous public.trip_booking_reports%ROWTYPE;
  existing public.trip_booking_reports%ROWTYPE; days JSONB; path TEXT[]; activity JSONB; next_id UUID:=gen_random_uuid();
BEGIN
  SELECT * INTO t FROM public.trips WHERE id=p_trip_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"state":"conflict"}'; END IF;
  SELECT * INTO existing FROM public.trip_booking_reports WHERE trip_id=p_trip_id AND request_id=(p_command->>'requestId')::UUID;
  IF FOUND THEN
    IF existing.user_id=p_user_id AND existing.command=p_command THEN RETURN jsonb_build_object('state','replayed','reportId',existing.id); END IF;
    RETURN '{"state":"conflict"}';
  END IF;
  IF t.updated_at IS DISTINCT FROM (p_command->>'expectedUpdatedAt')::TIMESTAMPTZ
    OR t.status NOT IN ('planned','generated') OR COALESCE((t.preferences->>'planNeedsRefresh')::BOOLEAN,FALSE)
    OR p_command->>'status' NOT IN ('needed','provider_opened','traveler_booked')
  THEN RETURN '{"state":"conflict"}'; END IF;
  SELECT * INTO i FROM public.itineraries WHERE trip_id=p_trip_id AND user_id=p_user_id ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR i.booking_generation_id IS DISTINCT FROM (p_command->>'generationId')::UUID THEN RETURN '{"state":"conflict"}'; END IF;
  days:=public.stamp_plan_items(p_trip_id,i.days);
  path:=public.plan_item_path(days,p_command->>'itemId');
  IF path IS NULL THEN RETURN '{"state":"conflict"}'; END IF;
  activity:=days #> path;
  SELECT * INTO previous FROM public.trip_booking_reports WHERE trip_id=p_trip_id AND generation_id=i.booking_generation_id AND item_id=p_command->>'itemId' ORDER BY sequence DESC LIMIT 1;
  IF previous.id IS DISTINCT FROM (p_command->>'expectedReportId')::UUID THEN RETURN '{"state":"conflict"}'; END IF;
  INSERT INTO public.trip_booking_reports(id,trip_id,user_id,generation_id,item_id,parent_report_id,request_id,trip_version,status,command,item_snapshot,activity_date)
  VALUES(next_id,p_trip_id,p_user_id,i.booking_generation_id,p_command->>'itemId',previous.id,(p_command->>'requestId')::UUID,t.updated_at,p_command->>'status',p_command,activity,COALESCE(days->(path[1]::INTEGER)->>'date',''));
  RETURN jsonb_build_object('state','applied','reportId',next_id);
END;
$$;
REVOKE ALL ON FUNCTION public.read_trip_booking_reports(UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.report_trip_booking(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_trip_booking_reports(UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_trip_booking(UUID,UUID,JSONB) TO service_role;
