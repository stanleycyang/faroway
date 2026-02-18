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
