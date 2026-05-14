-- Align push token schema with the mobile release API.
-- The API records last_seen_at on registration and accepts unknown platform
-- for non-standard React Native runtimes.

ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_push_tokens_last_seen
  ON public.push_tokens(last_seen_at);

ALTER TABLE public.push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_platform_check;

ALTER TABLE public.push_tokens
  ADD CONSTRAINT push_tokens_platform_check
  CHECK (platform IN ('ios', 'android', 'web', 'unknown'));
