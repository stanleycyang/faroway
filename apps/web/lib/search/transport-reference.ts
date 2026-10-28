import type { TransportResult, TripDayTransport } from "@faroway/types";

/** Legacy projections have no identity: only a unique match is safe to restore. */
export function matchesTransportProjection(
  candidate: TransportResult,
  selected: TripDayTransport,
): boolean {
  return (
    (
      ["type", "provider", "duration", "stops", "price", "currency"] as const
    ).every((key) => candidate[key] === selected[key]) &&
    (["departure", "arrival"] as const).every((endpoint) =>
      (["airport", "city", "dateTime"] as const).every(
        (key) => candidate[endpoint]?.[key] === selected[endpoint]?.[key],
      ),
    ) &&
    (["affiliateUrl", "affiliatePartner", "expiresAt"] as const).every(
      (key) => (candidate[key] || undefined) === (selected[key] || undefined),
    )
  );
}
