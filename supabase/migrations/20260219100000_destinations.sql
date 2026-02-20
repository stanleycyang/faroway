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
