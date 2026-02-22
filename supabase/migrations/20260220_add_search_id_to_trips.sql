-- Add search_id to trips table to link trips to their search/workflow records
ALTER TABLE trips ADD COLUMN IF NOT EXISTS search_id UUID REFERENCES searches(id) ON DELETE SET NULL;

-- Index for looking up trips by search_id
CREATE INDEX IF NOT EXISTS idx_trips_search_id ON trips(search_id);
