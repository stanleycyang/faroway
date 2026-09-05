/** Canonical identities shared by click validation and legacy conversions. */
export type AffiliatePartnerKey =
  | "viator"
  | "booking"
  | "getyourguide"
  | "tripadvisor"
  | "discovercars"
  | "hostelworld"
  | "duffel"
  | "opentable"
  | "klook";

const PARTNER_ALIASES = new Map<string, AffiliatePartnerKey>([
  ["viator", "viator"],
  ["booking", "booking"],
  ["bookingcom", "booking"],
  ["getyourguide", "getyourguide"],
  ["tripadvisor", "tripadvisor"],
  ["discovercars", "discovercars"],
  ["hostelworld", "hostelworld"],
  ["duffel", "duffel"],
  ["opentable", "opentable"],
  ["klook", "klook"],
]);

export function normalizeAffiliatePartner(
  value: unknown,
): AffiliatePartnerKey | null {
  if (typeof value !== "string") return null;
  return (
    PARTNER_ALIASES.get(value.toLowerCase().replace(/[^a-z0-9]/g, "")) ?? null
  );
}

/**
 * Viator owns pid/mcid/medium; campaign is the affiliate-defined touchpoint.
 * https://partnerresources.viator.com/blog/attribution/
 * Reject old generated links with fake partner IDs or click IDs in mcid.
 */
export function parseViatorAffiliateUrl(
  value: string,
  expectedPartnerId?: string,
): URL | null {
  try {
    const url = new URL(value);
    const pid = url.searchParams.get("pid");
    const mcid = url.searchParams.get("mcid");
    const medium = url.searchParams.get("medium");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !(
        url.hostname === "viator.com" || url.hostname.endsWith(".viator.com")
      ) ||
      !pid ||
      !/^P\d+$/.test(pid) ||
      !mcid ||
      !/^\d+$/.test(mcid) ||
      !medium ||
      !["api", "link", "widget", "banner"].includes(medium) ||
      (expectedPartnerId !== undefined && pid !== expectedPartnerId)
    )
      return null;
    // Ambiguous duplicate attribution parameters can be interpreted differently
    // by redirects/reporting; never accept them as verified links.
    if (
      ["pid", "mcid", "medium"].some(
        (key) => url.searchParams.getAll(key).length !== 1,
      )
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
