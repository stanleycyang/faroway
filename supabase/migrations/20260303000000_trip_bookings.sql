-- Trip Bookings: User-facing booking lifecycle tracking
-- Bridges the gap between affiliate click tracking (revenue) and the user's
-- trip view (showing "you booked this"). Only tracks categories with real
-- OTA booking partners (flights via Duffel, activities via Viator/GYG).

CREATE TABLE IF NOT EXISTS trip_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  click_id TEXT REFERENCES affiliate_clicks(id) ON DELETE SET NULL,

  -- What was booked
  category TEXT NOT NULL CHECK (category IN ('activity', 'flight')),
  item_name TEXT NOT NULL,
  item_id TEXT,

  -- Partner info
  partner TEXT NOT NULL,
  partner_booking_ref TEXT,    -- filled by conversion webhook
  partner_manage_url TEXT,     -- deep link to manage booking on partner site

  -- Dates and details
  check_in DATE,
  check_out DATE,
  start_time TIMESTAMPTZ,

  -- Pricing at time of click
  price DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',

  -- Lifecycle status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'user_confirmed', 'cancelled', 'expired')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ       -- auto-expire stale pending bookings
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_bookings_user_id ON trip_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_trip_id ON trip_bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_click_id ON trip_bookings(click_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_status ON trip_bookings(status);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_created_at ON trip_bookings(created_at DESC);

-- RLS
ALTER TABLE trip_bookings ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings" ON trip_bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own bookings (created on affiliate click)
CREATE POLICY "Users can insert own bookings" ON trip_bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookings (e.g. user_confirmed status)
CREATE POLICY "Users can update own bookings" ON trip_bookings
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can update any booking (conversion webhooks)
-- Note: service role bypasses RLS by default in Supabase, so this is implicit

COMMENT ON TABLE trip_bookings IS 'User-facing booking lifecycle for trips. Created on affiliate click, confirmed by webhook or user.';
