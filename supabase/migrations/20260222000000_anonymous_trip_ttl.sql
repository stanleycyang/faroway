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
