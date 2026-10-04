-- STAGING-ONLY SUPPLEMENT. Review separately; not a production migration.
-- Automatic table exposure is off. Grant only the application surfaces below.
-- Do not replace with GRANT ALL TO anon/authenticated.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated;

-- Public discovery. Existing RLS restricts blog_posts to published content.
GRANT SELECT ON public.destinations,public.blog_posts TO anon,authenticated;
-- Authenticated reads still require the existing row-level ownership policies.
GRANT SELECT ON public.users,public.trips,public.itineraries,public.saved_activities,
  public.searches,public.search_results,public.search_itineraries,
  public.workflow_runs,public.workflow_progress,public.notifications,
  public.affiliate_clicks,public.affiliate_conversions,public.push_tokens,
  public.trip_feedback TO authenticated;
GRANT UPDATE(display_name,avatar_url,preferences,notification_settings) ON public.users TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.trips,public.saved_activities,public.push_tokens TO authenticated;
GRANT UPDATE(read) ON public.notifications TO authenticated;
GRANT INSERT ON public.trip_feedback TO authenticated;
GRANT UPDATE(score,would_use_again,issue_tags,comment,source) ON public.trip_feedback TO authenticated;
-- No direct client itinerary/search writes; server fences and APIs own them.
-- Newsletter/view/report inserts go through existing rate-limited server routes.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.users,public.trips,public.itineraries,
  public.saved_activities,public.searches,public.search_results,public.search_itineraries,
  public.workflow_runs,public.workflow_progress,public.notifications,public.realtime_events,
  public.affiliate_clicks,public.affiliate_conversions,public.newsletter_subscribers,
  public.blog_post_views,public.blog_posts,public.destinations,public.push_tokens,
  public.content_reports,public.rate_limit_buckets,public.trip_feedback,
  public.met_weather_cache TO service_role;
-- Preserve PR26's append-only service permissions and server-only global view.
REVOKE ALL ON public.trip_plan_revisions,public.trip_booking_reports FROM service_role;
GRANT SELECT,INSERT ON public.trip_plan_revisions,public.trip_booking_reports TO service_role;
GRANT USAGE ON SEQUENCE public.trip_booking_reports_sequence_seq TO service_role;
GRANT SELECT ON public.affiliate_stats TO service_role;
GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO service_role;

-- Do not leave legacy SECURITY DEFINER aggregates/mutations as public RPCs.
-- Existing destination/blog API callers use the server client (service_role).
ALTER FUNCTION public.get_destination_trip_counts(TIMESTAMPTZ) SET search_path=public,pg_temp;
ALTER FUNCTION public.get_destination_search_counts(TIMESTAMPTZ) SET search_path=public,pg_temp;
ALTER FUNCTION public.increment_blog_view_count(TEXT) SET search_path=public,pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path=public,pg_temp;
-- Deny direct RPC access to every current application function, including old
-- invoker cleanup helpers; grant server execution explicitly. Exclude extension
-- members so platform/extension API permissions are not rewritten.
DO $$ DECLARE f RECORD;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(
      SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;
-- Existing Auth trigger can still execute as its trusted owner. No grants or
-- schema changes are made to auth or storage platform objects by this supplement.
