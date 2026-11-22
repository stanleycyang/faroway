import { buildGYGSearchUrl } from "./getyourguide";
import {
  buildTravelpayoutsLink,
  isTravelpayoutsConfigured,
} from "./travelpayouts";
import {
  envTrim,
  finalizeAffiliateLink,
  type AffiliateLinkResult,
} from "./types";
import { buildViatorSearchUrl } from "./viator-link";
import { isViatorContentEnabled } from "./viator-policy";

export function buildKlookActivitySearchUrl(params: {
  destination: string;
  query?: string;
  trackingId?: string;
}): AffiliateLinkResult {
  const q = params.query?.trim()
    ? `${params.query.trim()} ${params.destination.trim()}`
    : params.destination.trim();
  if (!q) {
    return finalizeAffiliateLink({
      partner: "klook",
      label: "Explore activities on Klook",
      vertical: "activities",
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  const target = new URL("https://www.klook.com/search/result/");
  target.searchParams.set("query", q);

  const aid = envTrim("KLOOK_AFFILIATE_ID");
  const adId = envTrim("KLOOK_AD_ID");
  if (aid) {
    target.searchParams.set("aid", aid);
    if (adId) target.searchParams.set("aff_adid", adId);
    return finalizeAffiliateLink({
      partner: "klook",
      label: "Explore activities on Klook",
      vertical: "activities",
      url: target.toString(),
      configured: true,
      isSearchFallback: true,
    });
  }

  if (isTravelpayoutsConfigured()) {
    return buildTravelpayoutsLink({
      targetUrl: target.toString(),
      programId: envTrim("TRAVELPAYOUTS_KLOOK_PROGRAM_ID") ?? "4110",
      subId: params.trackingId,
      label: "Explore activities on Klook",
      vertical: "activities",
    });
  }

  return finalizeAffiliateLink({
    partner: "klook",
    label: "Explore activities on Klook",
    vertical: "activities",
    url: target.toString(),
    configured: false,
    isSearchFallback: true,
  });
}

export function buildTiqetsActivitySearchUrl(params: {
  destination: string;
  query?: string;
  trackingId?: string;
}): AffiliateLinkResult {
  const q = params.query?.trim()
    ? `${params.query.trim()} ${params.destination.trim()}`
    : params.destination.trim();

  if (!q || !isTravelpayoutsConfigured()) {
    return finalizeAffiliateLink({
      partner: "travelpayouts",
      label: "Browse museum tickets on Tiqets",
      vertical: "activities",
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  const target = new URL("https://www.tiqets.com/en/search");
  target.searchParams.set("q", q);

  return buildTravelpayoutsLink({
    targetUrl: target.toString(),
    programId: envTrim("TRAVELPAYOUTS_TIQETS_PROGRAM_ID"),
    subId: params.trackingId,
    label: "Browse museum tickets on Tiqets",
    vertical: "activities",
  });
}

export function buildActivityFallbackLinks(params: {
  destination: string;
  activityName?: string;
  date?: string;
  endDate?: string;
  trackingId?: string;
}): AffiliateLinkResult[] {
  const results: AffiliateLinkResult[] = [];

  const gygSearch = buildGYGSearchUrl({
    destination: params.destination,
    query: params.activityName,
    startDate: params.date,
    endDate: params.endDate,
    trackingId: params.trackingId,
  });
  if (gygSearch.url) results.push(gygSearch);

  if (isViatorContentEnabled()) {
    const viatorUrl = buildViatorSearchUrl({
      destination: params.destination,
      query: params.activityName,
      startDate: params.date,
      endDate: params.endDate,
      campaign: params.trackingId,
    });
    if (viatorUrl) {
      results.push(
        finalizeAffiliateLink({
          partner: "viator",
          label: "Browse tours on Viator",
          vertical: "activities",
          url: viatorUrl,
          configured: true,
          isSearchFallback: true,
        }),
      );
    }
  }

  const klook = buildKlookActivitySearchUrl({
    destination: params.destination,
    query: params.activityName,
    trackingId: params.trackingId,
  });
  if (klook.url) results.push(klook);

  const tiqets = buildTiqetsActivitySearchUrl({
    destination: params.destination,
    query: params.activityName,
    trackingId: params.trackingId,
  });
  if (tiqets.url) results.push(tiqets);

  return results;
}
