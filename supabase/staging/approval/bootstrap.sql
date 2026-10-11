-- STAGING APPROVAL BUNDLE ONLY: omovikloadpvzijoaqus
-- Execute only after target identity and explicit SQL approval are verified.
BEGIN;

-- APPROVAL TARGET ONLY: faroway-staging / omovikloadpvzijoaqus / Testimonio.
-- The executing connector/operator MUST independently bind to that project.
-- SQL cannot prove the remote project identity from a caller-supplied setting.
-- Fresh-install guard blocks the populated production application schema.
DO $$ BEGIN
  IF current_setting('server_version_num')::INTEGER <> 170011 THEN
    RAISE EXCEPTION 'This approval bundle was validated only on PostgreSQL 17.11';
  END IF;
  IF to_regclass('public.users') IS NOT NULL OR to_regclass('public.trips') IS NOT NULL
     OR to_regclass('public.blog_posts') IS NOT NULL OR to_regclass('public.destinations') IS NOT NULL THEN
    RAISE EXCEPTION 'Fresh staging schema required; never apply this bundle to an existing application database';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
     OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Supabase platform schemas must already exist';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'Supabase Realtime publication must already exist';
  END IF;
END $$;
SET search_path=public,extensions;
SET lock_timeout='2s';
SET statement_timeout='60s';


-- SOURCE supabase/migrations/20260202_init_schema.sql SHA256 ef283986706e5a4a700576a8f8fe648e8329475ebe9b12b104e0e6a472006979
-- TripGenie Database Schema
-- Initial migration: Create tables and Row Level Security policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    auth_provider TEXT NOT NULL CHECK (auth_provider IN ('google', 'apple', 'email')),
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'premium')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- TRIPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    travelers INTEGER NOT NULL DEFAULT 1 CHECK (travelers > 0),
    budget DECIMAL(10, 2),
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for trips
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_start_date ON trips(start_date);
CREATE INDEX idx_trips_created_at ON trips(created_at);

-- ============================================================================
-- ITINERARIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS itineraries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    days_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ai_model_used TEXT,
    total_cost_estimate DECIMAL(10, 2),
    CONSTRAINT unique_trip_itinerary UNIQUE (trip_id)
);

-- Create index for itineraries
CREATE INDEX idx_itineraries_trip_id ON itineraries(trip_id);
CREATE INDEX idx_itineraries_generated_at ON itineraries(generated_at);

-- ============================================================================
-- SAVED_ACTIVITIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS saved_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    activity_name TEXT NOT NULL,
    description TEXT,
    time_slot TEXT,
    cost DECIMAL(10, 2),
    booking_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for saved_activities
CREATE INDEX idx_saved_activities_trip_id ON saved_activities(trip_id);
CREATE INDEX idx_saved_activities_created_at ON saved_activities(created_at);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

-- Users can read their own data
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Allow user insertion during signup (handled by trigger)
CREATE POLICY "Users can insert own profile"
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- TRIPS POLICIES
-- ============================================================================

-- Users can view their own trips
CREATE POLICY "Users can view own trips"
    ON trips FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own trips
CREATE POLICY "Users can create own trips"
    ON trips FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own trips
CREATE POLICY "Users can update own trips"
    ON trips FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own trips
CREATE POLICY "Users can delete own trips"
    ON trips FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- ITINERARIES POLICIES
-- ============================================================================

-- Users can view itineraries for their trips
CREATE POLICY "Users can view own itineraries"
    ON itineraries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM trips
            WHERE trips.id = itineraries.trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- Users can create itineraries for their trips
CREATE POLICY "Users can create own itineraries"
    ON itineraries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM trips
            WHERE trips.id = trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- Users can update itineraries for their trips
CREATE POLICY "Users can update own itineraries"
    ON itineraries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM trips
            WHERE trips.id = itineraries.trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- Users can delete itineraries for their trips
CREATE POLICY "Users can delete own itineraries"
    ON itineraries FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM trips
            WHERE trips.id = itineraries.trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- ============================================================================
-- SAVED_ACTIVITIES POLICIES
-- ============================================================================

-- Users can view saved activities for their trips
CREATE POLICY "Users can view own saved activities"
    ON saved_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM trips
            WHERE trips.id = saved_activities.trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- Users can create saved activities for their trips
CREATE POLICY "Users can create own saved activities"
    ON saved_activities FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM trips
            WHERE trips.id = trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- Users can update saved activities for their trips
CREATE POLICY "Users can update own saved activities"
    ON saved_activities FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM trips
            WHERE trips.id = saved_activities.trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- Users can delete saved activities for their trips
CREATE POLICY "Users can delete own saved activities"
    ON saved_activities FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM trips
            WHERE trips.id = saved_activities.trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- ============================================================================
-- AUTH TRIGGER TO CREATE USER PROFILE
-- ============================================================================

-- Function to create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, auth_provider)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- SOURCE supabase/migrations/20260203_01_search_schema.sql SHA256 23ddb6e6321a3dd85112fd182f01b5616864b0862cd414ddb3ea71fcf81c17f6
-- TripGenie Search Schema
-- Supports the multi-agent travel search system

-- Search sessions table
CREATE TABLE IF NOT EXISTS searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Search parameters
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  travelers INTEGER DEFAULT 2,
  traveler_type TEXT CHECK (traveler_type IN ('solo', 'couple', 'family', 'friends', 'business')),
  vibes TEXT[] DEFAULT '{}',
  budget TEXT DEFAULT 'moderate' CHECK (budget IN ('budget', 'moderate', 'luxury')),

  -- Workflow tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'completed', 'error')),
  workflow_run_id TEXT,
  progress JSONB DEFAULT '{
    "orchestrator": "pending",
    "hotels": "pending",
    "activities": "pending",
    "dining": "pending",
    "aggregator": "pending"
  }'::jsonb,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Search results table (stores individual results from agents)
CREATE TABLE IF NOT EXISTS search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,

  -- Result categorization
  category TEXT NOT NULL CHECK (category IN ('hotel', 'activity', 'dining', 'transport')),

  -- Result data
  name TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL DEFAULT '{}',

  -- Affiliate info
  affiliate_url TEXT,
  affiliate_partner TEXT,
  price_amount DECIMAL(10, 2),
  price_currency TEXT DEFAULT 'USD',

  -- Ranking
  vibe_score FLOAT DEFAULT 0,
  rating FLOAT,
  rank INTEGER,

  -- Location
  location_name TEXT,
  location_address TEXT,
  location_lat FLOAT,
  location_lng FLOAT,

  -- Media
  image_url TEXT,
  images JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suggested itineraries (aggregated results organized by day)
CREATE TABLE IF NOT EXISTS search_itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,

  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  title TEXT,
  summary TEXT,

  -- References to search_results
  morning_activities UUID[] DEFAULT '{}',
  afternoon_activities UUID[] DEFAULT '{}',
  evening_activities UUID[] DEFAULT '{}',
  meals UUID[] DEFAULT '{}',
  hotel_id UUID REFERENCES search_results(id),

  -- Daily cost estimate
  estimated_cost DECIMAL(10, 2),
  cost_currency TEXT DEFAULT 'USD',

  tips TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
CREATE INDEX IF NOT EXISTS idx_searches_status ON searches(status);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_results_search_id ON search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_search_results_category ON search_results(category);
CREATE INDEX IF NOT EXISTS idx_search_itineraries_search_id ON search_itineraries(search_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_searches_updated_at
  BEFORE UPDATE ON searches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_itineraries ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own searches (or anonymous searches they created)
CREATE POLICY "Users can view own searches" ON searches
  FOR SELECT USING (
    auth.uid() = user_id OR
    user_id IS NULL -- Allow anonymous searches
  );

CREATE POLICY "Users can create searches" ON searches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own searches" ON searches
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Results inherit from search permissions
CREATE POLICY "Users can view search results" ON search_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM searches
      WHERE searches.id = search_results.search_id
      AND (searches.user_id = auth.uid() OR searches.user_id IS NULL)
    )
  );

CREATE POLICY "Service can insert results" ON search_results
  FOR INSERT WITH CHECK (true);

-- Itineraries inherit from search permissions
CREATE POLICY "Users can view search itineraries" ON search_itineraries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM searches
      WHERE searches.id = search_itineraries.search_id
      AND (searches.user_id = auth.uid() OR searches.user_id IS NULL)
    )
  );

CREATE POLICY "Service can insert itineraries" ON search_itineraries
  FOR INSERT WITH CHECK (true);

-- Enable realtime for mobile subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE searches;
ALTER PUBLICATION supabase_realtime ADD TABLE search_results;

COMMENT ON TABLE searches IS 'Travel search sessions with workflow tracking';
COMMENT ON TABLE search_results IS 'Individual search results from affiliate agents';
COMMENT ON TABLE search_itineraries IS 'AI-generated suggested itineraries from search results';


-- SOURCE supabase/migrations/20260204_workflow_tables.sql SHA256 7e29aa31d8574d316fb27556b87dd0328a3f7b9cb8a23a281c8b38ec006cd9db
-- TripGenie Workflow Tables Migration
-- Adds support for Vercel Workflows async itinerary generation

-- ============================================================================
-- UPDATE TRIPS TABLE
-- ============================================================================

-- Add status column to trips
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
CHECK (status IN ('draft', 'generating', 'generated', 'failed'));

-- Add vibes column for trip preferences
ALTER TABLE trips ADD COLUMN IF NOT EXISTS vibes TEXT[] DEFAULT '{}';

-- Add interests column
ALTER TABLE trips ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- Add dietary restrictions
ALTER TABLE trips ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}';

-- Add mobility needs
ALTER TABLE trips ADD COLUMN IF NOT EXISTS mobility_needs TEXT;

-- Add itinerary reference
ALTER TABLE trips ADD COLUMN IF NOT EXISTS itinerary_id UUID;

-- Store travelers as JSONB for flexibility
ALTER TABLE trips ADD COLUMN IF NOT EXISTS travelers_data JSONB DEFAULT '{"adults": 2, "children": 0}'::jsonb;

-- Budget as text enum
ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget_tier TEXT DEFAULT 'moderate'
CHECK (budget_tier IN ('budget', 'moderate', 'luxury'));

-- ============================================================================
-- UPDATE ITINERARIES TABLE
-- ============================================================================

-- Add more columns to itineraries table
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS overview TEXT;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS total_cost JSONB;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS days JSONB DEFAULT '[]'::jsonb;
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS packing_list TEXT[];
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS general_tips TEXT[];
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- WORKFLOW_RUNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY, -- Workflow run ID from Vercel
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for workflow_runs
CREATE INDEX IF NOT EXISTS idx_workflow_runs_trip_id ON workflow_runs(trip_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON workflow_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at);

-- ============================================================================
-- WORKFLOW_PROGRESS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    step TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    message TEXT DEFAULT 'Initializing...',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for workflow_progress
CREATE INDEX IF NOT EXISTS idx_workflow_progress_trip_id ON workflow_progress(trip_id);
CREATE INDEX IF NOT EXISTS idx_workflow_progress_user_id ON workflow_progress(user_id);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ============================================================================
-- REALTIME_EVENTS TABLE (for Supabase Realtime broadcasts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS realtime_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel TEXT NOT NULL,
    event TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-delete old realtime events (they're ephemeral)
CREATE INDEX IF NOT EXISTS idx_realtime_events_created_at ON realtime_events(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

-- Enable RLS
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

-- Workflow Runs Policies
CREATE POLICY "Users can view own workflow runs"
    ON workflow_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage workflow runs"
    ON workflow_runs FOR ALL
    USING (auth.role() = 'service_role');

-- Workflow Progress Policies
CREATE POLICY "Users can view own workflow progress"
    ON workflow_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage workflow progress"
    ON workflow_progress FOR ALL
    USING (auth.role() = 'service_role');

-- Notifications Policies
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Realtime Events Policies (service role only)
CREATE POLICY "Service role can manage realtime events"
    ON realtime_events FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- CLEANUP FUNCTION FOR OLD WORKFLOW DATA
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_workflow_data()
RETURNS void AS $$
BEGIN
    -- Delete workflow runs older than 30 days
    DELETE FROM workflow_runs
    WHERE completed_at < NOW() - INTERVAL '30 days';

    -- Delete realtime events older than 1 hour
    DELETE FROM realtime_events
    WHERE created_at < NOW() - INTERVAL '1 hour';

    -- Delete read notifications older than 90 days
    DELETE FROM notifications
    WHERE read = TRUE AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;


-- SOURCE supabase/migrations/20260205_performance_indexes.sql SHA256 8948e86c6e471b2ba3ba133576d1d6bcf729f0ffafac973cdbe23665cb47be8a
-- Performance Indexes for TripGenie
-- Created: 2026-02-03
-- Purpose: Optimize common query patterns

-- Index for fetching user's trips (most common query)
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);

-- Index for sorting trips by start date (used in dashboard)
CREATE INDEX IF NOT EXISTS idx_trips_start_date_desc ON trips(start_date DESC);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- Composite index for user's trips sorted by date (covers dashboard query)
CREATE INDEX IF NOT EXISTS idx_trips_user_start_date ON trips(user_id, start_date DESC);

-- Index for searching itineraries (if text search is needed later)
-- CREATE INDEX IF NOT EXISTS idx_trips_destination_gin ON trips USING gin(to_tsvector('english', destination));

-- Index for created_at sorting (recent trips)
CREATE INDEX IF NOT EXISTS idx_trips_created_at_desc ON trips(created_at DESC);

-- Comments for documentation
COMMENT ON INDEX idx_trips_user_id IS 'Speeds up queries filtering by user_id';
COMMENT ON INDEX idx_trips_start_date_desc IS 'Speeds up queries sorting by start_date';
COMMENT ON INDEX idx_trips_status IS 'Speeds up queries filtering by trip status';
COMMENT ON INDEX idx_trips_user_start_date IS 'Composite index for dashboard: user trips sorted by date';
COMMENT ON INDEX idx_trips_created_at_desc IS 'Speeds up queries sorting by creation time';


-- SOURCE supabase/migrations/20260206_affiliate_tracking.sql SHA256 08e128d4eb29662028679b9bd9f491d962307b31852e199b256fe0e4da47aec3
-- Affiliate Click & Conversion Tracking
-- Track user interactions with affiliate links for revenue analysis

-- Affiliate clicks table
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Item info
  item_type TEXT NOT NULL CHECK (item_type IN ('hotel', 'activity', 'restaurant', 'flight')),
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,

  -- Affiliate info
  affiliate_partner TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,

  -- Context
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,

  -- Pricing at time of click
  price DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',

  -- Source tracking
  source TEXT DEFAULT 'search_results',

  -- Conversion tracking
  converted BOOLEAN DEFAULT FALSE,
  conversion_value DECIMAL(10, 2),

  -- Timestamps
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliate conversions table (populated by webhooks from partners)
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id TEXT REFERENCES affiliate_clicks(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Partner info
  partner TEXT NOT NULL,
  order_id TEXT,
  booking_reference TEXT,

  -- Financial
  booking_value DECIMAL(10, 2) NOT NULL,
  commission_value DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Status
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),

  -- Timestamps
  conversion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_user_id ON affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_partner ON affiliate_clicks(affiliate_partner);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_clicked_at ON affiliate_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_converted ON affiliate_clicks(converted) WHERE converted = TRUE;

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_click_id ON affiliate_conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_partner ON affiliate_conversions(partner);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_user_id ON affiliate_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_date ON affiliate_conversions(conversion_date DESC);

-- RLS Policies
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;

-- Users can view their own clicks
CREATE POLICY "Users can view own clicks" ON affiliate_clicks
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Anyone can insert clicks (tracking works for anonymous users)
CREATE POLICY "Anyone can insert clicks" ON affiliate_clicks
  FOR INSERT WITH CHECK (true);

-- Users can view their own conversions
CREATE POLICY "Users can view own conversions" ON affiliate_conversions
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Only service role can insert conversions (webhooks)
CREATE POLICY "Service can insert conversions" ON affiliate_conversions
  FOR INSERT WITH CHECK (true);

-- Analytics view for dashboard
CREATE OR REPLACE VIEW affiliate_stats AS
SELECT
  DATE_TRUNC('day', c.clicked_at) as date,
  c.affiliate_partner as partner,
  c.item_type,
  COUNT(*) as clicks,
  COUNT(*) FILTER (WHERE c.converted) as conversions,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.converted) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
  SUM(c.conversion_value) FILTER (WHERE c.converted) as revenue
FROM affiliate_clicks c
GROUP BY DATE_TRUNC('day', c.clicked_at), c.affiliate_partner, c.item_type
ORDER BY date DESC;

COMMENT ON TABLE affiliate_clicks IS 'Track user clicks on affiliate links';
COMMENT ON TABLE affiliate_conversions IS 'Track confirmed bookings from affiliate partners';


-- SOURCE supabase/migrations/20260217000000_fix_rls_policies.sql SHA256 3fa1e00ce520eccf46c43f55cf9cd28f4e01bba1d62cf1b85c740789817a2cab
-- Fix overly permissive INSERT RLS policies
-- These policies used WITH CHECK (true) which allows ANY user to insert,
-- but they should be restricted to service_role only.

-- search_results: Only service role can insert
DROP POLICY IF EXISTS "Service can insert results" ON search_results;
CREATE POLICY "Service can insert results" ON search_results
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- search_itineraries: Only service role can insert
DROP POLICY IF EXISTS "Service can insert itineraries" ON search_itineraries;
CREATE POLICY "Service can insert itineraries" ON search_itineraries
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- affiliate_conversions: Only service role can insert (webhooks)
DROP POLICY IF EXISTS "Service can insert conversions" ON affiliate_conversions;
CREATE POLICY "Service can insert conversions" ON affiliate_conversions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- affiliate_clicks: Keep open insert for anonymous tracking (required for functionality)
-- Rate limiting is enforced at the API layer (10 req/min per IP)


-- SOURCE supabase/migrations/20260217100000_json_render_spec.sql SHA256 68b532f8bb75fd4c276612f258bf8394bc78c6995b04689813f9680c62121f62
-- Add json_render_spec column to store the complete json-render UI spec
-- that the mobile app renders directly after itinerary generation completes.
ALTER TABLE searches ADD COLUMN IF NOT EXISTS json_render_spec JSONB;


-- SOURCE supabase/migrations/20260217200000_user_preferences.sql SHA256 5850a0b67df36ffeb38003fe9f7de1fa933772c6ecee3a8c659be7c0d4ec980a
-- Add user preference and profile columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"trip_reminders":true,"deals":true,"itinerary_updates":true,"app_updates":false}';


-- SOURCE supabase/migrations/20260218_blog_tables.sql SHA256 46049c73a88afcb8419fa5021d745fefe4f4afab50365e420b047d3e205bdc43
-- Blog Tables Migration
-- Newsletter subscribers, view tracking, and post metadata

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'blog' CHECK (source IN ('blog', 'footer', 'popup', 'landing')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Blog post views (privacy-safe with IP hashing)
CREATE TABLE IF NOT EXISTS blog_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug TEXT NOT NULL,
  viewer_ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blog posts metadata mirror (for view counts + future CMS)
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content_source TEXT NOT NULL DEFAULT 'mdx' CHECK (content_source IN ('mdx', 'database')),
  author_slug TEXT,
  category TEXT,
  cover_image TEXT,
  reading_time INTEGER,
  featured BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_post_views_slug ON blog_post_views (post_slug);
CREATE INDEX IF NOT EXISTS idx_blog_post_views_viewed_at ON blog_post_views (viewed_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers (email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON newsletter_subscribers (status);

-- RLS Policies
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Newsletter: anyone can INSERT (subscribe), service role can SELECT/UPDATE
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can read subscribers" ON newsletter_subscribers
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update subscribers" ON newsletter_subscribers
  FOR UPDATE USING (auth.role() = 'service_role');

-- Blog post views: anyone can INSERT, service role can SELECT
CREATE POLICY "Anyone can log a view" ON blog_post_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can read views" ON blog_post_views
  FOR SELECT USING (auth.role() = 'service_role');

-- Blog posts: public SELECT where published, service role full access
CREATE POLICY "Public can read published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Service role full access to posts" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');

-- Helper function: atomically increment view count
CREATE OR REPLACE FUNCTION increment_blog_view_count(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE blog_posts
  SET view_count = view_count + 1
  WHERE slug = p_slug;
END;
$$;


-- SOURCE supabase/migrations/20260219000000_create_images_bucket.sql SHA256 53c31724ecfd17a4f109d107cca175e54512f2e0b1dac198bc62eee7d6614f67
-- ============================================================================
-- MIGRATION: Create public images bucket in Supabase Storage
-- ============================================================================

-- Create the images bucket (public reads, service role writes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (no auth required)
CREATE POLICY "Public read access on images bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

-- Restrict uploads to service role only
CREATE POLICY "Service role upload access on images bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'images'
    AND auth.role() = 'service_role'
  );

-- Restrict updates to service role only
CREATE POLICY "Service role update access on images bucket"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'images'
    AND auth.role() = 'service_role'
  );

-- Restrict deletes to service role only
CREATE POLICY "Service role delete access on images bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'images'
    AND auth.role() = 'service_role'
  );


-- SOURCE supabase/migrations/20260219100000_destinations.sql SHA256 3676851cc2b27213b7de598729f105b4e9ec3277c6d970e9f08ecd026ce8080e
-- ============================================================================
-- DESTINATIONS TABLE & SUPPORTING OBJECTS
-- ============================================================================

-- Normalize destination name: lowercase, trimmed, first part before comma
CREATE OR REPLACE FUNCTION normalize_destination(raw TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(trim(split_part(raw, ',', 1)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- DESTINATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    name_normalized TEXT GENERATED ALWAYS AS (normalize_destination(name)) STORED,
    aliases TEXT[] DEFAULT '{}',
    description TEXT,
    image TEXT,
    tags TEXT[] DEFAULT '{}',
    seasons JSONB DEFAULT '{}'::jsonb,
    currency TEXT,
    language TEXT,
    best_time TEXT,
    base_popularity_score INTEGER NOT NULL DEFAULT 50 CHECK (base_popularity_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_destinations_name_normalized ON destinations (name_normalized);
CREATE INDEX idx_destinations_aliases ON destinations USING GIN (aliases);
CREATE INDEX idx_destinations_tags ON destinations USING GIN (tags);
CREATE INDEX idx_destinations_country ON destinations (country);

-- Apply updated_at trigger
CREATE TRIGGER update_destinations_updated_at
    BEFORE UPDATE ON destinations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RPC: get_destination_trip_counts
-- Groups trips.destination by normalized name, returns counts since a given date
-- ============================================================================
CREATE OR REPLACE FUNCTION get_destination_trip_counts(since TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ)
RETURNS TABLE(destination_normalized TEXT, trip_count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT normalize_destination(t.destination) AS destination_normalized,
           COUNT(*)::BIGINT AS trip_count
    FROM trips t
    WHERE t.created_at >= since
    GROUP BY normalize_destination(t.destination);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- RPC: get_destination_search_counts
-- Groups searches.destination by normalized name, returns counts since a given date
-- ============================================================================
CREATE OR REPLACE FUNCTION get_destination_search_counts(since TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ)
RETURNS TABLE(destination_normalized TEXT, search_count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT normalize_destination(s.destination) AS destination_normalized,
           COUNT(*)::BIGINT AS search_count
    FROM searches s
    WHERE s.created_at >= since
    GROUP BY normalize_destination(s.destination);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required)
CREATE POLICY "Anyone can view destinations"
    ON destinations FOR SELECT
    USING (true);

-- Service role only writes (handled by default — no INSERT/UPDATE/DELETE policies for anon)


-- SOURCE supabase/migrations/20260219200000_trip_sharing.sql SHA256 ad06976f1badf460c688eeedf25d94d0e306cfa084c62d0620ba50cb4708a4c0
-- Add sharing columns to trips table
ALTER TABLE trips
  ADD COLUMN share_token TEXT UNIQUE,
  ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN shared_at TIMESTAMPTZ;

-- Partial index for fast public lookups by share_token where sharing is enabled
CREATE UNIQUE INDEX idx_trips_share_token_active
  ON trips (share_token)
  WHERE share_token IS NOT NULL;


-- SOURCE supabase/migrations/20260220000000_blog_content_columns.sql SHA256 1821322c0ed23c23d87ad15b58d78a04645a362f31f73e0521e7efac0e00b660
-- Add content and metadata columns to blog_posts for full database-driven blog
-- Previously blog_posts was a metadata-only mirror; now it becomes the source of truth.

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cluster TEXT;

-- Listing index: covers all metadata queries without hitting the heap (skips large content column)
CREATE INDEX IF NOT EXISTS idx_blog_posts_listing
  ON blog_posts (status, published_at DESC)
  INCLUDE (slug, title, description, author_slug, category, cover_image, cover_image_alt, reading_time, featured, tags, cluster, last_updated, view_count);

-- Category filter
CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON blog_posts (category)
  WHERE status = 'published';

-- Featured post lookup
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured
  ON blog_posts (featured)
  WHERE featured = true AND status = 'published';

-- Tags GIN index for related-posts and cluster matching
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags
  ON blog_posts USING GIN (tags)
  WHERE status = 'published';

-- Cluster filter
CREATE INDEX IF NOT EXISTS idx_blog_posts_cluster
  ON blog_posts (cluster)
  WHERE status = 'published' AND cluster IS NOT NULL;


-- SOURCE supabase/migrations/20260220100000_push_tokens.sql SHA256 4445b6fa92a5906c0c84f0242b8d0a21e4c87056f13bfaa86f46a9dd028f8869
-- ============================================
-- Push Tokens Table for TripGenie
-- ============================================
-- This table stores Expo Push Tokens for each user
-- to enable sending push notifications.

-- Create the push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Composite unique constraint: one token per user (a user might have multiple devices)
  UNIQUE(user_id, token)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view/manage their own push tokens
CREATE POLICY "Users can view their own push tokens"
  ON push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
  ON push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
  ON push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
  ON push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all tokens (for server-side operations)
CREATE POLICY "Service role can manage all push tokens"
  ON push_tokens
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER trigger_update_push_token_timestamp
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_token_timestamp();

-- ============================================
-- Helper Functions for Push Notifications
-- ============================================

-- Function to get active push tokens for a user
CREATE OR REPLACE FUNCTION get_user_push_tokens(target_user_id UUID)
RETURNS TABLE (token TEXT, platform TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.token, pt.platform
  FROM push_tokens pt
  WHERE pt.user_id = target_user_id
    AND pt.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate a push token (e.g., when it becomes invalid)
CREATE OR REPLACE FUNCTION deactivate_push_token(target_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE push_tokens
  SET is_active = false, updated_at = NOW()
  WHERE token = target_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Notification Types Reference
-- ============================================
-- The following notification types are supported:
--
-- 1. trip_generation_complete
--    - Sent when AI finishes generating a trip itinerary
--    - Data: { type: 'trip_generation_complete', tripId: string }
--
-- 2. trip_reminder
--    - Sent 1 day before a trip starts
--    - Data: { type: 'trip_reminder', tripId: string, title: string }
--
-- 3. activity_recommendation
--    - Sent when new activities are recommended
--    - Data: { type: 'activity_recommendation', tripId?: string }


-- SOURCE supabase/migrations/20260220250000_add_search_id_to_trips.sql SHA256 3b45176ee9e9fcaba3c5830f74d6f5aae474916317d08c4492441256da7c7a8b
-- Add search_id to trips table to link trips to their search/workflow records
ALTER TABLE trips ADD COLUMN IF NOT EXISTS search_id UUID REFERENCES searches(id) ON DELETE SET NULL;

-- Index for looking up trips by search_id
CREATE INDEX IF NOT EXISTS idx_trips_search_id ON trips(search_id);


-- SOURCE supabase/migrations/20260221000000_supabase_best_practices.sql SHA256 5ffa4399ebb8f43cc09fb513c1578a48bb807c83ee5ed80ef494ccb988fc3aba
-- =============================================================================
-- Migration: Supabase Best Practices Audit & Optimization
-- Date: 2026-02-21
--
-- 1A. RLS: Wrap auth.uid() / auth.role() in (SELECT ...) for plan-time caching
-- 1B. Add missing FK indexes
-- 1C. Replace deprecated uuid_generate_v4() with gen_random_uuid()
-- 1D. Add optimized partial / composite indexes
-- =============================================================================


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



-- SOURCE supabase/migrations/20260221100000_trips_nullable_user_id.sql SHA256 ac654a55636ddbf632fa6baff8c7a21be46e6c8c31bd6314ff3fa35f1cd92edf
-- Allow anonymous trip creation by making user_id nullable.
-- The FK constraint still references users(id) but Postgres allows NULL in FK columns.
-- RLS policies (auth.uid() = user_id) only apply to authenticated queries;
-- anonymous trips are accessed via service role client which bypasses RLS.

ALTER TABLE trips ALTER COLUMN user_id DROP NOT NULL;


-- SOURCE supabase/migrations/20260222000000_anonymous_trip_ttl.sql SHA256 280dedefcad3cd1cb6f8a402766c028c6c9888668aba3c8d3dc260dd8efdb9a1
-- Add expires_at column for anonymous trip TTL
-- Authenticated trips have NULL (no expiration), anonymous trips get NOW() + 7 days
ALTER TABLE trips ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Partial index for fast cleanup queries on anonymous expiring trips
CREATE INDEX IF NOT EXISTS idx_trips_anonymous_expires
  ON trips (expires_at)
  WHERE expires_at IS NOT NULL AND user_id IS NULL;

-- Function to clean up expired anonymous trips
CREATE OR REPLACE FUNCTION cleanup_expired_anonymous_trips()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired anonymous trips (cascades to itineraries, workflow_progress, workflow_runs via FK)
  DELETE FROM trips
  WHERE user_id IS NULL
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Delete orphaned anonymous searches (no trip references them, older than 7 days)
  DELETE FROM searches
  WHERE user_id IS NULL
    AND created_at < NOW() - INTERVAL '7 days'
    AND id NOT IN (SELECT search_id FROM trips WHERE search_id IS NOT NULL);

  RETURN deleted_count;
END;
$$;


-- SOURCE supabase/migrations/20260223000000_add_intermediate_results.sql SHA256 2f64f95359cc8ae7fe34f723a245be89b288431fca8281c921f9970b4ba2874d
-- Column for streaming intermediate agent results to the web SSE endpoint
ALTER TABLE searches ADD COLUMN IF NOT EXISTS intermediate_results JSONB DEFAULT '{}'::jsonb;

-- Atomic merge function (avoids race conditions when parallel agents finish simultaneously)
CREATE OR REPLACE FUNCTION public.merge_intermediate_results(
  p_search_id UUID, p_key TEXT, p_value JSONB
) RETURNS void AS $$
BEGIN
  UPDATE public.searches
  SET intermediate_results = COALESCE(intermediate_results, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
  WHERE id = p_search_id;
END;
$$ LANGUAGE plpgsql
SET search_path = pg_catalog;

REVOKE ALL ON FUNCTION public.merge_intermediate_results(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_intermediate_results(UUID, TEXT, JSONB)
  TO service_role;


-- SOURCE supabase/migrations/20260302000000_transport_and_enrichment.sql SHA256 8f4c54ef5b7d1bce6e92520020f7c3fb2122174417ca106e6a4f971f4b2784a1
-- Transport and TripAdvisor enrichment support
-- Adds TripAdvisor enrichment columns to search_results,
-- transport reference to search_itineraries,
-- and updates searches progress default to include transport.

-- 1. TripAdvisor enrichment columns on search_results
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS tripadvisor_rating FLOAT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS tripadvisor_review_count INTEGER;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS tripadvisor_url TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS tripadvisor_ranking TEXT;

-- 2. Transport reference on search_itineraries
ALTER TABLE search_itineraries ADD COLUMN IF NOT EXISTS transport_id UUID REFERENCES search_results(id);

-- 3. Update searches progress default to include transport
ALTER TABLE searches ALTER COLUMN progress SET DEFAULT '{
  "orchestrator": "pending",
  "hotels": "pending",
  "activities": "pending",
  "dining": "pending",
  "transport": "pending",
  "aggregator": "pending"
}'::jsonb;

-- 4. Index for transport results lookups
CREATE INDEX IF NOT EXISTS idx_search_results_transport
  ON search_results(search_id)
  WHERE category = 'transport';


-- SOURCE supabase/migrations/20260303000000_trip_lifecycle_statuses.sql SHA256 e065b0e60b73ed0aae2bb597c3c81dc007df56121bc20f61edb215d0694965e7
-- Widen trip lifecycle statuses for partner-derived booking/payment state.
-- Financial truth remains in affiliate_conversions; trips.status is a summary
-- state for product UX and filtering.

ALTER TABLE trips ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;

UPDATE trips SET status = 'canceled' WHERE status = 'cancelled';

ALTER TABLE trips
ADD CONSTRAINT trips_status_check
CHECK (
  status IN (
    'draft',
    'planning',
    'planned',
    'generating',
    'generated',
    'failed',
    'active',
    'in_progress',
    'booked',
    'paid',
    'completed',
    'canceled'
  )
);


-- SOURCE supabase/migrations/20260512000000_canonical_canceled_trip_status.sql SHA256 08bad974d0abc4d8b9106be0dc15c9a3a491a6dda197b3e938fbd8e4a9ba5f99
-- Canonicalize trip lifecycle cancellation spelling to "canceled". Affiliate
-- conversion statuses continue to use their existing provider-facing values.

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;

UPDATE trips SET status = 'canceled' WHERE status = 'cancelled';

ALTER TABLE trips
ADD CONSTRAINT trips_status_check
CHECK (
  status IN (
    'draft',
    'planning',
    'planned',
    'generating',
    'generated',
    'failed',
    'active',
    'in_progress',
    'booked',
    'paid',
    'completed',
    'canceled'
  )
);


-- SOURCE supabase/migrations/20260512001000_affiliate_transport_clicks.sql SHA256 4f6ac5b90d3f58efb0e72f5bb6e59c924c8a93381853571bc700db4735115be9
-- Allow transport partner clicks so flight/ground transport recommendations can
-- be tracked through /api/track/click.

ALTER TABLE affiliate_clicks
DROP CONSTRAINT IF EXISTS affiliate_clicks_item_type_check;

ALTER TABLE affiliate_clicks
ADD CONSTRAINT affiliate_clicks_item_type_check
CHECK (item_type IN ('hotel', 'activity', 'restaurant', 'flight', 'transport'));


-- SOURCE supabase/migrations/20260512002000_canonical_planned_trip_status.sql SHA256 e277d01935684254907a51486c37780860325dbfcf69460b4575380fec07bdd1
-- Canonicalize itinerary-ready trips to "planned". Older app versions used
-- "generated" for the same lifecycle state; read paths still tolerate that
-- legacy value, but new production data should use "planned".

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;

UPDATE trips SET status = 'planned' WHERE status = 'generated';
UPDATE trips SET status = 'canceled' WHERE status = 'cancelled';

ALTER TABLE trips
ADD CONSTRAINT trips_status_check
CHECK (
  status IN (
    'draft',
    'planning',
    'planned',
    -- Retained for zero-downtime deploys and old clients; current code emits
    -- "planned" and read paths normalize this legacy value.
    'generated',
    'generating',
    'failed',
    'active',
    'in_progress',
    'booked',
    'paid',
    'completed',
    'canceled'
  )
);


-- SOURCE supabase/migrations/20260512003000_claim_anonymous_trips_rpc.sql SHA256 62e2ac0479144631e00078833911e9493fbbdacc47930e07593ecd7bd22044cf
-- Claim anonymous trips and their linked searches atomically.
CREATE OR REPLACE FUNCTION public.claim_anonymous_trips(
  p_user_id UUID,
  p_trip_ids UUID[]
)
RETURNS TABLE(id UUID, search_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.trips
    SET
      user_id = p_user_id,
      expires_at = NULL,
      updated_at = NOW()
    WHERE public.trips.user_id IS NULL
      AND public.trips.id = ANY(p_trip_ids)
    RETURNING public.trips.id, public.trips.search_id
  ),
  linked_searches AS (
    UPDATE public.searches
    SET
      user_id = p_user_id,
      updated_at = NOW()
    WHERE public.searches.user_id IS NULL
      AND public.searches.id IN (
        SELECT claimed.search_id
        FROM claimed
        WHERE claimed.search_id IS NOT NULL
    )
    RETURNING public.searches.id
  )
  SELECT claimed.id, claimed.search_id
  FROM claimed;

  IF to_regclass('public.affiliate_clicks') IS NOT NULL THEN
    UPDATE public.affiliate_clicks
    SET user_id = p_user_id
    WHERE public.affiliate_clicks.user_id IS NULL
      AND public.affiliate_clicks.trip_id = ANY(p_trip_ids)
      AND EXISTS (
        SELECT 1
        FROM public.trips
        WHERE public.trips.id = public.affiliate_clicks.trip_id
          AND public.trips.user_id = p_user_id
      );
  END IF;

  IF to_regclass('public.affiliate_conversions') IS NOT NULL
     AND to_regclass('public.affiliate_clicks') IS NOT NULL THEN
    UPDATE public.affiliate_conversions
    SET user_id = p_user_id
    FROM public.affiliate_clicks
    WHERE public.affiliate_conversions.user_id IS NULL
      AND public.affiliate_conversions.click_id = public.affiliate_clicks.id
      AND public.affiliate_clicks.trip_id = ANY(p_trip_ids)
      AND public.affiliate_clicks.user_id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_anonymous_trips(UUID, UUID[]) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.claim_anonymous_trips(UUID, UUID[]) TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.affiliate_clicks') IS NOT NULL THEN
    UPDATE public.affiliate_clicks
    SET user_id = public.trips.user_id
    FROM public.trips
    WHERE public.affiliate_clicks.user_id IS NULL
      AND public.affiliate_clicks.trip_id = public.trips.id
      AND public.trips.user_id IS NOT NULL;
  END IF;

  IF to_regclass('public.affiliate_conversions') IS NOT NULL
     AND to_regclass('public.affiliate_clicks') IS NOT NULL THEN
    UPDATE public.affiliate_conversions
    SET user_id = public.affiliate_clicks.user_id
    FROM public.affiliate_clicks
    WHERE public.affiliate_conversions.user_id IS NULL
      AND public.affiliate_conversions.click_id = public.affiliate_clicks.id
      AND public.affiliate_clicks.user_id IS NOT NULL;
  END IF;
END $$;


-- SOURCE supabase/migrations/20260512004000_push_tokens_release_columns.sql SHA256 d44bb1538269668c8abb467aeba1150c6df4d297d19af7b88005f3d640401edd
-- Align push token schema with the mobile release API.
-- The API records last_seen_at on registration and accepts unknown platform
-- for non-standard React Native runtimes.

ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_push_tokens_last_seen
  ON public.push_tokens(last_seen_at);

ALTER TABLE public.push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_platform_check;

ALTER TABLE public.push_tokens
  ADD CONSTRAINT push_tokens_platform_check
  CHECK (platform IN ('ios', 'android', 'web', 'unknown'));


-- SOURCE supabase/migrations/20260512005000_content_reports.sql SHA256 de30a6157f72ce1eadf2dc23d7cfef4e861896b60a4e948b92d2e14d3b5ec1c8
-- Moderation queue for shared itinerary reports submitted from public report pages.

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL DEFAULT 'shared_trip',
  content_token TEXT NOT NULL,
  content_url TEXT NOT NULL,
  reported_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  reporter_email TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  CONSTRAINT content_reports_content_type_check
    CHECK (content_type IN ('shared_trip')),
  CONSTRAINT content_reports_reason_check
    CHECK (reason IN ('offensive', 'harassment', 'unsafe', 'spam', 'privacy', 'other')),
  CONSTRAINT content_reports_status_check
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON public.content_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_trip
  ON public.content_reports(reported_trip_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_user
  ON public.content_reports(reported_user_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage content reports" ON public.content_reports;
CREATE POLICY "Service role can manage content reports"
  ON public.content_reports
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- SOURCE supabase/migrations/20260515000000_drop_claim_anonymous_trips_rpc.sql SHA256 b9a5a8fa47c7ce746242442d51b7c842e2c0d8741a43c870112cd11ab942970b
-- Drop the claim_anonymous_trips RPC. The anonymous trip flow has been
-- removed end-to-end (auth-gate-generation PR) and the /api/auth/claim-trips
-- route was deleted, so nothing calls this function anymore. We keep
-- cleanup_expired_anonymous_trips for now — pre-existing anonymous trips in
-- production still need to be expired.
DROP FUNCTION IF EXISTS public.claim_anonymous_trips(UUID, UUID[]);


-- SOURCE supabase/migrations/20260725000000_production_rate_limits.sql SHA256 958ba49856c57c4de1797aa5c349b23579f11224c9a32601995a73d9ccf884bd
-- Atomic, shared rate limiting for serverless API routes.
-- Only the service role can consume or inspect buckets.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key TEXT PRIMARY KEY CHECK (char_length(key) = 64),
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limit_buckets TO service_role;

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires_at
  ON public.rate_limit_buckets (expires_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_in_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_key !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid rate-limit key';
  END IF;

  IF p_max_requests < 1 OR p_max_requests > 100000 THEN
    RAISE EXCEPTION 'Invalid rate-limit request maximum';
  END IF;

  IF p_window_ms < 1000 OR p_window_ms > 86400000 THEN
    RAISE EXCEPTION 'Invalid rate-limit window';
  END IF;

  INSERT INTO public.rate_limit_buckets (
    key,
    request_count,
    window_started_at,
    expires_at
  )
  VALUES (
    p_key,
    1,
    v_now,
    v_now + make_interval(secs => p_window_ms / 1000.0)
  )
  ON CONFLICT (key) DO UPDATE
  SET
    request_count = CASE
      WHEN public.rate_limit_buckets.expires_at <= v_now THEN 1
      ELSE public.rate_limit_buckets.request_count + 1
    END,
    window_started_at = CASE
      WHEN public.rate_limit_buckets.expires_at <= v_now THEN v_now
      ELSE public.rate_limit_buckets.window_started_at
    END,
    expires_at = CASE
      WHEN public.rate_limit_buckets.expires_at <= v_now
        THEN v_now + make_interval(secs => p_window_ms / 1000.0)
      ELSE public.rate_limit_buckets.expires_at
    END
  RETURNING request_count, expires_at
  INTO v_count, v_expires_at;

  RETURN QUERY SELECT
    v_count <= p_max_requests,
    GREATEST(0, p_max_requests - v_count),
    GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM (v_expires_at - v_now)) * 1000)::INTEGER
    );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM public.rate_limit_buckets
  WHERE expires_at < clock_timestamp() - INTERVAL '1 day';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limits()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits()
  TO service_role;


-- SOURCE supabase/migrations/20260725001000_affiliate_conversion_idempotency.sql SHA256 ed998de14a7ac2f227e0426b8862ccc43e66b55cb535f92da1715ab0a6453c93
-- Partner webhooks are retried. Give each conversion a stable conflict key so
-- retries update the existing financial record instead of double-counting it.

ALTER TABLE public.affiliate_conversions
  ADD COLUMN IF NOT EXISTS conversion_key TEXT
  GENERATED ALWAYS AS (
    COALESCE(
      NULLIF(order_id, ''),
      NULLIF(booking_reference, ''),
      NULLIF(click_id, '')
    )
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_conversions_partner_key
  ON public.affiliate_conversions(partner, conversion_key);


-- SOURCE supabase/migrations/20260725002000_lock_down_tracking_and_search_rls.sql SHA256 aab3a00c3710c20ca4aed0cb097ae1151446e3e2564b808028172408fa4a706a
-- Anonymous generation was removed from the product. Tighten historical RLS
-- policies that allowed direct anon-key writes and reads outside the API.

DROP POLICY IF EXISTS "Users can create searches" ON public.searches;
CREATE POLICY "Users can create own searches"
  ON public.searches
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own searches" ON public.searches;
CREATE POLICY "Users can view own searches"
  ON public.searches
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own searches" ON public.searches;
CREATE POLICY "Users can update own searches"
  ON public.searches
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view search results" ON public.search_results;
CREATE POLICY "Users can view search results"
  ON public.search_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.searches
      WHERE public.searches.id = public.search_results.search_id
        AND public.searches.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view search itineraries"
  ON public.search_itineraries;
CREATE POLICY "Users can view search itineraries"
  ON public.search_itineraries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.searches
      WHERE public.searches.id = public.search_itineraries.search_id
        AND public.searches.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.affiliate_clicks;
CREATE POLICY "Service role can insert clicks"
  ON public.affiliate_clicks
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Users can view own clicks" ON public.affiliate_clicks;
CREATE POLICY "Users can view own clicks"
  ON public.affiliate_clicks
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own conversions"
  ON public.affiliate_conversions;
CREATE POLICY "Users can view own conversions"
  ON public.affiliate_conversions
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON FUNCTION public.cleanup_expired_anonymous_trips()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_anonymous_trips()
  TO service_role;


-- SOURCE supabase/migrations/20260725003000_repair_stale_generation_state.sql SHA256 942ac23402847bd2877c76f47ec120bbb9cc2c100f5128c8d0701a86fc6adb7c
-- Generation normally completes within minutes. Repair abandoned workflow
-- state after one hour so clients can offer a retry instead of loading forever.

CREATE OR REPLACE FUNCTION public.cleanup_stale_generation_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_searches INTEGER;
  v_trips INTEGER;
BEGIN
  UPDATE public.searches
  SET
    status = 'error',
    error_message = COALESCE(
      error_message,
      'Generation timed out before completion. Please try again.'
    ),
    updated_at = clock_timestamp()
  WHERE status IN ('pending', 'searching')
    AND updated_at < clock_timestamp() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_searches = ROW_COUNT;

  UPDATE public.trips
  SET
    status = 'failed',
    updated_at = clock_timestamp()
  WHERE status = 'generating'
    AND updated_at < clock_timestamp() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_trips = ROW_COUNT;

  RETURN jsonb_build_object(
    'searches', v_searches,
    'trips', v_trips
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_generation_state()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_generation_state()
  TO service_role;

SELECT public.cleanup_stale_generation_state();


-- SOURCE supabase/migrations/20260725006000_product_feedback_and_metrics.sql SHA256 5659c10d860e6c3a62638cdd3811850c784b4b93f5a57e742e1505d1636c1c96
-- First-party product feedback and restricted PMF metric views.
-- No cookies, cross-site identifiers, raw IPs, or third-party analytics are used.

CREATE TABLE IF NOT EXISTS public.trip_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  would_use_again BOOLEAN,
  issue_tags TEXT[] NOT NULL DEFAULT '{}',
  comment TEXT,
  source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'mobile')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_feedback_comment_length CHECK (
    comment IS NULL OR char_length(comment) <= 1000
  ),
  CONSTRAINT trip_feedback_one_per_user UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_feedback_user_created
  ON public.trip_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_feedback_score_created
  ON public.trip_feedback(score, created_at DESC);

ALTER TABLE public.trip_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trip feedback"
  ON public.trip_feedback;
CREATE POLICY "Users can view own trip feedback"
  ON public.trip_feedback
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can submit own trip feedback"
  ON public.trip_feedback;
CREATE POLICY "Users can submit own trip feedback"
  ON public.trip_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.trips
      WHERE public.trips.id = trip_feedback.trip_id
        AND public.trips.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own trip feedback"
  ON public.trip_feedback;
CREATE POLICY "Users can update own trip feedback"
  ON public.trip_feedback
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.set_trip_feedback_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_trip_feedback_updated_at
  ON public.trip_feedback;
CREATE TRIGGER set_trip_feedback_updated_at
  BEFORE UPDATE ON public.trip_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trip_feedback_updated_at();

COMMENT ON TABLE public.trip_feedback IS
  'Structured, first-party usefulness feedback for generated itineraries.';

CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA analytics TO service_role;

CREATE OR REPLACE VIEW analytics.product_funnel_daily
WITH (security_invoker = true)
AS
WITH calendar AS (
  SELECT created_at::date AS day FROM public.users
  UNION
  SELECT created_at::date FROM public.searches
  UNION
  SELECT generated_at::date FROM public.itineraries
  UNION
  SELECT shared_at::date FROM public.trips WHERE shared_at IS NOT NULL
  UNION
  SELECT clicked_at::date FROM public.affiliate_clicks
  UNION
  SELECT COALESCE(conversion_date, created_at)::date
    FROM public.affiliate_conversions
  UNION
  SELECT created_at::date FROM public.trip_feedback
),
signups AS (
  SELECT created_at::date AS day, COUNT(*) AS new_users
  FROM public.users
  GROUP BY 1
),
search_activity AS (
  SELECT
    created_at::date AS day,
    COUNT(*) AS searches_started,
    COUNT(*) FILTER (WHERE status = 'completed') AS searches_completed,
    COUNT(DISTINCT user_id) AS active_users
  FROM public.searches
  GROUP BY 1
),
activations AS (
  SELECT
    i.generated_at::date AS day,
    COUNT(*) AS itineraries_generated,
    COUNT(DISTINCT t.user_id) AS activated_users
  FROM public.itineraries i
  JOIN public.trips t ON t.id = i.trip_id
  GROUP BY 1
),
shares AS (
  SELECT
    shared_at::date AS day,
    COUNT(*) AS trips_shared,
    COUNT(DISTINCT user_id) AS sharing_users
  FROM public.trips
  WHERE shared_at IS NOT NULL
  GROUP BY 1
),
clicks AS (
  SELECT
    clicked_at::date AS day,
    COUNT(*) AS affiliate_clicks,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)
      AS affiliate_clickers
  FROM public.affiliate_clicks
  GROUP BY 1
),
conversions AS (
  SELECT
    COALESCE(conversion_date, created_at)::date AS day,
    COUNT(*) AS affiliate_conversions,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)
      AS converting_users,
    COALESCE(SUM(booking_value), 0) AS booking_value,
    COALESCE(SUM(commission_value), 0) AS commission_value
  FROM public.affiliate_conversions
  GROUP BY 1
),
feedback AS (
  SELECT
    created_at::date AS day,
    COUNT(*) AS feedback_responses,
    ROUND(AVG(score), 2) AS average_feedback_score,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE would_use_again)
      / NULLIF(COUNT(*) FILTER (WHERE would_use_again IS NOT NULL), 0),
      2
    ) AS reuse_intent_rate
  FROM public.trip_feedback
  GROUP BY 1
)
SELECT
  calendar.day,
  COALESCE(signups.new_users, 0) AS new_users,
  COALESCE(search_activity.active_users, 0) AS active_users,
  COALESCE(search_activity.searches_started, 0) AS searches_started,
  COALESCE(search_activity.searches_completed, 0) AS searches_completed,
  COALESCE(activations.itineraries_generated, 0)
    AS itineraries_generated,
  COALESCE(activations.activated_users, 0) AS activated_users,
  COALESCE(shares.trips_shared, 0) AS trips_shared,
  COALESCE(shares.sharing_users, 0) AS sharing_users,
  COALESCE(clicks.affiliate_clicks, 0) AS affiliate_clicks,
  COALESCE(clicks.affiliate_clickers, 0) AS affiliate_clickers,
  COALESCE(conversions.affiliate_conversions, 0)
    AS affiliate_conversions,
  COALESCE(conversions.converting_users, 0) AS converting_users,
  COALESCE(conversions.booking_value, 0) AS booking_value,
  COALESCE(conversions.commission_value, 0) AS commission_value,
  COALESCE(feedback.feedback_responses, 0) AS feedback_responses,
  feedback.average_feedback_score,
  feedback.reuse_intent_rate
FROM calendar
LEFT JOIN signups USING (day)
LEFT JOIN search_activity USING (day)
LEFT JOIN activations USING (day)
LEFT JOIN shares USING (day)
LEFT JOIN clicks USING (day)
LEFT JOIN conversions USING (day)
LEFT JOIN feedback USING (day)
ORDER BY calendar.day DESC;

CREATE OR REPLACE VIEW analytics.activation_daily
WITH (security_invoker = true)
AS
WITH first_activation AS (
  SELECT
    t.user_id,
    MIN(i.generated_at) AS activated_at
  FROM public.itineraries i
  JOIN public.trips t ON t.id = i.trip_id
  WHERE t.user_id IS NOT NULL
  GROUP BY t.user_id
)
SELECT
  u.created_at::date AS signup_day,
  COUNT(*) AS signups,
  COUNT(*) FILTER (
    WHERE first_activation.activated_at <= u.created_at + INTERVAL '24 hours'
  ) AS activated_within_24h,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE first_activation.activated_at <= u.created_at + INTERVAL '24 hours'
    ) / NULLIF(COUNT(*), 0),
    2
  ) AS activation_rate_24h
FROM public.users u
LEFT JOIN first_activation ON first_activation.user_id = u.id
GROUP BY 1
ORDER BY signup_day DESC;

CREATE OR REPLACE VIEW analytics.retention_weekly
WITH (security_invoker = true)
AS
WITH activated AS (
  SELECT
    t.user_id,
    DATE_TRUNC('week', MIN(i.generated_at))::date AS cohort_week
  FROM public.itineraries i
  JOIN public.trips t ON t.id = i.trip_id
  WHERE t.user_id IS NOT NULL
  GROUP BY t.user_id
),
activity AS (
  SELECT DISTINCT
    user_id,
    DATE_TRUNC('week', created_at)::date AS activity_week
  FROM public.searches
  WHERE user_id IS NOT NULL
),
cohort_sizes AS (
  SELECT cohort_week, COUNT(*) AS cohort_size
  FROM activated
  GROUP BY cohort_week
)
SELECT
  activated.cohort_week,
  activity.activity_week,
  (
    (activity.activity_week - activated.cohort_week) / 7
  )::integer AS week_number,
  cohort_sizes.cohort_size,
  COUNT(DISTINCT activated.user_id) AS retained_users,
  ROUND(
    100.0 * COUNT(DISTINCT activated.user_id)
    / NULLIF(cohort_sizes.cohort_size, 0),
    2
  ) AS retention_rate
FROM activated
JOIN activity
  ON activity.user_id = activated.user_id
 AND activity.activity_week >= activated.cohort_week
JOIN cohort_sizes USING (cohort_week)
GROUP BY
  activated.cohort_week,
  activity.activity_week,
  cohort_sizes.cohort_size
ORDER BY activated.cohort_week DESC, activity.activity_week;

REVOKE ALL ON ALL TABLES IN SCHEMA analytics
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO service_role;

COMMENT ON VIEW analytics.product_funnel_daily IS
  'Daily acquisition, activation, engagement, conversion, revenue, and feedback metrics.';
COMMENT ON VIEW analytics.activation_daily IS
  'Signup cohorts and first-itinerary activation within 24 hours.';
COMMENT ON VIEW analytics.retention_weekly IS
  'Activated-user weekly search retention by activation cohort.';


-- SOURCE supabase/migrations/20261003000000_met_weather_cache.sql SHA256 244937b877e765d1681ca595ec595df927d6cd74d33d100c90181aa7789b25d7
-- Shared destination forecast cache. Deploy only with an approved rollout;
-- MET weather remains disabled until config, contact and cache are verified.
create table if not exists public.met_weather_cache (
  cache_key text primary key,
  payload jsonb,
  expires_at timestamptz,
  last_modified text,
  fetched_at timestamptz,
  lock_until timestamptz not null default '-infinity',
  constraint met_cache_key_length check (length(cache_key) <= 80)
);
alter table public.met_weather_cache enable row level security;
revoke all on public.met_weather_cache from public, anon, authenticated;
grant select, insert, update, delete on public.met_weather_cache to service_role;

create or replace function public.claim_met_weather_cache(p_cache_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into public.met_weather_cache(cache_key) values(p_cache_key)
    on conflict (cache_key) do nothing;
  update public.met_weather_cache set lock_until = now() + interval '15 seconds'
    where cache_key = p_cache_key and lock_until <= now();
  return found;
end;
$$;
revoke all on function public.claim_met_weather_cache(text) from public, anon, authenticated;
grant execute on function public.claim_met_weather_cache(text) to service_role;


-- SOURCE supabase/migrations/20261003001000_fence_trip_generation.sql SHA256 e940023f301bf0f6975410211ec26bae4d527cb98fef38d68de975dca78f7e99
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


-- SOURCE supabase/migrations/20261003003000_protect_search_run_binding.sql SHA256 14737afa33342cae9f5d3047cf2ae354d01c62085a6c7b6d05e8ae53d61e0124
-- Apply in one transaction before enabling reconciliation in the new app.
-- Existing run bindings were writable by owners and are not trusted retroactively.
ALTER TABLE public.searches ADD COLUMN IF NOT EXISTS workflow_run_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.protect_search_lifecycle() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Search attempts are managed by the server' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_search_lifecycle ON public.searches;
CREATE TRIGGER protect_search_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON public.searches
FOR EACH ROW EXECUTE FUNCTION public.protect_search_lifecycle();


-- SOURCE supabase/migrations/20261003004000_require_terminal_generation_evidence.sql SHA256 3aca0e8d620b3dcc875e992c89bb5e0013f17ed086b8a17ad6c4a602c8661418
-- Elapsed time is not evidence that a durable workflow stopped. Keep the cron
-- response shape, but leave uncertain attempts claimed for backend reconciliation.
CREATE OR REPLACE FUNCTION public.cleanup_stale_generation_state()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT jsonb_build_object(
    'searches', 0,
    'trips', 0,
    'awaiting_confirmation', (
      SELECT count(*) FROM public.trips
      WHERE status = 'generating' AND updated_at < clock_timestamp() - INTERVAL '1 hour'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.cleanup_stale_generation_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_generation_state() TO service_role;


-- SOURCE supabase/migrations/20261003002000_protect_trip_lifecycle.sql SHA256 6bc886a10e6cce4304d839a76fd35a1cb87d9cf137e612c03fe0f5ff1dcabafa
-- Owner RLS alone does not protect individual linkage/lifecycle columns.
-- Direct authenticated REST writes must not bypass generation/sharing APIs.
CREATE OR REPLACE FUNCTION public.protect_trip_lifecycle() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' OR NEW.search_id IS NOT NULL OR NEW.itinerary_id IS NOT NULL
      OR COALESCE(NEW.is_shared, FALSE) OR NEW.share_token IS NOT NULL OR NEW.shared_at IS NOT NULL THEN
      RAISE EXCEPTION 'Trip lifecycle fields are managed by the server' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.status IS DISTINCT FROM OLD.status OR NEW.search_id IS DISTINCT FROM OLD.search_id
    OR NEW.itinerary_id IS DISTINCT FROM OLD.itinerary_id OR NEW.is_shared IS DISTINCT FROM OLD.is_shared
    OR NEW.share_token IS DISTINCT FROM OLD.share_token OR NEW.shared_at IS DISTINCT FROM OLD.shared_at THEN
    RAISE EXCEPTION 'Trip lifecycle fields are managed by the server' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_trip_lifecycle ON public.trips;
CREATE TRIGGER protect_trip_lifecycle BEFORE INSERT OR UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.protect_trip_lifecycle();


-- SOURCE supabase/migrations/20261003005000_version_trip_briefs.sql SHA256 98cb9ca19e343ad6728cffa3f6012e13e37a5eaae0fb0953593ef76b5c8c0737
-- Requires the recovery migrations. Deploy callers only after this migration.
CREATE OR REPLACE FUNCTION public.protect_trip_brief() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_changed BOOLEAN;
  v_server BOOLEAN := current_user IN ('service_role', 'postgres', 'supabase_admin');
BEGIN
  v_changed := ROW(NEW.destination, NEW.start_date, NEW.end_date, NEW.travelers, NEW.budget_tier, NEW.vibes,
    COALESCE(NEW.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh') IS DISTINCT FROM
    ROW(OLD.destination, OLD.start_date, OLD.end_date, OLD.travelers, OLD.budget_tier, OLD.vibes,
    COALESCE(OLD.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh');
  IF NOT v_server AND (v_changed OR NEW.preferences IS DISTINCT FROM OLD.preferences) THEN
    RAISE EXCEPTION 'Use the versioned trip brief API' USING ERRCODE = '42501';
  END IF;
  -- Preserve server metadata even when older clients send a partial preferences object.
  NEW.preferences := (COALESCE(NEW.preferences, '{}'::jsonb) - 'creationRequestHash' - 'planNeedsRefresh') ||
    (COALESCE(OLD.preferences, '{}'::jsonb) - ARRAY['travelerType','originCity','originAirport','adults','children','interests']);
  IF v_changed THEN
    IF current_user = 'service_role' AND COALESCE(current_setting('faroway.versioned_brief_write', TRUE), '') <> 'on' THEN
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
    NEW.preferences := NEW.preferences || jsonb_build_object('planNeedsRefresh', EXISTS (SELECT 1 FROM public.itineraries WHERE trip_id = OLD.id));
  ELSIF v_server AND OLD.status = 'generating' AND NEW.status = 'planned' AND NEW.search_id IS NOT DISTINCT FROM OLD.search_id THEN
    NEW.preferences := NEW.preferences - 'planNeedsRefresh';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_trip_brief ON public.trips;
CREATE TRIGGER protect_trip_brief BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.protect_trip_brief();

-- The existing update_trips_updated_at trigger runs after protect_trip_brief.
-- Its shared function assigns transaction-stable NOW(), which can collapse
-- consecutive edits onto the same revision. Replace only the trips binding;
-- other tables retain their existing timestamp behavior.
CREATE OR REPLACE FUNCTION public.advance_trip_revision() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + INTERVAL '1 microsecond');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS update_trips_updated_at ON public.trips;
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.advance_trip_revision();

CREATE OR REPLACE FUNCTION public.update_trip_brief(
  p_trip_id UUID, p_user_id UUID, p_expected_updated_at TIMESTAMPTZ, p_changes JSONB
) RETURNS SETOF public.trips LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_previous TEXT := current_setting('faroway.versioned_brief_write', TRUE);
BEGIN
  PERFORM set_config('faroway.versioned_brief_write', 'on', TRUE);
  RETURN QUERY UPDATE public.trips AS t SET
    destination = COALESCE(p_changes->>'destination', t.destination),
    start_date = COALESCE((p_changes->>'start_date')::DATE, t.start_date),
    end_date = COALESCE((p_changes->>'end_date')::DATE, t.end_date),
    travelers = COALESCE((p_changes->>'travelers')::INTEGER, t.travelers),
    budget_tier = COALESCE(p_changes->>'budget_tier', t.budget_tier),
    vibes = CASE WHEN p_changes ? 'vibes' THEN ARRAY(SELECT jsonb_array_elements_text(p_changes->'vibes')) ELSE t.vibes END,
    preferences = COALESCE(t.preferences, '{}'::JSONB) || COALESCE(p_changes->'preferences', '{}'::JSONB)
  WHERE t.id = p_trip_id AND t.user_id = p_user_id
    AND t.updated_at = p_expected_updated_at AND t.status <> 'generating'
  RETURNING t.*;
  PERFORM set_config('faroway.versioned_brief_write', COALESCE(v_previous, ''), TRUE);
END;
$$;
REVOKE ALL ON FUNCTION public.update_trip_brief(UUID, UUID, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_trip_brief(UUID, UUID, TIMESTAMPTZ, JSONB) TO service_role;


-- SOURCE supabase/migrations/20261003006000_version_checkout_handoffs.sql SHA256 8a327032f9d466213381ff2f592db911c14c869e0b7102d63dd10090aea7b1e1
-- Apply after versioned briefs. No provider requests or purchases are made here.
ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS trip_revision TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.prepare_trip_handoff(
  p_trip_id UUID, p_user_id UUID, p_revision TIMESTAMPTZ,
  p_click_id TEXT, p_item_id TEXT, p_item_name TEXT, p_url TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE t public.trips%ROWTYPE; c public.affiliate_clicks%ROWTYPE;
BEGIN
  -- Serialize publication with brief edits and generation completion. A provider
  -- lookup that began against an old revision cannot publish after an edit.
  SELECT * INTO t FROM public.trips WHERE id = p_trip_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR t.updated_at IS DISTINCT FROM p_revision
    OR t.status NOT IN ('planned', 'generated', 'booked', 'completed')
    OR COALESCE(t.preferences->>'planNeedsRefresh', 'false') = 'true' THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.affiliate_clicks(id,user_id,trip_id,item_id,item_type,item_name,
    affiliate_partner,affiliate_url,source,converted,clicked_at,trip_revision)
  VALUES(p_click_id,p_user_id,p_trip_id,p_item_id,'activity',p_item_name,
    'viator',p_url,'itinerary',FALSE,clock_timestamp(),p_revision)
  ON CONFLICT(id) DO NOTHING;
  SELECT * INTO c FROM public.affiliate_clicks WHERE id = p_click_id;
  RETURN c.user_id = p_user_id AND c.trip_id = p_trip_id AND c.item_id = p_item_id
    AND c.item_type = 'activity' AND c.affiliate_partner = 'viator'
    AND c.trip_revision = p_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_trip_handoff(UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_trip_handoff(UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) TO service_role;


-- SOURCE supabase/migrations/20261003007000_revision_safe_plan_edits.sql SHA256 21ffcbd0d6ed29079be1c6466db66510c26bcee4e1dd7261b71724fb3df06fb8
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


-- SOURCE supabase/migrations/20261003008000_trip_booking_checklist.sql SHA256 54d0b593dd77d5c08298a2e6c04ff27650bc0fe9c403d6a6e780a9119151ceb1
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


-- SOURCE supabase/migrations/20261004001000_restrict_privileged_database_helpers.sql SHA256 47fde907ec22bebdaf3a69fe330728b71f320d1e9dfb49e4dead6ccf682a4bf5
-- Separate approval from the trip-recovery rollout. No application table/RLS changes.
-- Current web/mobile token management uses owner-scoped table operations; these
-- privileged helpers and the global aggregate are server-only operations.
ALTER FUNCTION public.get_user_push_tokens(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.deactivate_push_token(TEXT) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.get_user_push_tokens(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deactivate_push_token(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_push_tokens(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_push_token(TEXT) TO service_role;
REVOKE ALL ON TABLE public.affiliate_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.affiliate_stats TO service_role;


-- STAGING SUPPLEMENT permissions.sql
-- STAGING-ONLY SUPPLEMENT. Review separately; not a production migration.
-- Automatic table exposure is off. Grant only the application surfaces below.
-- Do not replace with GRANT ALL TO anon/authenticated.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated;

-- Public discovery. Existing RLS restricts blog_posts to published content.
GRANT SELECT ON public.destinations,public.blog_posts TO anon,authenticated;
-- Authenticated reads still require the existing row-level ownership policies.
GRANT SELECT ON public.users,public.trips,public.itineraries,public.saved_activities,
  public.searches,public.search_results,public.search_itineraries,
  public.workflow_runs,public.workflow_progress,public.notifications,
  public.affiliate_clicks,public.affiliate_conversions,public.push_tokens,
  public.trip_feedback TO authenticated;
GRANT UPDATE(display_name,avatar_url,preferences,notification_settings) ON public.users TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.trips,public.saved_activities,public.push_tokens TO authenticated;
GRANT UPDATE(read) ON public.notifications TO authenticated;
GRANT INSERT ON public.trip_feedback TO authenticated;
GRANT UPDATE(score,would_use_again,issue_tags,comment,source) ON public.trip_feedback TO authenticated;
-- No direct client itinerary/search writes; server fences and APIs own them.
-- Newsletter/view/report inserts go through existing rate-limited server routes.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.users,public.trips,public.itineraries,
  public.saved_activities,public.searches,public.search_results,public.search_itineraries,
  public.workflow_runs,public.workflow_progress,public.notifications,public.realtime_events,
  public.affiliate_clicks,public.affiliate_conversions,public.newsletter_subscribers,
  public.blog_post_views,public.blog_posts,public.destinations,public.push_tokens,
  public.content_reports,public.rate_limit_buckets,public.trip_feedback,
  public.met_weather_cache TO service_role;
-- Preserve PR26's append-only service permissions and server-only global view.
REVOKE ALL ON public.trip_plan_revisions,public.trip_booking_reports FROM service_role;
GRANT SELECT,INSERT ON public.trip_plan_revisions,public.trip_booking_reports TO service_role;
GRANT USAGE ON SEQUENCE public.trip_booking_reports_sequence_seq TO service_role;
GRANT SELECT ON public.affiliate_stats TO service_role;
GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO service_role;

-- Do not leave legacy SECURITY DEFINER aggregates/mutations as public RPCs.
-- Existing destination/blog API callers use the server client (service_role).
ALTER FUNCTION public.get_destination_trip_counts(TIMESTAMPTZ) SET search_path=public,pg_temp;
ALTER FUNCTION public.get_destination_search_counts(TIMESTAMPTZ) SET search_path=public,pg_temp;
ALTER FUNCTION public.increment_blog_view_count(TEXT) SET search_path=public,pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path=public,pg_temp;
-- Deny direct RPC access to every current application function, including old
-- invoker cleanup helpers; grant server execution explicitly. Exclude extension
-- members so platform/extension API permissions are not rewritten.
DO $$ DECLARE f RECORD;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;
-- Existing Auth trigger can still execute as its trusted owner. No grants or
-- schema changes are made to auth or storage platform objects by this supplement.


-- STAGING SUPPLEMENT synthetic-content.sql
-- STAGING-ONLY SYNTHETIC CONTENT. No accounts, real destinations or storage URLs.
INSERT INTO public.destinations(slug,name,country,description,image,tags,currency)
VALUES('fixture-harbor','Fixture Harbor','Testland','Synthetic staging destination; not travel advice.',NULL,ARRAY['fixture'],'USD'),
      ('fixture-garden','Fixture Garden','Testland','Synthetic step-free planning fixture; accessibility is not verified.',NULL,ARRAY['fixture'],'EUR');
INSERT INTO public.blog_posts(slug,title,description,content_source,status,cover_image)
VALUES('fixture-published','Synthetic staging article','Test content, not a published travel recommendation.','database','published',NULL),
      ('fixture-draft','Synthetic private draft','Must not be visible to anonymous readers.','database','draft',NULL);
-- Bucket schema/policies are installed by the historical migration, but no
-- objects or production image URLs are copied. Auth fixtures exist only locally.


-- STAGING SUPPLEMENT postconditions.sql
-- Fail the whole bootstrap transaction if a required access boundary is missing.
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_tables WHERE schemaname='public')<>24 THEN
    RAISE EXCEPTION 'Unexpected application table inventory';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'Application table without RLS';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef
    AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) THEN
    RAISE EXCEPTION 'Client-accessible SECURITY DEFINER helper';
  END IF;
  IF has_table_privilege('anon','public.trips','SELECT') OR has_table_privilege('authenticated','public.affiliate_stats','SELECT')
    OR has_table_privilege('authenticated','public.trip_booking_reports','SELECT') THEN
    RAISE EXCEPTION 'Unexpected client relation access';
  END IF;
  IF NOT has_table_privilege('authenticated','public.push_tokens','INSERT') OR NOT has_table_privilege('service_role','public.trips','UPDATE') THEN
    RAISE EXCEPTION 'Missing explicit application grants';
  END IF;
  IF (SELECT count(*) FROM public.destinations)<>2 OR (SELECT count(*) FROM public.blog_posts)<>2
     OR EXISTS(SELECT 1 FROM public.destinations WHERE image IS NOT NULL)
     OR EXISTS(SELECT 1 FROM public.blog_posts WHERE cover_image IS NOT NULL) THEN
    RAISE EXCEPTION 'Unexpected synthetic-content fixture';
  END IF;
END $$;


NOTIFY pgrst, 'reload schema';
COMMIT;
