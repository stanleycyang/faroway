import type { ActivityResult, SearchPlan, SuggestedDay } from "./types";
import {
  reviewedHoursExclusions,
  type ReviewedVenueHours,
} from "./reviewed-venue-hours";
import type { ScheduleExclusion } from "./schedule-compiler";

export interface ReviewedActivitySupply {
  id: string;
  destination: string;
  name: string;
  address: string;
  description: string;
  interests: string[];
  category: string;
  durationMinutes: number;
  sourceUrl: string;
  sourceSha256: string;
  observedAt: string;
  reviewAfter: string;
  validFrom: string;
  validThrough: string;
  excludedDates: string[];
  opens: number;
  closes: number;
  lastEntry: number;
  reviewNotes: string;
}
const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase();
const dateValid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
function valid(record: ReviewedActivitySupply, asOf: string) {
  try {
    const url = new URL(record.sourceUrl);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /^[a-f0-9]{64}$/.test(record.sourceSha256) &&
      [
        record.id,
        record.name,
        record.address,
        record.description,
        record.reviewNotes,
      ].every((v) => v.trim()) &&
      [
        record.observedAt,
        record.reviewAfter,
        record.validFrom,
        record.validThrough,
        ...record.excludedDates,
      ].every(dateValid) &&
      record.observedAt <= asOf &&
      asOf <= record.reviewAfter &&
      record.validFrom <= record.validThrough &&
      [
        record.opens,
        record.closes,
        record.lastEntry,
        record.durationMinutes,
      ].every(Number.isInteger) &&
      record.opens >= 0 &&
      record.opens <= record.lastEntry &&
      record.lastEntry < record.closes &&
      record.closes <= 1440 &&
      record.durationMinutes > 0 &&
      record.durationMinutes <= record.closes - record.opens
    );
  } catch {
    return false;
  }
}
/** Reviewed ordinary supply for the staging compiler, not confirmed reservations.
 * Existing exact-name candidates are not overwritten. Unknown locations
 * use the existing zero sentinel, which the bridge omits from saved coordinates.
 */
export function addReviewedActivitySupply(
  plan: SearchPlan,
  inventory: readonly ActivityResult[],
  dates: readonly string[],
  records: readonly ReviewedActivitySupply[],
  asOf = new Date().toISOString().slice(0, 10),
) {
  if (!dateValid(asOf) || !dates.length || dates.some((d) => !dateValid(d)))
    throw Error("Valid review and itinerary dates required");
  const activities = [...inventory];
  const exclusions: ScheduleExclusion[] = [];
  const admitted: ReviewedActivitySupply[] = [];
  for (const record of records) {
    if (
      !valid(record, asOf) ||
      normalize(record.destination) !== normalize(plan.destination) ||
      !record.interests.some((interest) =>
        plan.activityCriteria.interests.some(
          (i) => normalize(i) === normalize(interest),
        ),
      ) ||
      !dates.some(
        (d) =>
          d >= record.validFrom &&
          d <= record.validThrough &&
          !record.excludedDates.includes(d),
      ) ||
      records.filter(
        (r) =>
          r.id === record.id ||
          (normalize(r.destination) === normalize(record.destination) &&
            normalize(r.name) === normalize(record.name)),
      ).length !== 1
    )
      continue;
    // A colliding unrelated inventory ID cannot acquire this source's evidence.
    if (
      activities.some(
        (a) =>
          a.id === record.id && normalize(a.name) !== normalize(record.name),
      )
    )
      continue;
    if (activities.some((a) => normalize(a.name) === normalize(record.name)))
      continue;
    const candidate: ActivityResult = {
      id: record.id,
      name: record.name,
      description: record.description,
      category: record.category,
      duration: record.durationMinutes,
      proposedVisitType: "ordinary_entry",
      price: 0,
      currency: "",
      priceStatus: "unknown",
      rating: 0,
      reviewCount: 0,
      location: { name: record.name, address: record.address, lat: 0, lng: 0 },
      images: [],
      bestTimeOfDay: "any",
      vibeScore: 60,
      vibeMatch: [],
      bookingRequired: true,
    };
    activities.push(candidate);
    admitted.push(record);
    const fact: ReviewedVenueHours = {
      id: record.id,
      destination: record.destination,
      aliases: [record.name],
      addresses: [record.address],
      sourceUrl: record.sourceUrl,
      sourceSha256: record.sourceSha256,
      observedAt: record.observedAt,
      reviewAfter: record.reviewAfter,
      branchReview: record.reviewNotes,
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      week: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        intervals: [
          [
            record.opens,
            Math.min(record.closes, record.lastEntry + record.durationMinutes),
          ],
        ],
      })),
    };
    exclusions.push(
      ...reviewedHoursExclusions(plan, [candidate], dates, [fact], asOf),
    );
    // The compiler chooses day parts, not source-bound start times. Admit only
    // day parts whose entire possible visit-start range respects these hours.
    // This prevents another selected visit/dinner from pushing this one past
    // last admission. Partial-slot openings need a future exact-time solver.
    for (const date of dates) {
      for (const [slot, start, end] of [
        ["morning", 480, 720],
        ["afternoon", 720, 1080],
        ["evening", 1080, 1320],
      ] as const) {
        if (
          record.opens > start ||
          record.closes < end ||
          record.lastEntry < end - record.durationMinutes
        )
          exclusions.push({
            activityId: record.id,
            date,
            slot,
            reason: "source_hours_do_not_cover_day_part",
            sourceUrl: record.sourceUrl,
            observedAt: record.observedAt,
          });
      }
    }
    for (const date of dates)
      if (
        date < record.validFrom ||
        date > record.validThrough ||
        record.excludedDates.includes(date)
      )
        exclusions.push({
          activityId: record.id,
          date,
          reason: "outside_reviewed_activity_dates",
          sourceUrl: record.sourceUrl,
          observedAt: record.observedAt,
        });
  }
  return { activities, exclusions, admitted };
}

export function appendActivitySourceNotes(
  days: SuggestedDay[],
  records: readonly ReviewedActivitySupply[],
) {
  for (const day of days)
    for (const record of records) {
      if (
        ![
          ...day.morning.activities,
          ...day.afternoon.activities,
          ...day.evening.activities,
        ].some((a) => a.id === record.id)
      )
        continue;
      day.tips.push(
        `${record.name}: operator information reviewed ${record.observedAt}. Allow about ${record.durationMinutes} minutes as a planning estimate. Check tickets, current hours and travel time before going. Source: ${record.sourceUrl}`,
      );
    }
}
