-- First-party product feedback and restricted PMF metric views.
-- No cookies, cross-site identifiers, raw IPs, or third-party analytics are used.

CREATE TABLE IF NOT EXISTS public.trip_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  would_use_again BOOLEAN,
  issue_tags TEXT[] NOT NULL DEFAULT '{}',
  comment TEXT,
  source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'mobile')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_feedback_comment_length CHECK (
    comment IS NULL OR char_length(comment) <= 1000
  ),
  CONSTRAINT trip_feedback_one_per_user UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_feedback_user_created
  ON public.trip_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_feedback_score_created
  ON public.trip_feedback(score, created_at DESC);

ALTER TABLE public.trip_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trip feedback"
  ON public.trip_feedback;
CREATE POLICY "Users can view own trip feedback"
  ON public.trip_feedback
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can submit own trip feedback"
  ON public.trip_feedback;
CREATE POLICY "Users can submit own trip feedback"
  ON public.trip_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.trips
      WHERE public.trips.id = trip_feedback.trip_id
        AND public.trips.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own trip feedback"
  ON public.trip_feedback;
CREATE POLICY "Users can update own trip feedback"
  ON public.trip_feedback
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.set_trip_feedback_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_trip_feedback_updated_at
  ON public.trip_feedback;
CREATE TRIGGER set_trip_feedback_updated_at
  BEFORE UPDATE ON public.trip_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trip_feedback_updated_at();

COMMENT ON TABLE public.trip_feedback IS
  'Structured, first-party usefulness feedback for generated itineraries.';

CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA analytics TO service_role;

CREATE OR REPLACE VIEW analytics.product_funnel_daily
WITH (security_invoker = true)
AS
WITH calendar AS (
  SELECT created_at::date AS day FROM public.users
  UNION
  SELECT created_at::date FROM public.searches
  UNION
  SELECT generated_at::date FROM public.itineraries
  UNION
  SELECT shared_at::date FROM public.trips WHERE shared_at IS NOT NULL
  UNION
  SELECT clicked_at::date FROM public.affiliate_clicks
  UNION
  SELECT COALESCE(conversion_date, created_at)::date
    FROM public.affiliate_conversions
  UNION
  SELECT created_at::date FROM public.trip_feedback
),
signups AS (
  SELECT created_at::date AS day, COUNT(*) AS new_users
  FROM public.users
  GROUP BY 1
),
search_activity AS (
  SELECT
    created_at::date AS day,
    COUNT(*) AS searches_started,
    COUNT(*) FILTER (WHERE status = 'completed') AS searches_completed,
    COUNT(DISTINCT user_id) AS active_users
  FROM public.searches
  GROUP BY 1
),
activations AS (
  SELECT
    i.generated_at::date AS day,
    COUNT(*) AS itineraries_generated,
    COUNT(DISTINCT t.user_id) AS activated_users
  FROM public.itineraries i
  JOIN public.trips t ON t.id = i.trip_id
  GROUP BY 1
),
shares AS (
  SELECT
    shared_at::date AS day,
    COUNT(*) AS trips_shared,
    COUNT(DISTINCT user_id) AS sharing_users
  FROM public.trips
  WHERE shared_at IS NOT NULL
  GROUP BY 1
),
clicks AS (
  SELECT
    clicked_at::date AS day,
    COUNT(*) AS affiliate_clicks,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)
      AS affiliate_clickers
  FROM public.affiliate_clicks
  GROUP BY 1
),
conversions AS (
  SELECT
    COALESCE(conversion_date, created_at)::date AS day,
    COUNT(*) AS affiliate_conversions,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)
      AS converting_users,
    COALESCE(SUM(booking_value), 0) AS booking_value,
    COALESCE(SUM(commission_value), 0) AS commission_value
  FROM public.affiliate_conversions
  GROUP BY 1
),
feedback AS (
  SELECT
    created_at::date AS day,
    COUNT(*) AS feedback_responses,
    ROUND(AVG(score), 2) AS average_feedback_score,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE would_use_again)
      / NULLIF(COUNT(*) FILTER (WHERE would_use_again IS NOT NULL), 0),
      2
    ) AS reuse_intent_rate
  FROM public.trip_feedback
  GROUP BY 1
)
SELECT
  calendar.day,
  COALESCE(signups.new_users, 0) AS new_users,
  COALESCE(search_activity.active_users, 0) AS active_users,
  COALESCE(search_activity.searches_started, 0) AS searches_started,
  COALESCE(search_activity.searches_completed, 0) AS searches_completed,
  COALESCE(activations.itineraries_generated, 0)
    AS itineraries_generated,
  COALESCE(activations.activated_users, 0) AS activated_users,
  COALESCE(shares.trips_shared, 0) AS trips_shared,
  COALESCE(shares.sharing_users, 0) AS sharing_users,
  COALESCE(clicks.affiliate_clicks, 0) AS affiliate_clicks,
  COALESCE(clicks.affiliate_clickers, 0) AS affiliate_clickers,
  COALESCE(conversions.affiliate_conversions, 0)
    AS affiliate_conversions,
  COALESCE(conversions.converting_users, 0) AS converting_users,
  COALESCE(conversions.booking_value, 0) AS booking_value,
  COALESCE(conversions.commission_value, 0) AS commission_value,
  COALESCE(feedback.feedback_responses, 0) AS feedback_responses,
  feedback.average_feedback_score,
  feedback.reuse_intent_rate
FROM calendar
LEFT JOIN signups USING (day)
LEFT JOIN search_activity USING (day)
LEFT JOIN activations USING (day)
LEFT JOIN shares USING (day)
LEFT JOIN clicks USING (day)
LEFT JOIN conversions USING (day)
LEFT JOIN feedback USING (day)
ORDER BY calendar.day DESC;

CREATE OR REPLACE VIEW analytics.activation_daily
WITH (security_invoker = true)
AS
WITH first_activation AS (
  SELECT
    t.user_id,
    MIN(i.generated_at) AS activated_at
  FROM public.itineraries i
  JOIN public.trips t ON t.id = i.trip_id
  WHERE t.user_id IS NOT NULL
  GROUP BY t.user_id
)
SELECT
  u.created_at::date AS signup_day,
  COUNT(*) AS signups,
  COUNT(*) FILTER (
    WHERE first_activation.activated_at <= u.created_at + INTERVAL '24 hours'
  ) AS activated_within_24h,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE first_activation.activated_at <= u.created_at + INTERVAL '24 hours'
    ) / NULLIF(COUNT(*), 0),
    2
  ) AS activation_rate_24h
FROM public.users u
LEFT JOIN first_activation ON first_activation.user_id = u.id
GROUP BY 1
ORDER BY signup_day DESC;

CREATE OR REPLACE VIEW analytics.retention_weekly
WITH (security_invoker = true)
AS
WITH activated AS (
  SELECT
    t.user_id,
    DATE_TRUNC('week', MIN(i.generated_at))::date AS cohort_week
  FROM public.itineraries i
  JOIN public.trips t ON t.id = i.trip_id
  WHERE t.user_id IS NOT NULL
  GROUP BY t.user_id
),
activity AS (
  SELECT DISTINCT
    user_id,
    DATE_TRUNC('week', created_at)::date AS activity_week
  FROM public.searches
  WHERE user_id IS NOT NULL
),
cohort_sizes AS (
  SELECT cohort_week, COUNT(*) AS cohort_size
  FROM activated
  GROUP BY cohort_week
)
SELECT
  activated.cohort_week,
  activity.activity_week,
  (
    (activity.activity_week - activated.cohort_week) / 7
  )::integer AS week_number,
  cohort_sizes.cohort_size,
  COUNT(DISTINCT activated.user_id) AS retained_users,
  ROUND(
    100.0 * COUNT(DISTINCT activated.user_id)
    / NULLIF(cohort_sizes.cohort_size, 0),
    2
  ) AS retention_rate
FROM activated
JOIN activity
  ON activity.user_id = activated.user_id
 AND activity.activity_week >= activated.cohort_week
JOIN cohort_sizes USING (cohort_week)
GROUP BY
  activated.cohort_week,
  activity.activity_week,
  cohort_sizes.cohort_size
ORDER BY activated.cohort_week DESC, activity.activity_week;

REVOKE ALL ON ALL TABLES IN SCHEMA analytics
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO service_role;

COMMENT ON VIEW analytics.product_funnel_daily IS
  'Daily acquisition, activation, engagement, conversion, revenue, and feedback metrics.';
COMMENT ON VIEW analytics.activation_daily IS
  'Signup cohorts and first-itinerary activation within 24 hours.';
COMMENT ON VIEW analytics.retention_weekly IS
  'Activated-user weekly search retention by activation cohort.';
