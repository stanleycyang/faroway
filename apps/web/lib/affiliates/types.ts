import {
  AFFILIATE_DISCLOSURE_SHORT,
  isAllowedAffiliateUrl,
  type AffiliatePartnerId,
  type AffiliateVertical,
} from "@faroway/constants";

export interface AffiliateLinkResult {
  partner: AffiliatePartnerId;
  label: string;
  vertical: AffiliateVertical;
  url: string | null;
  configured: boolean;
  isSearchFallback: boolean;
  viaNetwork?: "travelpayouts";
  disclosure: string;
}

export function envTrim(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function envFlag(name: string): boolean {
  return process.env[name]?.trim() === "true";
}

export function finalizeAffiliateLink(
  input: Omit<AffiliateLinkResult, "disclosure"> & { disclosure?: string },
): AffiliateLinkResult {
  const disclosure = input.disclosure ?? AFFILIATE_DISCLOSURE_SHORT;
  if (!input.url || !isAllowedAffiliateUrl(input.url)) {
    return {
      ...input,
      url: null,
      configured: false,
      disclosure,
    };
  }
  return {
    ...input,
    disclosure,
  };
}
