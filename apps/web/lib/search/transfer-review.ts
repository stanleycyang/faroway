import { suppliedDistanceKm } from "./supplied-distance";

/** The timing model reserves 30 minutes between events. That buffer is not a
 * route. At 4 km/h it covers 2 km; anything farther needs an explicit review. */
export const PLANNING_BUFFER_MINUTES = 30;
export const PLANNING_BUFFER_KM = (PLANNING_BUFFER_MINUTES / 60) * 4;

export function transferExceedsPlanningBuffer(distanceKm: number) {
  return Number.isFinite(distanceKm) && distanceKm > PLANNING_BUFFER_KM;
}

export interface TransferEndpoint {
  name: string;
  location: unknown;
}

/** Breakfast, morning visits, lunch, afternoon visits, evening visits, dinner.
 * That is the order the timing model proposes, not the slot's stored layout. */
export function chronologicalStops(day: {
  morning: { activities: readonly TransferEndpoint[]; meal?: TransferEndpoint };
  afternoon: {
    activities: readonly TransferEndpoint[];
    meal?: TransferEndpoint;
  };
  evening: { activities: readonly TransferEndpoint[]; meal?: TransferEndpoint };
}): TransferEndpoint[] {
  return [
    ...(day.morning.meal ? [day.morning.meal] : []),
    ...day.morning.activities,
    ...(day.afternoon.meal ? [day.afternoon.meal] : []),
    ...day.afternoon.activities,
    ...day.evening.activities,
    ...(day.evening.meal ? [day.evening.meal] : []),
  ].map((item) => ({ name: item.name, location: item.location }));
}

export function reviewSuppliedTransfers(stops: readonly TransferEndpoint[]) {
  const findings: Array<{ from: string; to: string; distanceKm: number }> = [];
  for (let index = 1; index < stops.length; index++) {
    const distanceKm = suppliedDistanceKm(
      stops[index - 1].location,
      stops[index].location,
    );
    if (distanceKm != null && transferExceedsPlanningBuffer(distanceKm))
      findings.push({
        from: stops[index - 1].name,
        to: stops[index].name,
        distanceKm,
      });
  }
  return findings;
}

export function transferReviewTip(finding: {
  from: string;
  to: string;
  distanceKm: number;
}) {
  return `${finding.from} and ${finding.to} are about ${finding.distanceKm.toFixed(1)} km apart on the supplied coordinates. The 30-minute planning buffer does not show that this transfer fits. Confirm the route; this is not a measured journey.`;
}
