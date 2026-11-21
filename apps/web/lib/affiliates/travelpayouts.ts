import type { AffiliateVertical } from "@faroway/constants";
import {
  envTrim,
  finalizeAffiliateLink,
  type AffiliateLinkResult,
} from "./types";

export function isTravelpayoutsConfigured(): boolean {
  return Boolean(envTrim("TRAVELPAYOUTS_MARKER"));
}

export function buildTravelpayoutsLink(params: {
  targetUrl: string;
  programId?: string;
  subId?: string;
  label?: string;
  vertical?: AffiliateVertical;
}): AffiliateLinkResult {
  const label = params.label ?? "Book via Travelpayouts";
  const vertical = params.vertical ?? "multi";
  const marker = envTrim("TRAVELPAYOUTS_MARKER");

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(params.targetUrl);
    if (
      parsedTarget.protocol !== "https:" ||
      parsedTarget.username ||
      parsedTarget.password ||
      parsedTarget.port
    ) {
      return finalizeAffiliateLink({
        partner: "travelpayouts",
        label,
        vertical,
        url: null,
        configured: false,
        isSearchFallback: true,
      });
    }
  } catch {
    return finalizeAffiliateLink({
      partner: "travelpayouts",
      label,
      vertical,
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  if (!marker) {
    return finalizeAffiliateLink({
      partner: "travelpayouts",
      label,
      vertical,
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  const tpUrl = new URL("https://tp.media/r");
  tpUrl.searchParams.set("marker", marker);

  const trs = envTrim("TRAVELPAYOUTS_TRS");
  if (trs) {
    tpUrl.searchParams.set("trs", trs);
  }

  const programId = params.programId?.trim();
  if (programId) {
    tpUrl.searchParams.set("p", programId);
  }

  tpUrl.searchParams.set("u", parsedTarget.toString());

  const subId = params.subId?.trim();
  if (subId) {
    tpUrl.searchParams.set("sub_id", subId);
  }

  return finalizeAffiliateLink({
    partner: "travelpayouts",
    label,
    vertical,
    url: tpUrl.toString(),
    configured: true,
    isSearchFallback: true,
    viaNetwork: "travelpayouts",
  });
}
