-- Add user preference and profile columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"trip_reminders":true,"deals":true,"itinerary_updates":true,"app_updates":false}';
