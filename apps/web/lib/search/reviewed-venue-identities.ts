import {
  resolveReviewedVenue,
  reviewedVenueAddressMatches,
  type ReviewedVenueIdentity,
} from "./venue-identity";
import type { ActivityResult, SearchPlan } from "./types";
import type { ScheduleExclusion } from "./schedule-compiler";

export interface ReviewedIdentityEvidence extends ReviewedVenueIdentity {
  sourceUrl: string;
  sourceSha256: string;
  observedAt: string;
  reviewAfter: string;
  reviewNotes: string;
}
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
function fresh(record: ReviewedIdentityEvidence, asOf: string) {
  try {
    const url = new URL(record.sourceUrl);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /^[a-f0-9]{64}$/.test(record.sourceSha256) &&
      !!record.reviewNotes.trim() &&
      validDate(record.observedAt) &&
      validDate(record.reviewAfter) &&
      record.observedAt <= asOf &&
      asOf <= record.reviewAfter
    );
  } catch {
    return false;
  }
}

/** Address-only collisions require review, not inferred opening hours or identity.
 * A matching identity is not evidence that its activity is suitable or available.
 */
export function reviewedIdentityExclusions(
  plan: Pick<SearchPlan, "destination">,
  activities: readonly ActivityResult[],
  dates: readonly string[],
  records: readonly ReviewedIdentityEvidence[],
  asOf = new Date().toISOString().slice(0, 10),
): ScheduleExclusion[] {
  if (!validDate(asOf) || dates.some((date) => !validDate(date)))
    throw Error("Valid review and itinerary dates required");
  const evidence = records.filter((record) => fresh(record, asOf));
  return activities.flatMap((activity) => {
    const candidate = {
      destination: plan.destination,
      name: activity.name,
      address: activity.location.address,
    };
    if (
      resolveReviewedVenue(candidate, evidence, "ordinary_visit").status ===
      "matched"
    )
      return [];
    const collision = reviewedVenueAddressMatches(candidate, evidence)[0];
    if (!collision) return [];
    return dates.map((date) => ({
      activityId: activity.id,
      date,
      reason: "venue_identity_requires_review",
      sourceUrl: collision.sourceUrl,
      observedAt: collision.observedAt,
    }));
  });
}
