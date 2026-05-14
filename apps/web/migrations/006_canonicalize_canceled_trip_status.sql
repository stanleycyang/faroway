-- Canonicalize any legacy UK-spelled trip lifecycle rows after the enum value
-- exists. The old enum label may remain in Postgres, but app code emits
-- "canceled" going forward.

UPDATE trips SET status = 'canceled' WHERE status::text = 'cancelled';
