import { isValidDateOnly } from "@/lib/api/date-range";
import { isViatorContentEnabled } from "./viator-policy";

/** Preserve provider attribution; only campaign is Faroway-controlled. */
export function buildViatorHandoffUrl(
  productUrl: string,
  campaign: string,
  partnerId?: string,
): string | null {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(campaign)) return null;
  try {
    const url = new URL(productUrl);
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "viator.com" || url.hostname.endsWith(".viator.com")
      ) ||
      url.username ||
      url.password ||
      url.port ||
      !url.pathname.startsWith("/tours/")
    )
      return null;
    // Different parsers may choose the first or last duplicate parameter.
    // Reject ambiguity rather than validating one account and sending another.
    if (
      ["pid", "mcid", "medium"].some(
        (key) => url.searchParams.getAll(key).length !== 1,
      )
    )
      return null;
    const pid = url.searchParams.get("pid");
    if (!pid || !/^P\d+$/.test(pid) || (partnerId && pid !== partnerId))
      return null;
    if (!/^\d+$/.test(url.searchParams.get("mcid") || "")) return null;
    if (!url.searchParams.get("medium")) return null;
    url.searchParams.set("campaign", campaign);
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Search-level Viator URL builder. Only emits when Viator commercial content
 * is enabled and valid partner credentials (pid + mcid) are configured.
 */
export function buildViatorSearchUrl(params: {
  destination: string;
  query?: string;
  startDate?: string;
  endDate?: string;
  campaign?: string;
  partnerId?: string;
  mcid?: string;
}): string | null {
  if (!isViatorContentEnabled()) return null;

  const partnerId = (params.partnerId ?? process.env.VIATOR_PARTNER_ID)?.trim();
  const mcid = (params.mcid ?? process.env.VIATOR_MCID)?.trim();
  if (!partnerId || !/^P\d+$/.test(partnerId)) return null;
  if (!mcid || !/^\d+$/.test(mcid)) return null;

  const text = params.query?.trim()
    ? `${params.query.trim()} ${params.destination.trim()}`
    : params.destination.trim();
  if (!text) return null;

  const url = new URL("https://www.viator.com/searchResults/all");
  url.searchParams.set("text", text);
  url.searchParams.set("pid", partnerId);
  url.searchParams.set("mcid", mcid);
  url.searchParams.set("medium", "link");

  if (params.startDate && isValidDateOnly(params.startDate)) {
    url.searchParams.set("startDate", params.startDate);
  }
  if (params.endDate && isValidDateOnly(params.endDate)) {
    url.searchParams.set("endDate", params.endDate);
  }
  if (params.campaign) {
    const cleanCampaign = params.campaign
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .slice(0, 100);
    if (cleanCampaign) {
      url.searchParams.set("campaign", cleanCampaign);
    }
  }

  return url.toString();
}
