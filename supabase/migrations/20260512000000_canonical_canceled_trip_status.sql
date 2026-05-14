-- Canonicalize trip lifecycle cancellation spelling to "canceled". Affiliate
-- conversion statuses continue to use their existing provider-facing values.

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;

UPDATE trips SET status = 'canceled' WHERE status = 'cancelled';

ALTER TABLE trips
ADD CONSTRAINT trips_status_check
CHECK (
  status IN (
    'draft',
    'planning',
    'planned',
    'generating',
    'generated',
    'failed',
    'active',
    'in_progress',
    'booked',
    'paid',
    'completed',
    'canceled'
  )
);
