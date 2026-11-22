import { isAllowedAffiliateUrl } from "@faroway/constants";
import { isValidDateOnly } from "@/lib/api/date-range";
import {
  envTrim,
  finalizeAffiliateLink,
  type AffiliateLinkResult,
} from "@/lib/affiliates/types";

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
const OPENTABLE_AID_RE = /^[A-Za-z0-9_-]{1,64}$/;

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
    const aid = envTrim("OPENTABLE_AFFILIATE_ID");
    if (aid && OPENTABLE_AID_RE.test(aid)) {
      url.searchParams.set("aid", aid);
    }
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

export function buildOpenTableSearchUrl(params: {
  restaurantName: string;
  destination?: string;
  date?: string;
  partySize?: number;
}): AffiliateLinkResult {
  const name = params.restaurantName.trim();
  const dest = params.destination?.trim();
  const query = name && dest ? `${name} ${dest}` : name;
  if (!query) {
    return finalizeAffiliateLink({
      partner: "opentable",
      label: "Find a table on OpenTable",
      vertical: "dining",
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  const url = new URL("https://www.opentable.com/s");
  url.searchParams.set("term", query);

  if (
    typeof params.partySize === "number" &&
    Number.isInteger(params.partySize) &&
    params.partySize >= 1
  ) {
    url.searchParams.set("covers", String(Math.min(20, params.partySize)));
  }
  if (params.date && isValidDateOnly(params.date)) {
    url.searchParams.set("dateTime", `${params.date}T19:00`);
  }

  const aid = envTrim("OPENTABLE_AFFILIATE_ID");
  const validAid = aid && OPENTABLE_AID_RE.test(aid) ? aid : undefined;
  if (validAid) {
    url.searchParams.set("aid", validAid);
  }

  return finalizeAffiliateLink({
    partner: "opentable",
    label: "Find a table on OpenTable",
    vertical: "dining",
    url: url.toString(),
    configured: Boolean(validAid),
    isSearchFallback: true,
  });
}

export function buildDiningPartnerLinks(params: {
  restaurantName: string;
  destination?: string;
  date?: string;
  partySize?: number;
  reservationUrl?: string;
  tripadvisorUrl?: string;
}): AffiliateLinkResult[] {
  const links: AffiliateLinkResult[] = [];

  if (params.reservationUrl && isAllowedAffiliateUrl(params.reservationUrl)) {
    links.push(
      finalizeAffiliateLink({
        partner: "opentable",
        label: "Reserve a table on OpenTable",
        vertical: "dining",
        url: params.reservationUrl,
        configured: true,
        isSearchFallback: false,
      }),
    );
  } else {
    const search = buildOpenTableSearchUrl({
      restaurantName: params.restaurantName,
      destination: params.destination,
      date: params.date,
      partySize: params.partySize,
    });
    if (search.url) {
      links.push(search);
    }
  }

  if (params.tripadvisorUrl && isAllowedAffiliateUrl(params.tripadvisorUrl)) {
    links.push(
      finalizeAffiliateLink({
        partner: "tripadvisor",
        label: "View reviews on TripAdvisor",
        vertical: "dining",
        url: params.tripadvisorUrl,
        configured: true,
        isSearchFallback: false,
      }),
    );
  }

  return links;
}
