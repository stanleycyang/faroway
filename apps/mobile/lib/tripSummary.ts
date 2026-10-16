import type { Trip } from '../stores/tripStore';

/** A summary omits plan details; only an identical server revision can reuse them. */
export function retainTripDetail(
  summary: Trip,
  cached: Trip | undefined,
  omitsItinerary: boolean
): Trip {
  if (
    omitsItinerary &&
    !summary.planNeedsRefresh &&
    summary.updatedAt &&
    cached?.id === summary.id &&
    cached.updatedAt === summary.updatedAt
  ) {
    return { ...summary, days: cached.days, hotel: cached.hotel };
  }
  return summary;
}
