-- Canonicalize legacy "generated" trip lifecycle rows to "planned". The enum
-- value may remain for old local databases, but app code emits "planned".

UPDATE trips SET status = 'planned' WHERE status::text = 'generated';
