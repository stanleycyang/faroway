# Faroway Product-Market-Fit Measurement and Experiment Plan

**Updated:** 2026-07-25
**Status:** Instrumentation ready; evidence collection begins at soft launch.

Product-market fit cannot be declared from a release checklist. Faroway should
earn that conclusion from repeated user behavior, usefulness feedback, and
economically meaningful partner conversions. This document defines those
signals before launch so the team does not move the goalposts after seeing the
data.

## Measurement foundation

Faroway uses first-party operational data instead of a third-party behavioral
tracker:

| Signal       | Durable source                                     | Product question                                |
| ------------ | -------------------------------------------------- | ----------------------------------------------- |
| Acquisition  | `users.created_at`                                 | How many people create an account?              |
| Intent       | `searches.created_at`                              | How many start planning a real trip?            |
| Activation   | first `itineraries.generated_at`                   | Did they receive core value?                    |
| Reliability  | `searches.status`, `completed_at`, `error_message` | Did the promise work?                           |
| Engagement   | repeat searches, `trips.shared_at`                 | Did they return or share value?                 |
| Monetization | `affiliate_clicks`, `affiliate_conversions`        | Did plans lead to partner action?               |
| Satisfaction | `trip_feedback`                                    | Was the result useful, and would they reuse it? |

Migration `20260725006000_product_feedback_and_metrics.sql` adds the feedback
table and three service-role-only views:

- `analytics.product_funnel_daily`
- `analytics.activation_daily`
- `analytics.retention_weekly`

The analytics schema is not available to anonymous or authenticated clients.
It is intended for the Supabase SQL editor or a tightly controlled internal
dashboard using the service role.

## Metric definitions

### North-star metric

**Weekly Activated Planners (WAP):** unique users who receive at least one
generated itinerary during the week.

This measures delivery of Faroway's core promise. It is paired with
generation-success and feedback guardrails so a low-quality itinerary cannot
inflate the metric.

### Funnel and quality metrics

| Metric                      | Definition                                                   | Initial soft-launch target        |
| --------------------------- | ------------------------------------------------------------ | --------------------------------- |
| 24-hour activation          | New users whose first itinerary is generated within 24 hours | ≥ 40%                             |
| Generation success          | Completed searches / searches started                        | ≥ 95%                             |
| Median time to value        | Search start to itinerary completion                         | ≤ 60 seconds                      |
| W1 activated-user retention | Activated users who start another search in week 1           | ≥ 20%                             |
| W4 activated-user retention | Activated users who start another search in week 4           | ≥ 12%                             |
| Share rate                  | Activated users who enable a share link                      | ≥ 15%                             |
| Positive usefulness         | Feedback scores of 4–5 / all feedback                        | ≥ 60%                             |
| Reuse intent                | “Would use Faroway again” yes / answered                     | ≥ 50%                             |
| Affiliate click-through     | Activated users with an affiliate click                      | Baseline first; then improve      |
| Booking conversion          | Confirmed bookings / affiliate clicks                        | Baseline first; partner-dependent |

Travel planning is episodic, so weekly retention alone is not a PMF verdict.
Share rate, saved-trip revisits, reuse intent, and a quarterly “very
disappointed if Faroway disappeared” survey should be read together.

### Guardrails

- Search failure rate must remain below 5%.
- P95 generation time must remain below 90 seconds.
- Content reports must remain below 1% of public shared trips.
- Average feedback must not fall below 3.5/5.
- No experiment may weaken authentication, RLS, privacy disclosures, or
  affiliate-link transparency.

## Operating queries

Run these with a service-role SQL session:

```sql
SELECT *
FROM analytics.product_funnel_daily
WHERE day >= CURRENT_DATE - 30
ORDER BY day;
```

```sql
SELECT *
FROM analytics.activation_daily
WHERE signup_day >= CURRENT_DATE - 30
ORDER BY signup_day;
```

```sql
SELECT *
FROM analytics.retention_weekly
ORDER BY cohort_week DESC, week_number;
```

Top qualitative failure themes:

```sql
SELECT
  tag,
  COUNT(*) AS mentions,
  ROUND(AVG(score), 2) AS average_score
FROM trip_feedback, UNNEST(issue_tags) AS tag
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tag
ORDER BY mentions DESC;
```

Generation time and reliability:

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'completed')::numeric
    / NULLIF(COUNT(*), 0) AS success_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))
  ) FILTER (WHERE status = 'completed') AS median_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))
  ) FILTER (WHERE status = 'completed') AS p95_seconds
FROM searches
WHERE created_at >= NOW() - INTERVAL '7 days';
```

## Experiment backlog

Experiments run one primary product change at a time. Before starting, record
the hypothesis, primary metric, guardrails, start date, and stopping rule.
Unless traffic makes this impractical, run for at least 14 days and collect at
least 100 activated users per variant. Do not stop early only because a result
looks favorable.

### E1 — Faster first value

- Hypothesis: reducing required create-trip choices increases 24-hour
  activation without lowering feedback.
- Variant: destination and dates first; defer optional preferences.
- Primary metric: 24-hour activation.
- Guardrails: generation success, average score, budget-mismatch tag rate.

### E2 — Visible personalization proof

- Hypothesis: showing which selected vibes influenced each recommendation
  improves usefulness and reuse intent.
- Variant: add concise “picked for your … vibe” explanations.
- Primary metric: reuse intent.
- Guardrails: generation latency and generic/incorrect feedback tags.

### E3 — Collaborative sharing

- Hypothesis: a clearer post-generation share prompt increases organic
  acquisition.
- Variant: current share card versus a collaboration-oriented prompt.
- Primary metric: share rate.
- Guardrails: content-report rate and activation.

### E4 — Contextual partner handoff

- Hypothesis: timing booking calls to action after itinerary review improves
  qualified affiliate clicks without making Faroway feel transactional.
- Variant: current placement versus a single contextual “check availability”
  action after the relevant day.
- Primary metric: affiliate clicks per activated user.
- Guardrails: feedback score, reuse intent, and outbound-link error rate.

## Qualitative cadence

- Review every low score and its tags weekly.
- Interview five recently activated users and five users who started but did
  not activate each month.
- Ask users to screen-share their planning process; avoid pitching during the
  session.
- After a user has generated at least two itineraries, ask the PMF survey:
  “How would you feel if you could no longer use Faroway?” Track the percentage
  answering “Very disappointed”; 40% is a strong directional signal, not an
  automatic declaration.

## Decision gates

### Soft launch

Proceed when all technical launch blockers in `PROD_AUDIT.md` are closed or
explicitly accepted, production generation succeeds end to end, and feedback
collection is live.

### Broader acquisition spend

Do not increase paid acquisition until at least two consecutive weekly cohorts
meet the activation and quality targets and generation success is at least 95%.

### PMF evidence threshold

Treat PMF as credible only after:

1. Four consecutive activated cohorts meet the retention target.
2. At least 100 completed feedback responses meet positive-usefulness and reuse
   intent targets.
3. At least 40% of eligible repeat users answer “Very disappointed” in the PMF
   survey, with the audience and sample size documented.
4. Qualitative interviews identify a repeatable primary use case and user
   segment.
5. Partner conversion economics show a plausible path to covering variable
   itinerary-generation cost.

Until those conditions are measured, the correct status is
**“production-capable, PMF evidence collecting,”** not “at product-market fit.”
