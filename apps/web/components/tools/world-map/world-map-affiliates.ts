import type { AffiliateLinkResult } from "@/lib/affiliates/types";

export interface WorldMapAffiliateBundle {
  stay: AffiliateLinkResult | null;
  flight: AffiliateLinkResult | null;
  esim: AffiliateLinkResult | null;
  insurance: AffiliateLinkResult | null;
}
