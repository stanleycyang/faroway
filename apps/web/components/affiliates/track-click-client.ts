"use client";

import {
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  readPrice,
  resolveAffiliatePartnerByUrl,
  type AffiliateClickItemType,
  type AffiliatePartnerId,
} from "@faroway/constants";
import type { AffiliateClickSource } from "@faroway/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export interface TrackAndOpenInput {
  affiliateUrl: string;
  partner?: string;
  itemType: AffiliateClickItemType;
  itemId: string;
  itemName: string;
  tripId?: string;
  searchId?: string;
  source?: AffiliateClickSource;
  placement?: string;
  campaign?: string;
  price?: number;
  currency?: string;
}

export interface TrackAffiliateClickResult {
  tracked: boolean;
  url: string;
  clickId?: string;
  partner: AffiliatePartnerId;
}

export function openAffiliateUrlInNewTab(url: string): boolean {
  if (typeof window === "undefined" || !isAllowedAffiliateUrl(url)) {
    return false;
  }
  const popup =
    typeof window.open === "function"
      ? window.open(url, "_blank", "noopener,noreferrer")
      : null;
  if (!popup || popup.closed) {
    window.location.assign(url);
    return false;
  }
  return true;
}

export async function trackAffiliateClick(
  input: TrackAndOpenInput,
): Promise<TrackAffiliateClickResult | null> {
  if (!isAllowedAffiliateUrl(input.affiliateUrl)) {
    return null;
  }

  const partner =
    resolveAffiliatePartnerByUrl(input.affiliateUrl) ??
    normalizeAffiliatePartner(input.partner);
  if (!partner) {
    return null;
  }

  const validPrice = readPrice(input.price, input.currency);
  const payload = {
    itemType: input.itemType,
    itemId: input.itemId.trim().slice(0, 500) || "item",
    itemName: input.itemName.trim().slice(0, 500) || "Travel option",
    affiliatePartner: partner,
    affiliateUrl: input.affiliateUrl,
    ...(isValidUuid(input.tripId) ? { tripId: input.tripId.trim() } : {}),
    ...(isValidUuid(input.searchId) ? { searchId: input.searchId.trim() } : {}),
    ...(validPrice
      ? { price: validPrice.amount, currency: validPrice.currency }
      : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.placement
      ? { placement: input.placement.trim().slice(0, 100) }
      : {}),
    ...(input.campaign
      ? { campaign: input.campaign.trim().slice(0, 200) }
      : {}),
  };

  let finalUrl = input.affiliateUrl;
  let tracked = false;
  let clickId: string | undefined;

  try {
    const response = await fetch("/api/track/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal:
        typeof AbortSignal !== "undefined" &&
        typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(3000)
          : undefined,
    });
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as {
        redirectUrl?: unknown;
        clickId?: unknown;
      } | null;
      if (
        typeof data?.redirectUrl === "string" &&
        isAllowedAffiliateUrl(data.redirectUrl)
      ) {
        finalUrl = data.redirectUrl;
      }
      if (typeof data?.clickId === "string" && data.clickId.trim()) {
        clickId = data.clickId.trim();
        tracked = true;
      }
    }
  } catch {
    // Non-blocking fallback: proceed with validated partner URL even if click logging fails.
  }

  return {
    tracked,
    url: finalUrl,
    clickId,
    partner,
  };
}

export async function trackAndOpenAffiliateLink(
  input: TrackAndOpenInput,
): Promise<(TrackAffiliateClickResult & { openedInNewTab: boolean }) | null> {
  const result = await trackAffiliateClick(input);
  if (!result) return null;
  const openedInNewTab = openAffiliateUrlInNewTab(result.url);
  return {
    ...result,
    openedInNewTab,
  };
}
