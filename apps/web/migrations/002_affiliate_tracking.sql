-- Migration: Affiliate Click Tracking
-- Created: 2026-02-04
-- Purpose: Track affiliate clicks for commission attribution

-- Create affiliate_clicks table
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  activity_id VARCHAR(255),
  
  -- Affiliate details
  partner VARCHAR(50) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  product_name TEXT,
  
  -- Tracking
  tracking_id VARCHAR(100) UNIQUE NOT NULL,
  click_url TEXT NOT NULL DEFAULT '',
  referrer_url TEXT,
  
  -- Attribution
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMP WITH TIME ZONE,
  commission_amount DECIMAL(10, 2),
  commission_currency VARCHAR(3) DEFAULT 'USD',
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(20),
  
  -- Constraints
  CONSTRAINT valid_partner CHECK (partner IN ('viator', 'booking', 'getyourguide', 'tripadvisor')),
  CONSTRAINT valid_device_type CHECK (device_type IS NULL OR device_type IN ('mobile', 'tablet', 'desktop', 'unknown'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_trip ON affiliate_clicks(trip_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_tracking ON affiliate_clicks(tracking_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_partner ON affiliate_clicks(partner, clicked_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_date ON affiliate_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_converted ON affiliate_clicks(converted) WHERE converted = true;

-- Row Level Security
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Users can view their own clicks
CREATE POLICY "Users can view own clicks" ON affiliate_clicks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role full access" ON affiliate_clicks
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Create analytics view for dashboards
CREATE OR REPLACE VIEW affiliate_analytics AS
SELECT 
  DATE_TRUNC('day', clicked_at) as date,
  partner,
  COUNT(*) as clicks,
  COUNT(*) FILTER (WHERE converted = true) as conversions,
  ROUND(COUNT(*) FILTER (WHERE converted = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as conversion_rate,
  SUM(commission_amount) FILTER (WHERE converted = true) as total_commission,
  AVG(commission_amount) FILTER (WHERE converted = true) as avg_commission
FROM affiliate_clicks
GROUP BY DATE_TRUNC('day', clicked_at), partner
ORDER BY date DESC, partner;

-- Grant access to analytics view
GRANT SELECT ON affiliate_analytics TO authenticated;

-- Function to record a conversion (for webhooks)
CREATE OR REPLACE FUNCTION record_affiliate_conversion(
  p_tracking_id VARCHAR(100),
  p_commission_amount DECIMAL(10, 2),
  p_currency VARCHAR(3) DEFAULT 'USD'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE affiliate_clicks
  SET 
    converted = true,
    converted_at = NOW(),
    commission_amount = p_commission_amount,
    commission_currency = p_currency
  WHERE tracking_id = p_tracking_id
    AND converted = false;
  
  RETURN FOUND;
END;
$$;

-- Comment on table
COMMENT ON TABLE affiliate_clicks IS 'Tracks clicks on affiliate links for commission attribution with Viator, Booking.com, etc.';
COMMENT ON COLUMN affiliate_clicks.tracking_id IS 'Unique ID passed to affiliate partner for attribution';
COMMENT ON COLUMN affiliate_clicks.partner IS 'Affiliate partner: viator, booking, getyourguide, tripadvisor';
