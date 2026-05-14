-- Allow transport partner clicks so flight/ground transport recommendations can
-- be tracked through /api/track/click.

ALTER TABLE affiliate_clicks
DROP CONSTRAINT IF EXISTS affiliate_clicks_item_type_check;

ALTER TABLE affiliate_clicks
ADD CONSTRAINT affiliate_clicks_item_type_check
CHECK (item_type IN ('hotel', 'activity', 'restaurant', 'flight', 'transport'));
