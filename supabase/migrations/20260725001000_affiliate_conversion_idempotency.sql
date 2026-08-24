-- Partner webhooks are retried. Give each conversion a stable conflict key so
-- retries update the existing financial record instead of double-counting it.

ALTER TABLE public.affiliate_conversions
  ADD COLUMN IF NOT EXISTS conversion_key TEXT
  GENERATED ALWAYS AS (
    COALESCE(
      NULLIF(order_id, ''),
      NULLIF(booking_reference, ''),
      NULLIF(click_id, '')
    )
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_conversions_partner_key
  ON public.affiliate_conversions(partner, conversion_key);
