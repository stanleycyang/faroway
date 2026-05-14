-- Moderation queue for shared itinerary reports submitted from public report pages.

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL DEFAULT 'shared_trip',
  content_token TEXT NOT NULL,
  content_url TEXT NOT NULL,
  reported_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  reporter_email TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  CONSTRAINT content_reports_content_type_check
    CHECK (content_type IN ('shared_trip')),
  CONSTRAINT content_reports_reason_check
    CHECK (reason IN ('offensive', 'harassment', 'unsafe', 'spam', 'privacy', 'other')),
  CONSTRAINT content_reports_status_check
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON public.content_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_trip
  ON public.content_reports(reported_trip_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_user
  ON public.content_reports(reported_user_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage content reports" ON public.content_reports;
CREATE POLICY "Service role can manage content reports"
  ON public.content_reports
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
