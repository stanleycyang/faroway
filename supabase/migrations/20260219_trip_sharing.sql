-- Add sharing columns to trips table
ALTER TABLE trips
  ADD COLUMN share_token TEXT UNIQUE,
  ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN shared_at TIMESTAMPTZ;

-- Partial index for fast public lookups by share_token where sharing is enabled
CREATE UNIQUE INDEX idx_trips_share_token_active
  ON trips (share_token)
  WHERE share_token IS NOT NULL;
