import {
  AFFILIATE_PARTNERS,
  isAllowedAffiliateUrl,
  resolveAffiliatePartnerByUrl,
} from "@faroway/constants";
import {
  canDisplayViatorContent,
  isViatorContent,
  isViatorContentEnabled,
} from "@/lib/affiliates/viator-policy";

export interface TripEssentialExportLink {
  label: string;
  category: string;
  url: string;
}

export interface TripExportOptions {
  viatorContentEnabled?: boolean;
  essentials?: TripEssentialExportLink[];
}

export function isExportItemDisplayable(
  item: unknown,
  viatorContentEnabled?: boolean,
): boolean {
  if (viatorContentEnabled !== undefined) {
    return canDisplayViatorContent(item, viatorContentEnabled);
  }
  if (typeof window === "undefined") {
    return canDisplayViatorContent(item, isViatorContentEnabled());
  }
  if (!isViatorContent(item)) return true;
  return (
    typeof item === "object" &&
    item !== null &&
    (item as { viatorContentVersion?: unknown }).viatorContentVersion === 1
  );
}

export function sanitizeExportAffiliateUrl(
  rawUrl?: string,
  medium: "export_ics" | "export_txt" = "export_ics",
): string | undefined {
  if (typeof rawUrl !== "string") return undefined;
  const cleaned = rawUrl.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned || !isAllowedAffiliateUrl(cleaned)) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return undefined;
  }

  const partner = resolveAffiliatePartnerByUrl(cleaned);
  if (partner === "viator") {
    // Preserve provider-owned Viator params (pid/mcid/medium/campaign) untouched.
    return parsed.toString();
  }

  if (partner && AFFILIATE_PARTNERS[partner].appendUtm) {
    if (!parsed.searchParams.has("utm_source")) {
      parsed.searchParams.set("utm_source", "faroway");
    }
    if (!parsed.searchParams.has("utm_medium")) {
      parsed.searchParams.set("utm_medium", medium);
    }
  }

  return parsed.toString();
}

export function sanitizeExportEssentials(
  essentials: TripEssentialExportLink[] | undefined,
  medium: "export_ics" | "export_txt" = "export_ics",
  viatorContentEnabled?: boolean,
): TripEssentialExportLink[] {
  if (!Array.isArray(essentials)) return [];
  const viatorAllowed =
    viatorContentEnabled !== undefined
      ? viatorContentEnabled
      : typeof window === "undefined"
        ? isViatorContentEnabled()
        : false;
  const results: TripEssentialExportLink[] = [];
  for (const item of essentials) {
    if (
      !item ||
      typeof item.label !== "string" ||
      !item.label.trim() ||
      typeof item.category !== "string" ||
      !item.category.trim()
    ) {
      continue;
    }
    const safeUrl = sanitizeExportAffiliateUrl(item.url, medium);
    if (!safeUrl) continue;
    if (resolveAffiliatePartnerByUrl(safeUrl) === "viator" && !viatorAllowed) {
      continue;
    }
    results.push({
      label: item.label.trim(),
      category: item.category.trim(),
      url: safeUrl,
    });
  }
  return results;
}
