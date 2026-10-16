import type { Trip } from '../stores/tripStore';

/** Prefer full detail unless the list has evidence of a newer server revision. */
export function selectTripDetail(
  id: string | undefined,
  trips: Trip[],
  currentTrip: Trip | null
): Trip | undefined {
  const listedTrip = trips.find((trip) => trip.id === id);
  if (!currentTrip || currentTrip.id !== id) return listedTrip;

  const listRevision = Date.parse(listedTrip?.updatedAt ?? '');
  const detailRevision = Date.parse(currentTrip.updatedAt ?? '');
  if (
    Number.isFinite(listRevision) &&
    (!Number.isFinite(detailRevision) || listRevision > detailRevision)
  ) {
    return listedTrip;
  }
  return currentTrip;
}

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
