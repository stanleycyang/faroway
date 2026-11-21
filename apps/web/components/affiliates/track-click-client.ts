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

export function preopenAffiliateTab(): Window | null {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return null;
  }
  const popup = window.open("", "_blank");
  if (popup) {
    try {
      popup.opener = null;
    } catch {
      // Ignore readonly opener errors in restricted environments.
    }
  }
  return popup ?? null;
}

export function closePreopenedAffiliateTab(
  popup: Window | null | undefined,
): void {
  if (popup && !popup.closed) {
    try {
      popup.close?.();
    } catch {
      // Ignore close errors on restricted or already-closed windows.
    }
  }
}

export function openAffiliateUrlInNewTab(
  url: string,
  preopenedPopup?: Window | null,
): boolean {
  if (typeof window === "undefined" || !isAllowedAffiliateUrl(url)) {
    closePreopenedAffiliateTab(preopenedPopup);
    return false;
  }
  const popup =
    preopenedPopup === undefined ? preopenAffiliateTab() : preopenedPopup;
  if (popup && !popup.closed) {
    try {
      popup.opener = null;
    } catch {
      // Ignore readonly opener errors in restricted environments.
    }
    try {
      if (typeof popup.location?.replace === "function") {
        popup.location.replace(url);
        return true;
      }
      if (popup.location && "href" in popup.location) {
        popup.location.href = url;
        return true;
      }
    } catch {
      closePreopenedAffiliateTab(popup);
    }
  }
  window.location.assign(url);
  return false;
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
  if (!isAllowedAffiliateUrl(input.affiliateUrl)) {
    return null;
  }
  const partner =
    resolveAffiliatePartnerByUrl(input.affiliateUrl) ??
    normalizeAffiliatePartner(input.partner);
  if (!partner) {
    return null;
  }

  // Pre-open synchronously inside user gesture so Safari/browsers don't block
  // after the async /api/track/click call, without passing "noopener,noreferrer".
  const popup = preopenAffiliateTab();

  try {
    const result = await trackAffiliateClick(input);
    if (!result || !isAllowedAffiliateUrl(result.url)) {
      closePreopenedAffiliateTab(popup);
      return null;
    }
    const openedInNewTab = openAffiliateUrlInNewTab(result.url, popup);
    return {
      ...result,
      openedInNewTab,
    };
  } catch (error) {
    closePreopenedAffiliateTab(popup);
    throw error;
  }
}
