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
