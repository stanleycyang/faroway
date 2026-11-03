import { readVenueSource, type VenueSource } from "@faroway/types";
import { resolveReviewedVenue } from "./venue-identity";
import {
  reviewedHoursCoverVisitScope,
  type ReviewedVenueHours,
} from "./reviewed-venue-hours";
import type { ReviewedActivitySupply } from "./reviewed-activity-supply";
import type { ActivityResult } from "./types";

/** Attach attribution only after a joint reviewed identity match. A source link
 * is not a claim that the visit, route, access or ticket has been verified.
 */
export function withReviewedActivitySources(
  destination: string,
  activities: readonly ActivityResult[],
  hours: readonly ReviewedVenueHours[],
  supply: readonly ReviewedActivitySupply[],
  asOf = new Date().toISOString().slice(0, 10),
): Array<ActivityResult & { source?: VenueSource }> {
  return activities.map((activity) => {
    // Do not attribute our research to vendor inventory or replace its source.
    if (activity.affiliatePartner || activity.affiliateUrl) return activity;
    const unattributed = { ...activity, source: undefined };
    const supplied = supply.filter(
      (record) =>
        record.id === activity.id &&
        record.destination === destination &&
        record.name === activity.name &&
        record.address === activity.location.address,
    );
    const matched =
      activity.proposedVisitType === "ordinary_entry" ||
      activity.proposedVisitType === "exterior_walk"
        ? resolveReviewedVenue(
            {
              destination,
              name: activity.name,
              address: activity.location.address,
            },
            hours,
            "ordinary_visit",
          ).matches.filter((fact) =>
            reviewedHoursCoverVisitScope(fact, activity.proposedVisitType),
          )
        : [];
    const records = supplied.length ? supplied : matched;
    if (records.length !== 1) return unattributed;
    const record = records[0];
    if (
      record.observedAt > asOf ||
      record.reviewAfter < asOf ||
      !readVenueSource({
        url: record.sourceUrl,
        retrievedOn: record.reviewAfter,
      })
    )
      return unattributed;
    const source = readVenueSource({
      url: record.sourceUrl,
      retrievedOn: record.observedAt,
    });
    return source ? { ...activity, source } : unattributed;
  });
}
