-- Apply after 005000/006000 and drain old writers before enabling the new UI.
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS plan_revision_id UUID;
CREATE TABLE IF NOT EXISTS public.trip_plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.trip_plan_revisions(id),
  request_id UUID,
  observed_trip_version TIMESTAMPTZ NOT NULL,
  result_trip_version TIMESTAMPTZ NOT NULL,
  command JSONB NOT NULL,
  days JSONB NOT NULL,
  overview TEXT,
  locked_items TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(trip_id,request_id)
);
ALTER TABLE public.trip_plan_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_own_plan_revisions ON public.trip_plan_revisions;
-- All history reads go through the owned API and current content policy.
REVOKE ALL ON public.trip_plan_revisions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.trip_plan_revisions TO service_role;

CREATE OR REPLACE FUNCTION public.stamp_plan_items(p_trip_id UUID, p_days JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE d JSONB; a JSONB; di BIGINT; ai BIGINT; slot TEXT; item_id TEXT; result JSONB := p_days;
BEGIN
  FOR d,di IN SELECT value,ordinality-1 FROM jsonb_array_elements(p_days) WITH ORDINALITY LOOP
    FOREACH slot IN ARRAY ARRAY['morning','afternoon','evening'] LOOP
      FOR a,ai IN SELECT value,ordinality-1 FROM jsonb_array_elements(COALESCE(d->slot->'activities','[]')) WITH ORDINALITY LOOP
        item_id := CASE WHEN a->>'planItemId' ~ '^item_[a-f0-9]{32}$' THEN a->>'planItemId'
          ELSE 'item_' || md5(p_trip_id::TEXT || ':' || di || ':' || slot || ':' || ai) END;
        result := jsonb_set(result, ARRAY[di::TEXT,slot,'activities',ai::TEXT], a || jsonb_build_object('planItemId',item_id));
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.plan_item_path(p_days JSONB,p_id TEXT) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT ARRAY[(d.ordinality-1)::TEXT,s.slot,'activities',(a.ordinality-1)::TEXT]
  FROM jsonb_array_elements(p_days) WITH ORDINALITY d(value,ordinality)
  CROSS JOIN unnest(ARRAY['morning','afternoon','evening']) s(slot)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.value->s.slot->'activities','[]')) WITH ORDINALITY a(value,ordinality)
  WHERE a.value->>'planItemId' = p_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.protect_plan_revision() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.plan_revision_id IS DISTINCT FROM OLD.plan_revision_id AND
    current_user NOT IN ('postgres','supabase_admin') AND
    (current_user <> 'service_role' OR COALESCE(current_setting('faroway.plan_write',TRUE),'') <> NEW.id::TEXT) THEN
    RAISE EXCEPTION 'Use the versioned plan API' USING ERRCODE='42501';
  END IF;
  -- A new generated plan starts a new edit lineage. Previous immutable history
  -- remains available; favorites are not moved across a changed trip brief.
  IF OLD.status='generating' AND NEW.status='planned' THEN NEW.plan_revision_id := NULL; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_plan_revision ON public.trips;
CREATE TRIGGER protect_plan_revision BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.protect_plan_revision();

CREATE OR REPLACE FUNCTION public.protect_itinerary_write() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE trip_id UUID := CASE WHEN TG_OP='DELETE' THEN OLD.trip_id ELSE NEW.trip_id END;
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS (SELECT 1 FROM public.trips WHERE id=trip_id) THEN RETURN OLD; END IF;
  IF current_user NOT IN ('postgres','supabase_admin') AND
    (current_user <> 'service_role' OR COALESCE(current_setting('faroway.plan_write',TRUE),'') <> trip_id::TEXT) THEN
    RAISE EXCEPTION 'Itinerary writes require a fenced generation or plan edit' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_itinerary_write ON public.itineraries;
CREATE TRIGGER protect_itinerary_write BEFORE INSERT OR UPDATE OR DELETE ON public.itineraries FOR EACH ROW EXECUTE FUNCTION public.protect_itinerary_write();

CREATE OR REPLACE FUNCTION public.protect_plan_history() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS (SELECT 1 FROM public.trips WHERE id=OLD.trip_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Plan history is immutable' USING ERRCODE='42501';
END; $$;
DROP TRIGGER IF EXISTS protect_plan_history ON public.trip_plan_revisions;
CREATE TRIGGER protect_plan_history BEFORE UPDATE OR DELETE ON public.trip_plan_revisions FOR EACH ROW EXECUTE FUNCTION public.protect_plan_history();

CREATE OR REPLACE FUNCTION public.edit_trip_plan(p_trip_id UUID,p_user_id UUID,p_command JSONB,p_days JSONB,p_locked TEXT[])
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE t public.trips%ROWTYPE; prior public.trip_plan_revisions%ROWTYPE; existing public.trip_plan_revisions%ROWTYPE;
  itinerary UUID; original_overview TEXT; original JSONB; expected JSONB; locks TEXT[] := '{}'; a TEXT[]; b TEXT[];
  parent UUID; day_index TEXT; next_id UUID := gen_random_uuid(); version TIMESTAMPTZ; previous_flag TEXT := current_setting('faroway.plan_write',TRUE);
BEGIN
  SELECT * INTO t FROM public.trips WHERE id=p_trip_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR t.status NOT IN ('planned','generated') OR COALESCE(t.preferences->>'planNeedsRefresh','false')='true' THEN RETURN '{"state":"conflict"}'; END IF;
  SELECT * INTO existing FROM public.trip_plan_revisions WHERE trip_id=p_trip_id AND request_id=(p_command->>'requestId')::UUID;
  IF FOUND THEN
    IF existing.command=p_command AND t.plan_revision_id=existing.id AND t.updated_at=existing.result_trip_version THEN
      RETURN jsonb_build_object('state','replayed','planRevision',existing.id,'revision',t.updated_at);
    END IF;
    RETURN '{"state":"conflict"}';
  END IF;
  IF t.updated_at IS DISTINCT FROM (p_command->>'expectedUpdatedAt')::TIMESTAMPTZ OR t.plan_revision_id IS DISTINCT FROM (p_command->>'expectedPlanRevision')::UUID THEN RETURN '{"state":"conflict"}'; END IF;
  SELECT id,overview,public.stamp_plan_items(p_trip_id,days) INTO itinerary,original_overview,original FROM public.itineraries WHERE trip_id=p_trip_id ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF itinerary IS NULL THEN RETURN '{"state":"conflict"}'; END IF;
  IF t.plan_revision_id IS NOT NULL THEN
    SELECT * INTO prior FROM public.trip_plan_revisions WHERE id=t.plan_revision_id AND trip_id=p_trip_id AND user_id=p_user_id;
    IF NOT FOUND OR prior.days IS DISTINCT FROM original THEN RETURN '{"state":"conflict"}'; END IF;
    locks := prior.locked_items;
  END IF;
  expected := original;
  a := public.plan_item_path(original,p_command->>'itemId');
  IF a IS NULL THEN RETURN '{"state":"conflict"}'; END IF;
  CASE p_command->>'action'
    WHEN 'lock' THEN IF NOT (p_command->>'itemId'=ANY(locks)) THEN locks := array_append(locks,p_command->>'itemId'); END IF;
    WHEN 'unlock' THEN locks := array_remove(locks,p_command->>'itemId');
    WHEN 'swap' THEN
      b := public.plan_item_path(original,p_command->>'otherItemId');
      IF b IS NULL OR a=b OR p_command->>'itemId'=ANY(locks) OR p_command->>'otherItemId'=ANY(locks) THEN RETURN '{"state":"conflict"}'; END IF;
      expected := jsonb_set(jsonb_set(original,a,(original#>b) || jsonb_build_object('timeOfDay',a[2])),b,(original#>a) || jsonb_build_object('timeOfDay',b[2]));
      FOREACH day_index IN ARRAY ARRAY[a[1],b[1]] LOOP
        expected := jsonb_set(expected,ARRAY[day_index],((expected->(day_index::INTEGER)) - 'totalEstimatedCost') || jsonb_build_object('title','Day ' || (day_index::INTEGER+1),'summary','Schedule updated. Check travel times and opening hours.','tips','[]'::JSONB));
      END LOOP;
    ELSE RETURN '{"state":"conflict"}';
  END CASE;
  IF expected IS DISTINCT FROM p_days OR locks IS DISTINCT FROM p_locked THEN RETURN '{"state":"conflict"}'; END IF;
  parent := t.plan_revision_id;
  IF parent IS NULL THEN
    INSERT INTO public.trip_plan_revisions(trip_id,user_id,observed_trip_version,result_trip_version,command,days,overview)
    VALUES(p_trip_id,p_user_id,t.updated_at,t.updated_at,'{"action":"baseline"}',original,original_overview) RETURNING id INTO parent;
  END IF;
  PERFORM set_config('faroway.plan_write',p_trip_id::TEXT,TRUE);
  UPDATE public.itineraries SET days=p_days,overview=CASE WHEN p_command->>'action'='swap' THEN '' ELSE overview END WHERE id=itinerary;
  UPDATE public.trips SET plan_revision_id=next_id,is_shared=FALSE,share_token=NULL,shared_at=NULL,updated_at=clock_timestamp() WHERE id=p_trip_id RETURNING updated_at INTO version;
  INSERT INTO public.trip_plan_revisions(id,trip_id,user_id,parent_id,request_id,observed_trip_version,result_trip_version,command,days,locked_items,overview)
  VALUES(next_id,p_trip_id,p_user_id,parent,(p_command->>'requestId')::UUID,t.updated_at,version,p_command,p_days,locks,CASE WHEN p_command->>'action'='swap' THEN '' ELSE original_overview END);
  PERFORM set_config('faroway.plan_write',COALESCE(previous_flag,''),TRUE);
  RETURN jsonb_build_object('state','applied','planRevision',next_id,'revision',version);
END; $$;
REVOKE ALL ON FUNCTION public.edit_trip_plan(UUID,UUID,JSONB,JSONB,TEXT[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edit_trip_plan(UUID,UUID,JSONB,JSONB,TEXT[]) TO service_role;

-- Preserve the existing attempt fence while authorizing its atomic itinerary write.
-- Apply before deploying callers. No production execution is part of this change.
-- The trip row lock serializes generation claims, progress and final writes.
CREATE OR REPLACE FUNCTION public.apply_trip_generation_update(
  p_trip_id UUID, p_search_id UUID, p_state TEXT, p_payload JSONB DEFAULT '{}'::JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_itinerary_id UUID;
  v_previous_plan_write TEXT := current_setting('faroway.plan_write', TRUE);
BEGIN
  IF p_state NOT IN ('progress', 'failed', 'planned') THEN
    RAISE EXCEPTION 'Invalid generation update state';
  END IF;
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR v_trip.search_id IS DISTINCT FROM p_search_id THEN RETURN FALSE; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.searches WHERE id = p_search_id AND user_id = v_trip.user_id) THEN RETURN FALSE; END IF;
  -- A repeated terminal write is acknowledged without rewriting the itinerary,
  -- progress or notification. A stale or canceled attempt cannot publish.
  IF v_trip.status = p_state AND p_state IN ('failed', 'planned') THEN RETURN TRUE; END IF;
  IF v_trip.status <> 'generating' THEN RETURN FALSE; END IF;

  IF p_state = 'planned' THEN
    PERFORM set_config('faroway.plan_write', p_trip_id::TEXT, TRUE);
    SELECT id INTO v_itinerary_id FROM public.itineraries WHERE trip_id = p_trip_id ORDER BY created_at LIMIT 1 FOR UPDATE;
    IF v_itinerary_id IS NULL THEN
      INSERT INTO public.itineraries (trip_id, user_id, destination, start_date, end_date, overview, total_cost, days, packing_list, general_tips, generated_at)
      VALUES (p_trip_id, v_trip.user_id, v_trip.destination, v_trip.start_date, v_trip.end_date, p_payload->>'overview', p_payload->'total_cost', p_payload->'days', '{}', '{}', NOW())
      RETURNING id INTO v_itinerary_id;
    ELSE
      UPDATE public.itineraries SET user_id = v_trip.user_id, destination = v_trip.destination, start_date = v_trip.start_date, end_date = v_trip.end_date,
        overview = p_payload->>'overview', total_cost = p_payload->'total_cost', days = p_payload->'days', packing_list = '{}', general_tips = '{}', generated_at = NOW()
      WHERE id = v_itinerary_id;
    END IF;
    UPDATE public.trips SET status = 'planned', itinerary_id = v_itinerary_id, updated_at = NOW() WHERE id = p_trip_id;
    INSERT INTO public.notifications (user_id, type, title, message, data, read)
    VALUES (v_trip.user_id, 'itinerary_ready', 'Your Itinerary is Ready!', 'Your trip itinerary is ready to view.', jsonb_build_object('trip_id', p_trip_id, 'search_id', p_search_id, 'itinerary_id', v_itinerary_id), FALSE);
    PERFORM set_config('faroway.plan_write', COALESCE(v_previous_plan_write, ''), TRUE);
  ELSIF p_state = 'failed' THEN
    UPDATE public.trips SET status = 'failed', updated_at = NOW() WHERE id = p_trip_id;
  END IF;

  INSERT INTO public.workflow_progress (trip_id, user_id, step, progress, message, updated_at)
  VALUES (p_trip_id, v_trip.user_id,
    CASE WHEN p_state = 'planned' THEN 'complete' WHEN p_state = 'failed' THEN 'error' ELSE p_payload->>'step' END,
    CASE WHEN p_state = 'planned' THEN 100 WHEN p_state = 'failed' THEN 0 ELSE (p_payload->>'progress')::INTEGER END,
    CASE WHEN p_state = 'planned' THEN 'Your itinerary is ready!' ELSE p_payload->>'message' END, NOW())
  ON CONFLICT (trip_id) DO UPDATE SET user_id = EXCLUDED.user_id, step = EXCLUDED.step, progress = EXCLUDED.progress, message = EXCLUDED.message, updated_at = EXCLUDED.updated_at;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_trip_generation_update(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_trip_generation_update(UUID, UUID, TEXT, JSONB) TO service_role;
