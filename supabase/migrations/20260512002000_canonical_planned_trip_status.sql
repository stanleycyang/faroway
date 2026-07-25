-- Canonicalize itinerary-ready trips to "planned". Older app versions used
-- "generated" for the same lifecycle state; read paths still tolerate that
-- legacy value, but new production data should use "planned".

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;

UPDATE trips SET status = 'planned' WHERE status = 'generated';
UPDATE trips SET status = 'canceled' WHERE status = 'cancelled';

ALTER TABLE trips
ADD CONSTRAINT trips_status_check
CHECK (
  status IN (
    'draft',
    'planning',
    'planned',
    -- Retained for zero-downtime deploys and old clients; current code emits
    -- "planned" and read paths normalize this legacy value.
    'generated',
    'generating',
    'failed',
    'active',
    'in_progress',
    'booked',
    'paid',
    'completed',
    'canceled'
  )
);
