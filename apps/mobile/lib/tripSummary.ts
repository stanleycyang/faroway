import type { Trip } from '../stores/tripStore';

function tripRevision(value: string | undefined) {
  const milliseconds = Date.parse(value ?? '');
  if (!Number.isFinite(milliseconds)) return null;
  // Date.parse normalizes the offset, but truncates fractions to milliseconds.
  // Compare whole seconds and the original fractional digits independently.
  const seconds = Math.floor(milliseconds / 1000);
  const fraction =
    /[Tt ]\d{2}:\d{2}:\d{2}\.(\d+)(?:[Zz]|[+-]\d{2}:?\d{2})$/.exec(value?.trim() ?? '')?.[1] ??
    String(milliseconds - seconds * 1000).padStart(3, '0');
  return { seconds, fraction: fraction.replace(/0+$/, '') };
}

/** Prefer full detail unless the list has evidence of a newer server revision. */
export function selectTripDetail(
  id: string | undefined,
  trips: Trip[],
  currentTrip: Trip | null
): Trip | undefined {
  const listedTrip = trips.find((trip) => trip.id === id);
  if (!currentTrip || currentTrip.id !== id) return listedTrip;

  const listRevision = tripRevision(listedTrip?.updatedAt);
  const detailRevision = tripRevision(currentTrip.updatedAt);
  if (
    listRevision &&
    (!detailRevision ||
      listRevision.seconds > detailRevision.seconds ||
      (listRevision.seconds === detailRevision.seconds &&
        listRevision.fraction > detailRevision.fraction))
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
