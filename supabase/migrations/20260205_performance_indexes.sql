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
