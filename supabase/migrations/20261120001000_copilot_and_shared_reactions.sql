-- Atomic co-pilot itinerary edits with server-side revision history / undo,
-- plus persistent shared-trip stop reactions with server-side aggregation.

CREATE OR REPLACE FUNCTION public.apply_trip_copilot_edit(
  p_trip_id UUID,
  p_user_id UUID,
  p_mode TEXT,
  p_expected_updated_at TIMESTAMPTZ,
  p_expected_plan_revision UUID,
  p_command JSONB DEFAULT '{}'::JSONB,
  p_days JSONB DEFAULT NULL,
  p_undo_revision_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  t public.trips%ROWTYPE;
  prior public.trip_plan_revisions%ROWTYPE;
  target public.trip_plan_revisions%ROWTYPE;
  itinerary_id UUID;
  original_overview TEXT;
  original JSONB;
  locks TEXT[] := '{}';
  parent_rev UUID;
  next_id UUID := gen_random_uuid();
  next_version TIMESTAMPTZ;
  stamped_next JSONB;
  restored_overview TEXT;
  previous_flag TEXT := current_setting('faroway.plan_write', TRUE);
BEGIN
  IF p_mode NOT IN ('apply', 'undo') THEN
    RETURN '{"state":"invalid"}'::JSONB;
  END IF;

  SELECT * INTO t
  FROM public.trips
  WHERE id = p_trip_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND
     OR t.status NOT IN ('planned', 'generated', 'completed')
     OR COALESCE(t.preferences->>'planNeedsRefresh', 'false') = 'true' THEN
    RETURN '{"state":"conflict"}'::JSONB;
  END IF;

  IF p_expected_updated_at IS NOT NULL AND t.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN '{"state":"conflict"}'::JSONB;
  END IF;

  IF p_expected_plan_revision IS NOT NULL AND t.plan_revision_id IS DISTINCT FROM p_expected_plan_revision THEN
    RETURN '{"state":"conflict"}'::JSONB;
  END IF;

  SELECT id, overview, public.stamp_plan_items(p_trip_id, days)
  INTO itinerary_id, original_overview, original
  FROM public.itineraries
  WHERE trip_id = p_trip_id
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF itinerary_id IS NULL THEN
    RETURN '{"state":"conflict"}'::JSONB;
  END IF;

  IF t.plan_revision_id IS NOT NULL THEN
    SELECT * INTO prior
    FROM public.trip_plan_revisions
    WHERE id = t.plan_revision_id AND trip_id = p_trip_id AND user_id = p_user_id;

    IF NOT FOUND OR prior.days IS DISTINCT FROM original THEN
      RETURN '{"state":"conflict"}'::JSONB;
    END IF;
    locks := prior.locked_items;
  END IF;

  IF p_mode = 'undo' THEN
    IF t.plan_revision_id IS NULL THEN
      RETURN '{"state":"no_undo"}'::JSONB;
    END IF;

    SELECT * INTO target
    FROM public.trip_plan_revisions
    WHERE id = COALESCE(p_undo_revision_id, prior.parent_id)
      AND trip_id = p_trip_id
      AND user_id = p_user_id;

    IF NOT FOUND THEN
      RETURN '{"state":"no_undo"}'::JSONB;
    END IF;

    stamped_next := public.stamp_plan_items(p_trip_id, target.days);
    restored_overview := COALESCE(target.overview, '');

    PERFORM set_config('faroway.plan_write', p_trip_id::TEXT, TRUE);
    UPDATE public.itineraries
    SET days = stamped_next, overview = restored_overview
    WHERE id = itinerary_id;

    UPDATE public.trips
    SET plan_revision_id = next_id,
        is_shared = FALSE,
        share_token = NULL,
        shared_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = p_trip_id
    RETURNING updated_at INTO next_version;

    INSERT INTO public.trip_plan_revisions (
      id, trip_id, user_id, parent_id, observed_trip_version, result_trip_version,
      command, days, locked_items, overview
    ) VALUES (
      next_id, p_trip_id, p_user_id, t.plan_revision_id, t.updated_at, next_version,
      jsonb_build_object('action', 'copilot_undo', 'targetRevisionId', target.id),
      stamped_next, target.locked_items, restored_overview
    );

    PERFORM set_config('faroway.plan_write', COALESCE(previous_flag, ''), TRUE);
    RETURN jsonb_build_object(
      'state', 'applied',
      'planRevision', next_id,
      'undoRevisionId', t.plan_revision_id,
      'revision', next_version,
      'restoredDays', stamped_next,
      'restoredOverview', restored_overview
    );
  END IF;

  -- p_mode = 'apply'
  IF p_days IS NULL OR jsonb_typeof(p_days) <> 'array' THEN
    RETURN '{"state":"invalid"}'::JSONB;
  END IF;

  parent_rev := t.plan_revision_id;
  IF parent_rev IS NULL THEN
    INSERT INTO public.trip_plan_revisions (
      trip_id, user_id, observed_trip_version, result_trip_version,
      command, days, overview
    ) VALUES (
      p_trip_id, p_user_id, t.updated_at, t.updated_at,
      '{"action":"baseline"}'::JSONB, original, COALESCE(original_overview, '')
    )
    RETURNING id INTO parent_rev;
  END IF;

  stamped_next := public.stamp_plan_items(p_trip_id, p_days);

  PERFORM set_config('faroway.plan_write', p_trip_id::TEXT, TRUE);
  UPDATE public.itineraries
  SET days = stamped_next, overview = ''
  WHERE id = itinerary_id;

  UPDATE public.trips
  SET plan_revision_id = next_id,
      is_shared = FALSE,
      share_token = NULL,
      shared_at = NULL,
      updated_at = clock_timestamp()
  WHERE id = p_trip_id
  RETURNING updated_at INTO next_version;

  INSERT INTO public.trip_plan_revisions (
    id, trip_id, user_id, parent_id, observed_trip_version, result_trip_version,
    command, days, locked_items, overview
  ) VALUES (
    next_id, p_trip_id, p_user_id, parent_rev, t.updated_at, next_version,
    COALESCE(p_command, '{"action":"copilot"}'::JSONB),
    stamped_next, locks, ''
  );

  PERFORM set_config('faroway.plan_write', COALESCE(previous_flag, ''), TRUE);
  RETURN jsonb_build_object(
    'state', 'applied',
    'planRevision', next_id,
    'undoRevisionId', parent_rev,
    'revision', next_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_trip_copilot_edit(UUID, UUID, TEXT, TIMESTAMPTZ, UUID, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_trip_copilot_edit(UUID, UUID, TEXT, TIMESTAMPTZ, UUID, JSONB, JSONB, UUID) TO service_role;

-- Persistent shared-trip stop reactions (public voting on /s/[token])
CREATE TABLE IF NOT EXISTS public.shared_trip_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL,
  stop_key TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('thumbs_up', 'heart')),
  voter_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (share_token, stop_key, reaction, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_trip_reactions_token_stop
  ON public.shared_trip_reactions (share_token, stop_key, reaction);

ALTER TABLE public.shared_trip_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_trip_reactions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.shared_trip_reactions TO service_role;

CREATE OR REPLACE FUNCTION public.get_shared_trip_reaction_counts(p_share_token TEXT)
RETURNS TABLE(stop_key TEXT, reaction TEXT, count BIGINT)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT r.stop_key, r.reaction, COUNT(*)::BIGINT AS count
  FROM public.shared_trip_reactions r
  WHERE r.share_token = p_share_token
  GROUP BY r.stop_key, r.reaction;
$$;

REVOKE ALL ON FUNCTION public.get_shared_trip_reaction_counts(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_trip_reaction_counts(TEXT) TO service_role;
