/**
 * Dining reservation links.
 *
 * The model is not a source of OpenTable restaurant ids. A link is emitted
 * only when it is constructed from a numeric OpenTable restaurant id or when
 * a caller has already verified that exact OpenTable reservation URL.
 */

export type ReservationEvidence =
  | { kind: "none" }
  | { kind: "opentable_rid"; restaurantId: string }
  | { kind: "verified_head"; url: string; ok: boolean };

const RID = /^\d{3,12}$/;

export function isOpenTableReservationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return false;
    if (
      url.hostname !== "www.opentable.com" &&
      url.hostname !== "opentable.com"
    )
      return false;
    if (/^\/booking\/restref\/availability\/?$/i.test(url.pathname)) {
      return RID.test(url.searchParams.get("rid") || "");
    }
    return (
      /^\/r\/[a-z0-9-]+\/?$/i.test(url.pathname) ||
      /^\/restaurant\/profile\/\d+\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function reservationUrlFromEvidence(
  modelUrl: string | undefined,
  evidence: ReservationEvidence = { kind: "none" },
): string | undefined {
  if (evidence.kind === "opentable_rid") {
    if (!RID.test(evidence.restaurantId)) return undefined;
    const url = new URL(
      "https://www.opentable.com/booking/restref/availability",
    );
    url.searchParams.set("rid", evidence.restaurantId);
    return url.toString();
  }
  if (evidence.kind === "verified_head") {
    if (!evidence.ok || !isOpenTableReservationUrl(evidence.url))
      return undefined;
    if (modelUrl && modelUrl !== evidence.url) return undefined;
    return evidence.url;
  }
  return undefined;
}
