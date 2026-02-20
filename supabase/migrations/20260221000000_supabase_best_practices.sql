-- =============================================================================
-- Migration: Supabase Best Practices Audit & Optimization
-- Date: 2026-02-21
--
-- 1A. RLS: Wrap auth.uid() / auth.role() in (SELECT ...) for plan-time caching
-- 1B. Add missing FK indexes
-- 1C. Replace deprecated uuid_generate_v4() with gen_random_uuid()
-- 1D. Add optimized partial / composite indexes
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1A. Fix RLS Policies — wrap auth.uid() in (SELECT auth.uid())
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── users ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

-- ─── trips ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own trips" ON trips;
CREATE POLICY "Users can view own trips" ON trips
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own trips" ON trips;
CREATE POLICY "Users can create own trips" ON trips
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own trips" ON trips;
CREATE POLICY "Users can update own trips" ON trips
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own trips" ON trips;
CREATE POLICY "Users can delete own trips" ON trips
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ─── itineraries ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own itineraries" ON itineraries;
CREATE POLICY "Users can view own itineraries" ON itineraries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = itineraries.trip_id
        AND trips.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own itineraries" ON itineraries;
CREATE POLICY "Users can create own itineraries" ON itineraries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = itineraries.trip_id
        AND trips.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own itineraries" ON itineraries;
CREATE POLICY "Users can update own itineraries" ON itineraries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = itineraries.trip_id
        AND trips.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own itineraries" ON itineraries;
CREATE POLICY "Users can delete own itineraries" ON itineraries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = itineraries.trip_id
        AND trips.user_id = (SELECT auth.uid())
    )
  );

-- ─── saved_activities ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own saved activities" ON saved_activities;
CREATE POLICY "Users can view own saved activities" ON saved_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = saved_activities.trip_id
        AND trips.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own saved activities" ON saved_activities;
CREATE POLICY "Users can create own saved activities" ON saved_activities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = saved_activities.trip_id
        AND trips.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own saved activities" ON saved_activities;
CREATE POLICY "Users can update own saved activities" ON saved_activities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = saved_activities.trip_id
        AND trips.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own saved activities" ON saved_activities;
CREATE POLICY "Users can delete own saved activities" ON saved_activities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trips WHERE trips.id = saved_activities.trip_id
        AND trips.user_id = (SELECT auth.uid())
    )
  );

-- ─── searches ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own searches" ON searches;
CREATE POLICY "Users can view own searches" ON searches
  FOR SELECT USING ((SELECT auth.uid()) = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own searches" ON searches;
CREATE POLICY "Users can update own searches" ON searches
  FOR UPDATE USING ((SELECT auth.uid()) = user_id OR user_id IS NULL);

-- ─── search_results ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view search results" ON search_results;
CREATE POLICY "Users can view search results" ON search_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM searches WHERE searches.id = search_results.search_id
        AND (searches.user_id = (SELECT auth.uid()) OR searches.user_id IS NULL)
    )
  );

-- ─── search_itineraries ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view search itineraries" ON search_itineraries;
CREATE POLICY "Users can view search itineraries" ON search_itineraries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM searches WHERE searches.id = search_itineraries.search_id
        AND (searches.user_id = (SELECT auth.uid()) OR searches.user_id IS NULL)
    )
  );

-- ─── workflow_runs ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own workflow runs" ON workflow_runs;
CREATE POLICY "Users can view own workflow runs" ON workflow_runs
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage workflow runs" ON workflow_runs;
CREATE POLICY "Service role can manage workflow runs" ON workflow_runs
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ─── workflow_progress ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own workflow progress" ON workflow_progress;
CREATE POLICY "Users can view own workflow progress" ON workflow_progress
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage workflow progress" ON workflow_progress;
CREATE POLICY "Service role can manage workflow progress" ON workflow_progress
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ─── notifications ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can create notifications" ON notifications;
CREATE POLICY "Service role can create notifications" ON notifications
  FOR INSERT WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ─── affiliate_clicks ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own clicks" ON affiliate_clicks;
CREATE POLICY "Users can view own clicks" ON affiliate_clicks
  FOR SELECT USING ((SELECT auth.uid()) = user_id OR user_id IS NULL);

-- ─── affiliate_conversions ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own conversions" ON affiliate_conversions;
CREATE POLICY "Users can view own conversions" ON affiliate_conversions
  FOR SELECT USING ((SELECT auth.uid()) = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Service can insert conversions" ON affiliate_conversions;
CREATE POLICY "Service can insert conversions" ON affiliate_conversions
  FOR INSERT WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ─── push_tokens ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own push tokens" ON push_tokens;
CREATE POLICY "Users can view their own push tokens" ON push_tokens
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own push tokens" ON push_tokens;
CREATE POLICY "Users can insert their own push tokens" ON push_tokens
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own push tokens" ON push_tokens;
CREATE POLICY "Users can update their own push tokens" ON push_tokens
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own push tokens" ON push_tokens;
CREATE POLICY "Users can delete their own push tokens" ON push_tokens
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage all push tokens" ON push_tokens;
CREATE POLICY "Service role can manage all push tokens" ON push_tokens
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1B. Add Missing FK Indexes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_search_id
  ON affiliate_clicks(search_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_trip_id
  ON affiliate_clicks(trip_id);

CREATE INDEX IF NOT EXISTS idx_search_itineraries_hotel_id
  ON search_itineraries(hotel_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1C. Replace uuid_generate_v4() with gen_random_uuid()
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE trips ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE itineraries ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE saved_activities ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE destinations ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1D. Optimized Partial / Composite Indexes
-- ═══════════════════════════════════════════════════════════════════════════════

-- Unread notifications per user (most common notification query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read = FALSE;

-- Active/pending workflow runs
CREATE INDEX IF NOT EXISTS idx_workflow_runs_active
  ON workflow_runs(started_at DESC) WHERE status IN ('pending', 'running');

-- Pending searches
CREATE INDEX IF NOT EXISTS idx_searches_pending
  ON searches(created_at DESC) WHERE status = 'pending';

-- Affiliate conversions by click + status
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_click_status
  ON affiliate_conversions(click_id, status);

COMMIT;
