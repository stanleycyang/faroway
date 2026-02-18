-- Add json_render_spec column to store the complete json-render UI spec
-- that the mobile app renders directly after itinerary generation completes.
ALTER TABLE searches ADD COLUMN IF NOT EXISTS json_render_spec JSONB;
