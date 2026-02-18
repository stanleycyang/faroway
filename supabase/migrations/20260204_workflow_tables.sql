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
