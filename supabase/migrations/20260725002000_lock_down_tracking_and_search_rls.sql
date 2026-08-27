-- Anonymous generation was removed from the product. Tighten historical RLS
-- policies that allowed direct anon-key writes and reads outside the API.

DROP POLICY IF EXISTS "Users can create searches" ON public.searches;
CREATE POLICY "Users can create own searches"
  ON public.searches
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own searches" ON public.searches;
CREATE POLICY "Users can view own searches"
  ON public.searches
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own searches" ON public.searches;
CREATE POLICY "Users can update own searches"
  ON public.searches
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view search results" ON public.search_results;
CREATE POLICY "Users can view search results"
  ON public.search_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.searches
      WHERE public.searches.id = public.search_results.search_id
        AND public.searches.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view search itineraries"
  ON public.search_itineraries;
CREATE POLICY "Users can view search itineraries"
  ON public.search_itineraries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.searches
      WHERE public.searches.id = public.search_itineraries.search_id
        AND public.searches.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.affiliate_clicks;
CREATE POLICY "Service role can insert clicks"
  ON public.affiliate_clicks
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Users can view own clicks" ON public.affiliate_clicks;
CREATE POLICY "Users can view own clicks"
  ON public.affiliate_clicks
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own conversions"
  ON public.affiliate_conversions;
CREATE POLICY "Users can view own conversions"
  ON public.affiliate_conversions
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON FUNCTION public.cleanup_expired_anonymous_trips()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_anonymous_trips()
  TO service_role;
