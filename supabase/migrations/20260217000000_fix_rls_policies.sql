-- Fix overly permissive INSERT RLS policies
-- These policies used WITH CHECK (true) which allows ANY user to insert,
-- but they should be restricted to service_role only.

-- search_results: Only service role can insert
DROP POLICY IF EXISTS "Service can insert results" ON search_results;
CREATE POLICY "Service can insert results" ON search_results
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- search_itineraries: Only service role can insert
DROP POLICY IF EXISTS "Service can insert itineraries" ON search_itineraries;
CREATE POLICY "Service can insert itineraries" ON search_itineraries
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- affiliate_conversions: Only service role can insert (webhooks)
DROP POLICY IF EXISTS "Service can insert conversions" ON affiliate_conversions;
CREATE POLICY "Service can insert conversions" ON affiliate_conversions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- affiliate_clicks: Keep open insert for anonymous tracking (required for functionality)
-- Rate limiting is enforced at the API layer (10 req/min per IP)
