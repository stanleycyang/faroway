import type { TrackClickParams } from "@faroway/types";
import { parseViatorAffiliateUrl } from "@faroway/constants";

/** Build the same-origin navigation URL used by web booking links. */
export function buildAffiliateClickRedirect(
  params: TrackClickParams,
): string | undefined {
  if (
    params.affiliatePartner.toLowerCase() === "viator" &&
    !parseViatorAffiliateUrl(params.affiliateUrl)
  )
    return undefined;
  const query = new URLSearchParams({
    itemType: params.itemType,
    itemId: params.itemId,
    itemName: params.itemName,
    affiliatePartner: params.affiliatePartner,
    affiliateUrl: params.affiliateUrl,
  });

  if (params.searchId) query.set("searchId", params.searchId);
  if (params.tripId) query.set("tripId", params.tripId);
  if (params.price != null) query.set("price", String(params.price));
  if (params.currency) query.set("currency", params.currency);
  if (params.source) query.set("source", params.source);

  return `/api/track/click?${query.toString()}`;
}
