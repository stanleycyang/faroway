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
