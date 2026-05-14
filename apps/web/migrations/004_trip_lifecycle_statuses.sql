-- Add partner-derived lifecycle states to the app/web trip_status enum.
-- Booking/payment amounts remain in affiliate_conversions and are surfaced via
-- bookingSummary; these status values only make the trip lifecycle scannable.

ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'booked';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'canceled';
