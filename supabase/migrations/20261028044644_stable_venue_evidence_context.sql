-- Reports belong to a plan and brief, not the sharing timestamp.
-- Apply after traveler_requirements_and_flight_consent, before the v2 callers.
ALTER TABLE public.trip_venue_evidence ADD COLUMN IF NOT EXISTS evidence_revision text
  CHECK (evidence_revision ~ '^[a-f0-9]{64}$');

CREATE OR REPLACE FUNCTION public.trip_venue_evidence_context(p_trip_id uuid, p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'planRevision', t.plan_revision_id,
      'destination', t.destination, 'start', t.start_date, 'end', t.end_date,
      'travelers', t.travelers, 'budget', t.budget_tier, 'vibes', t.vibes,
      'dietary', t.dietary_restrictions, 'mobility', t.mobility_needs,
      'preferences', COALESCE(t.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh',
      'itineraries', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', i.id, 'days', i.days, 'generatedAt', EXTRACT(EPOCH FROM i.generated_at),
        'generation', i.booking_generation_id) ORDER BY i.id)
        FROM public.itineraries i WHERE i.trip_id=t.id AND i.user_id=p_user_id)
    )::text, 'UTF8')), 'hex')
  FROM public.trips t WHERE t.id=p_trip_id AND t.user_id=p_user_id;
$$;
REVOKE ALL ON FUNCTION public.trip_venue_evidence_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trip_venue_evidence_context(uuid, uuid) TO service_role;

-- Only attach legacy reports when their original version still matches exactly.
-- Unprovable historical reports remain stored; do not silently reconfirm them.
UPDATE public.trip_venue_evidence e
SET evidence_revision = public.trip_venue_evidence_context(e.trip_id, e.user_id)
FROM public.trips t WHERE t.id=e.trip_id AND t.user_id=e.user_id
  AND t.updated_at=e.trip_revision AND e.evidence_revision IS NULL
  AND t.status <> 'generating' AND COALESCE(t.preferences->>'planNeedsRefresh','false') <> 'true';

CREATE OR REPLACE FUNCTION public.read_trip_venue_evidence(p_trip_id uuid, p_user_id uuid, p_expected_trip_revision timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE t public.trips%ROWTYPE; context text; reports jsonb;
BEGIN
  SELECT * INTO t FROM public.trips WHERE id=p_trip_id AND user_id=p_user_id FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_expected_trip_revision IS NOT NULL AND t.updated_at IS DISTINCT FROM p_expected_trip_revision THEN
    RAISE EXCEPTION 'Trip changed since display' USING ERRCODE='40001';
  END IF;
  IF t.status='generating' OR COALESCE(t.preferences->>'planNeedsRefresh','false')='true' THEN
    RAISE EXCEPTION 'Plan is not current' USING ERRCODE='40001';
  END IF;
  PERFORM 1 FROM public.itineraries WHERE trip_id=p_trip_id AND user_id=p_user_id FOR SHARE;
  context := public.trip_venue_evidence_context(p_trip_id, p_user_id);
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'venue_id', e.venue_id, 'requirement', e.requirement, 'status', e.status,
    'note', e.note, 'observed_at', e.observed_at, 'evidence_revision', e.evidence_revision
  ) ORDER BY e.venue_id, e.requirement), '[]'::jsonb) INTO reports
  FROM public.trip_venue_evidence e WHERE e.trip_id=p_trip_id AND e.user_id=p_user_id AND e.evidence_revision=context;
  RETURN pg_catalog.jsonb_build_object('tripRevision', t.updated_at, 'evidenceRevision', context, 'evidence', reports);
END;
$$;
REVOKE ALL ON FUNCTION public.read_trip_venue_evidence(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_trip_venue_evidence(uuid, uuid, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.save_trip_venue_evidence_v2(
  p_trip_id uuid, p_user_id uuid, p_evidence_revision text,
  p_venue_id text, p_requirement text, p_status text, p_note text
) RETURNS SETOF public.trip_venue_evidence
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE t public.trips%ROWTYPE; context text;
BEGIN
  SELECT * INTO t FROM public.trips WHERE id=p_trip_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR t.status='generating' OR COALESCE(t.preferences->>'planNeedsRefresh','false')='true' THEN
    RAISE EXCEPTION 'Plan is not current' USING ERRCODE='40001';
  END IF;
  PERFORM 1 FROM public.itineraries WHERE trip_id=p_trip_id AND user_id=p_user_id FOR SHARE;
  context := public.trip_venue_evidence_context(p_trip_id, p_user_id);
  IF p_evidence_revision IS DISTINCT FROM context THEN
    RAISE EXCEPTION 'Plan or requirements changed' USING ERRCODE='40001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.itineraries i
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(i.days)='array' THEN i.days ELSE '[]'::jsonb END
    ) AS day(value)
    CROSS JOIN LATERAL (VALUES (day.value->'morning'), (day.value->'afternoon'), (day.value->'evening')) AS slot(value)
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(slot.value->'activities')='array' THEN slot.value->'activities' ELSE '[]'::jsonb END ||
      CASE WHEN pg_catalog.jsonb_typeof(slot.value->'meals')='array' THEN slot.value->'meals' ELSE '[]'::jsonb END
    ) AS item(value)
    WHERE i.trip_id=p_trip_id AND i.user_id=p_user_id AND item.value->>'id'=p_venue_id
  ) THEN RAISE EXCEPTION 'Venue not in current itinerary' USING ERRCODE='22023'; END IF;
  RETURN QUERY INSERT INTO public.trip_venue_evidence AS e
    (trip_id,user_id,trip_revision,evidence_revision,venue_id,requirement,status,note,observed_at)
  VALUES (p_trip_id,p_user_id,t.updated_at,context,p_venue_id,p_requirement,p_status,COALESCE(p_note,''),pg_catalog.now())
  ON CONFLICT (trip_id,user_id,venue_id,requirement) DO UPDATE SET
    trip_revision=EXCLUDED.trip_revision,evidence_revision=EXCLUDED.evidence_revision,
    status=EXCLUDED.status,note=EXCLUDED.note,observed_at=EXCLUDED.observed_at
  RETURNING e.*;
END;
$$;
REVOKE ALL ON FUNCTION public.save_trip_venue_evidence_v2(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_trip_venue_evidence_v2(uuid, uuid, text, text, text, text, text) TO service_role;
-- Older callers must fail rather than replace a context-aware report without a context.
REVOKE ALL ON FUNCTION public.save_trip_venue_evidence(uuid, uuid, timestamptz, text, text, text, text) FROM service_role;
