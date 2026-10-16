-- Disposable, network-isolated PostgreSQL QA substrate, not a product migration.
-- Only columns required by the actual brief/edit/report migrations are represented.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.trips (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  destination TEXT NOT NULL DEFAULT 'Paris',
  start_date DATE NOT NULL DEFAULT '2099-06-01',
  end_date DATE NOT NULL DEFAULT '2099-06-02',
  status TEXT NOT NULL DEFAULT 'planned',
  travelers INTEGER NOT NULL DEFAULT 2,
  budget_tier TEXT DEFAULT 'moderate',
  vibes TEXT[],
  preferences JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  share_token TEXT,
  shared_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  search_id UUID,
  itinerary_id UUID
);
CREATE TABLE public.itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  days JSONB NOT NULL,
  overview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips, public.itineraries TO service_role;
