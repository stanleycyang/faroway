-- Widen trip lifecycle statuses for partner-derived booking/payment state.
-- Financial truth remains in affiliate_conversions; trips.status is a summary
-- state for product UX and filtering.

ALTER TABLE trips ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

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
