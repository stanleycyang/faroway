-- ============================================
-- Push Tokens Table for TripGenie
-- ============================================
-- This table stores Expo Push Tokens for each user
-- to enable sending push notifications.

-- Create the push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique constraint: one token per user (a user might have multiple devices)
  UNIQUE(user_id, token)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view/manage their own push tokens
CREATE POLICY "Users can view their own push tokens"
  ON push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
  ON push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
  ON push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
  ON push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all tokens (for server-side operations)
CREATE POLICY "Service role can manage all push tokens"
  ON push_tokens
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER trigger_update_push_token_timestamp
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_token_timestamp();

-- ============================================
-- Helper Functions for Push Notifications
-- ============================================

-- Function to get active push tokens for a user
CREATE OR REPLACE FUNCTION get_user_push_tokens(target_user_id UUID)
RETURNS TABLE (token TEXT, platform TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.token, pt.platform
  FROM push_tokens pt
  WHERE pt.user_id = target_user_id
    AND pt.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate a push token (e.g., when it becomes invalid)
CREATE OR REPLACE FUNCTION deactivate_push_token(target_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE push_tokens
  SET is_active = false, updated_at = NOW()
  WHERE token = target_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Notification Types Reference
-- ============================================
-- The following notification types are supported:
--
-- 1. trip_generation_complete
--    - Sent when AI finishes generating a trip itinerary
--    - Data: { type: 'trip_generation_complete', tripId: string }
--
-- 2. trip_reminder
--    - Sent 1 day before a trip starts
--    - Data: { type: 'trip_reminder', tripId: string, title: string }
--
-- 3. activity_recommendation
--    - Sent when new activities are recommended
--    - Data: { type: 'activity_recommendation', tripId?: string }
