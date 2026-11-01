import {
  resolveReviewedVenue,
  type ReviewedVenueIdentity,
} from "./venue-identity";
import { travelerAvailability } from "./traveler-availability";
import type { ActivityResult, SearchPlan } from "./types";
import type { ScheduleExclusion } from "./schedule-compiler";
export interface ReviewedVenueHours extends ReviewedVenueIdentity {
  sourceUrl: string;
  sourceSha256: string;
  observedAt: string;
  reviewAfter: string;
  branchReview: string;
  months: number[];
  /** UTC weekday numbers represent local calendar weekdays, not UTC opening times. */
  week: Array<{ weekday: number; intervals: Array<[number, number]> }>;
}
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const slots = {
  morning: [480, 720],
  afternoon: [720, 1080],
  evening: [1080, 1320],
} as const;
function valid(fact: ReviewedVenueHours, asOf: string) {
  try {
    const url = new URL(fact.sourceUrl);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /^[a-f0-9]{64}$/.test(fact.sourceSha256) &&
      !!fact.branchReview.trim() &&
      validDate(fact.observedAt) &&
      validDate(fact.reviewAfter) &&
      fact.observedAt <= asOf &&
      asOf <= fact.reviewAfter &&
      fact.months.length > 0 &&
      fact.months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12) &&
      new Set(fact.week.map((d) => d.weekday)).size === fact.week.length &&
      fact.week.every(
        (d) =>
          Number.isInteger(d.weekday) &&
          d.weekday >= 0 &&
          d.weekday <= 6 &&
          d.intervals.every(
            ([start, end]) =>
              Number.isInteger(start) &&
              Number.isInteger(end) &&
              start >= 0 &&
              end <= 1440 &&
              start < end,
          ),
      )
    );
  } catch {
    return false;
  }
}
/** Negative ordinary-hours evidence only. Compatible slots remain unverified;
 * Dates must be the complete itinerary in order. Special openings, queues,
 * tickets and transfers require separate evidence.
 */
export function reviewedHoursExclusions(
  plan: Pick<SearchPlan, "destination" | "mobilityNeeds" | "requirements">,
  activities: readonly ActivityResult[],
  dates: readonly string[],
  facts: readonly ReviewedVenueHours[],
  asOf = new Date().toISOString().slice(0, 10),
): ScheduleExclusion[] {
  if (!validDate(asOf) || dates.some((d) => !validDate(d)))
    throw Error("Valid review and visit dates required");
  const windows = travelerAvailability(plan, dates.length).windows;
  const exclusions: ScheduleExclusion[] = [];
  for (const activity of activities) {
    const { matches } = resolveReviewedVenue(
      {
        destination: plan.destination,
        name: activity.name,
        address: activity.location.address,
      },
      facts,
      "ordinary_visit",
    );
    if (!matches.length) continue;
    for (const [dayIndex, date] of dates.entries()) {
      const fact = matches[0];
      if (matches.length !== 1 || !valid(fact, asOf)) {
        exclusions.push({
          activityId: activity.id,
          date,
          reason: "venue_hours_source_review_required",
          sourceUrl: fact.sourceUrl,
          observedAt: fact.observedAt,
        });
        continue;
      }
      const calendar = new Date(`${date}T12:00:00Z`);
      if (!fact.months.includes(calendar.getUTCMonth() + 1)) continue;
      const day = fact.week.find((d) => d.weekday === calendar.getUTCDay());
      if (!day) continue;
      for (const [slot, [start, end]] of Object.entries(slots)) {
        // Separate intervals are not added: a visit cannot span a published closure.
        const fits = day.intervals.some(
          ([opens, closes]) =>
            Math.min(end, closes, windows[dayIndex]?.latestMinute ?? 1440) -
              Math.max(start, opens, windows[dayIndex]?.earliestMinute ?? 0) >=
            activity.duration,
        );
        if (!fits)
          exclusions.push({
            activityId: activity.id,
            date,
            slot: slot as ScheduleExclusion["slot"],
            reason: "visit_does_not_fit_published_ordinary_hours",
            sourceUrl: fact.sourceUrl,
            observedAt: fact.observedAt,
          });
      }
    }
  }
  return exclusions;
}
