-- Add the canonical US-spelled cancellation lifecycle state for existing
-- databases that were initialized before the enum spelling was corrected.

ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'canceled';
