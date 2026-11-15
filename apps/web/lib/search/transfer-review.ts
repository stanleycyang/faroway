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
