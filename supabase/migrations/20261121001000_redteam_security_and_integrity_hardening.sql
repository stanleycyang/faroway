-- Red-team security & data-integrity hardening migration.
-- Forward-only migration; safe and idempotent on staging and production.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ============================================================================
-- 1. Protect privileged columns on public.users from direct authenticated writes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_user_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.subscription_tier IS DISTINCT FROM 'free'
       OR NEW.notification_consent_version IS NOT NULL THEN
      RAISE EXCEPTION 'Privileged user fields are managed by the server'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.auth_provider IS DISTINCT FROM OLD.auth_provider
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.notification_consent_version IS DISTINCT FROM OLD.notification_consent_version THEN
    RAISE EXCEPTION 'Privileged user fields are managed by the server'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_user_privileged_columns()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_user_privileged_columns()
  TO service_role;

DROP TRIGGER IF EXISTS protect_user_privileged_columns ON public.users;
CREATE TRIGGER protect_user_privileged_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_privileged_columns();

-- ============================================================================
-- 2. Extend protect_trip_brief() to cover all brief/safety columns
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_trip_brief()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_changed BOOLEAN;
  v_server BOOLEAN := current_user IN ('service_role', 'postgres', 'supabase_admin');
BEGIN
  v_changed := ROW(
    NEW.destination,
    NEW.start_date,
    NEW.end_date,
    NEW.travelers,
    NEW.budget_tier,
    NEW.budget,
    NEW.vibes,
    NEW.interests,
    NEW.dietary_restrictions,
    NEW.mobility_needs,
    NEW.travelers_data,
    COALESCE(NEW.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh'
  ) IS DISTINCT FROM ROW(
    OLD.destination,
    OLD.start_date,
    OLD.end_date,
    OLD.travelers,
    OLD.budget_tier,
    OLD.budget,
    OLD.vibes,
    OLD.interests,
    OLD.dietary_restrictions,
    OLD.mobility_needs,
    OLD.travelers_data,
    COALESCE(OLD.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh'
  );

  IF NOT v_server AND (v_changed OR NEW.preferences IS DISTINCT FROM OLD.preferences) THEN
    RAISE EXCEPTION 'Use the versioned trip brief API' USING ERRCODE = '42501';
  END IF;

  -- Preserve server metadata even when older clients send a partial preferences object.
  NEW.preferences := (COALESCE(NEW.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh') ||
    (COALESCE(OLD.preferences, '{}'::jsonb) - ARRAY[
      'travelerType',
      'originCity',
      'originAirport',
      'adults',
      'children',
      'interests',
      'hotelSearch',
      'flightSearch',
      'requirements'
    ]);

  IF v_changed THEN
    IF current_user = 'service_role'
       AND COALESCE(current_setting('faroway.versioned_brief_write', TRUE), '') <> 'on' THEN
      RAISE EXCEPTION 'Brief writes require the versioned RPC' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'generating' THEN
      RAISE EXCEPTION 'Trip brief is locked while planning' USING ERRCODE = '40001';
    END IF;
    NEW.status := 'draft';
    NEW.search_id := NULL;
    NEW.is_shared := FALSE;
    NEW.share_token := NULL;
    NEW.shared_at := NULL;
    NEW.preferences := NEW.preferences || jsonb_build_object(
      'planNeedsRefresh',
      EXISTS (SELECT 1 FROM public.itineraries WHERE trip_id = OLD.id)
    );
  ELSIF v_server
        AND OLD.status = 'generating'
        AND NEW.status = 'planned'
        AND NEW.search_id IS NOT DISTINCT FROM OLD.search_id THEN
    NEW.preferences := NEW.preferences - 'planNeedsRefresh';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_trip_brief()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_trip_brief()
  TO service_role;

-- ============================================================================
-- 3. Harden stamp_plan_items() against JSONB null / non-array shapes & collisions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.stamp_plan_items(p_trip_id UUID, p_days JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d JSONB;
  a JSONB;
  di BIGINT;
  ai BIGINT;
  slot TEXT;
  slot_obj JSONB;
  acts JSONB;
  item_id TEXT;
  suffix INTEGER;
  seen_ids TEXT[] := '{}';
  result JSONB;
BEGIN
  IF p_days IS NULL OR jsonb_typeof(p_days) <> 'array' THEN
    RETURN '[]'::JSONB;
  END IF;

  result := p_days;

  FOR d, di IN SELECT value, ordinality - 1 FROM jsonb_array_elements(p_days) WITH ORDINALITY LOOP
    IF jsonb_typeof(d) <> 'object' THEN
      CONTINUE;
    END IF;

    FOREACH slot IN ARRAY ARRAY['morning', 'afternoon', 'evening'] LOOP
      slot_obj := d -> slot;
      IF slot_obj IS NULL OR jsonb_typeof(slot_obj) <> 'object' THEN
        CONTINUE;
      END IF;

      acts := slot_obj -> 'activities';
      IF acts IS NULL OR jsonb_typeof(acts) <> 'array' THEN
        CONTINUE;
      END IF;

      FOR a, ai IN SELECT value, ordinality - 1 FROM jsonb_array_elements(acts) WITH ORDINALITY LOOP
        IF jsonb_typeof(a) <> 'object' THEN
          CONTINUE;
        END IF;

        IF (a ->> 'planItemId') ~ '^item_[a-f0-9]{32}$' THEN
          item_id := a ->> 'planItemId';
        ELSE
          item_id := 'item_' || md5(p_trip_id::TEXT || ':' || di || ':' || slot || ':' || ai);
          suffix := 1;
          WHILE item_id = ANY(seen_ids) LOOP
            item_id := 'item_' || md5(p_trip_id::TEXT || ':' || di || ':' || slot || ':' || ai || ':' || suffix);
            suffix := suffix + 1;
          END LOOP;
        END IF;

        seen_ids := array_append(seen_ids, item_id);
        result := jsonb_set(
          result,
          ARRAY[di::TEXT, slot, 'activities', ai::TEXT],
          a || jsonb_build_object('planItemId', item_id)
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN result;
END;
$$;

-- ============================================================================
-- 4. Harden apply_trip_copilot_edit() & shared_trip_reactions
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shared_trip_reactions_trip_id
  ON public.shared_trip_reactions (trip_id);

CREATE OR REPLACE FUNCTION public.get_shared_trip_reaction_counts(p_share_token TEXT)
RETURNS TABLE(stop_key TEXT, reaction TEXT, count BIGINT)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT r.stop_key, r.reaction, COUNT(*)::BIGINT AS count
  FROM public.shared_trip_reactions r
  INNER JOIN public.trips t
    ON t.id = r.trip_id
   AND t.is_shared = TRUE
   AND t.share_token = p_share_token
  WHERE r.share_token = p_share_token
  GROUP BY r.stop_key, r.reaction;
$$;

REVOKE ALL ON FUNCTION public.get_shared_trip_reaction_counts(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_trip_reaction_counts(TEXT)
  TO service_role;

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
  locked_id TEXT;
  orig_path TEXT[];
  next_path TEXT[];
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

  IF p_expected_updated_at IS NULL THEN
    RETURN '{"state":"conflict"}'::JSONB;
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

  IF t.updated_at IS DISTINCT FROM p_expected_updated_at
     OR t.plan_revision_id IS DISTINCT FROM p_expected_plan_revision THEN
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
    SET days = stamped_next,
        overview = restored_overview,
        total_cost = NULL
    WHERE id = itinerary_id;

    UPDATE public.trips
    SET plan_revision_id = next_id,
        is_shared = FALSE,
        share_token = NULL,
        shared_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = p_trip_id
    RETURNING updated_at INTO next_version;

    DELETE FROM public.shared_trip_reactions WHERE trip_id = p_trip_id;

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

  stamped_next := public.stamp_plan_items(p_trip_id, p_days);

  -- Enforce that all locked items present in the current plan remain unchanged
  -- in their day and slot (neighbors in the same slot may be trimmed).
  IF array_length(locks, 1) IS NOT NULL THEN
    FOREACH locked_id IN ARRAY locks LOOP
      orig_path := public.plan_item_path(original, locked_id);
      IF orig_path IS NOT NULL THEN
        next_path := public.plan_item_path(stamped_next, locked_id);
        IF next_path IS NULL
           OR next_path[1] IS DISTINCT FROM orig_path[1]
           OR next_path[2] IS DISTINCT FROM orig_path[2]
           OR (stamped_next #> next_path) IS DISTINCT FROM (original #> orig_path) THEN
          RETURN '{"state":"conflict"}'::JSONB;
        END IF;
      END IF;
    END LOOP;
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

  PERFORM set_config('faroway.plan_write', p_trip_id::TEXT, TRUE);
  UPDATE public.itineraries
  SET days = stamped_next,
      overview = '',
      total_cost = NULL
  WHERE id = itinerary_id;

  UPDATE public.trips
  SET plan_revision_id = next_id,
      is_shared = FALSE,
      share_token = NULL,
      shared_at = NULL,
      updated_at = clock_timestamp()
  WHERE id = p_trip_id
  RETURNING updated_at INTO next_version;

  DELETE FROM public.shared_trip_reactions WHERE trip_id = p_trip_id;

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

REVOKE ALL ON FUNCTION public.apply_trip_copilot_edit(UUID, UUID, TEXT, TIMESTAMPTZ, UUID, JSONB, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_trip_copilot_edit(UUID, UUID, TEXT, TIMESTAMPTZ, UUID, JSONB, JSONB, UUID)
  TO service_role;

-- ============================================================================
-- 5. Harden trip_feedback UPDATE RLS to enforce trip ownership
-- ============================================================================
DROP POLICY IF EXISTS "Users can update own trip feedback" ON public.trip_feedback;
CREATE POLICY "Users can update own trip feedback"
  ON public.trip_feedback
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.trips
      WHERE public.trips.id = trip_feedback.trip_id
        AND public.trips.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- 6. Lock down direct public INSERT on newsletter_subscribers & blog_post_views
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Service role can insert subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Service role can insert subscribers"
  ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');
REVOKE INSERT ON public.newsletter_subscribers FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.newsletter_subscribers TO service_role;

DROP POLICY IF EXISTS "Anyone can log a view" ON public.blog_post_views;
DROP POLICY IF EXISTS "Service role can insert views" ON public.blog_post_views;
CREATE POLICY "Service role can insert views"
  ON public.blog_post_views
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');
REVOKE INSERT ON public.blog_post_views FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.blog_post_views TO service_role;

-- ============================================================================
-- 7. Reconcile orphaned public.users rows and enforce auth.users CASCADE FK
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_constraint c
       WHERE c.conrelid = 'public.users'::regclass
         AND c.confrelid = 'auth.users'::regclass
         AND c.contype = 'f'
     ) THEN
    DELETE FROM public.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.users au WHERE au.id = u.id
    );

    ALTER TABLE public.users
      ADD CONSTRAINT users_id_auth_users_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
