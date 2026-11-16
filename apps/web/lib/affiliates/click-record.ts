/**
 * Row shape for public.affiliate_clicks. The live ledger is this table,
 * not the older partner/product_id/tracking_id field names.
 */
export interface AffiliateClickInsert {
  id: string;
  user_id: string | null;
  item_type: "hotel" | "activity" | "restaurant" | "flight" | "transport";
  item_id: string;
  item_name: string;
  affiliate_partner: string;
  affiliate_url: string;
  search_id: string | null;
  trip_id: string | null;
  price: number | null;
  currency: string | null;
  source: string;
  clicked_at: string;
  converted: false;
  conversion_value: null;
}

export const AFFILIATE_CLICK_COLUMNS = [
  "id",
  "user_id",
  "item_type",
  "item_id",
  "item_name",
  "affiliate_partner",
  "affiliate_url",
  "search_id",
  "trip_id",
  "price",
  "currency",
  "source",
  "clicked_at",
  "converted",
  "conversion_value",
] as const;

const LEGACY_CLICK_COLUMNS = [
  "partner",
  "product_id",
  "product_name",
  "tracking_id",
  "click_url",
  "activity_id",
  "commission_amount",
] as const;

export function affiliateClickInsert(input: {
  clickId: string;
  userId: string | null;
  itemType: AffiliateClickInsert["item_type"];
  itemId: string;
  itemName: string;
  affiliatePartner: string;
  affiliateUrl: string;
  searchId?: string | null;
  tripId?: string | null;
  price?: number | null;
  currency?: string | null;
  source?: string;
  clickedAt: string;
}): AffiliateClickInsert {
  return {
    id: input.clickId,
    user_id: input.userId,
    item_type: input.itemType,
    item_id: input.itemId,
    item_name: input.itemName,
    affiliate_partner: input.affiliatePartner,
    affiliate_url: input.affiliateUrl,
    search_id: input.searchId ?? null,
    trip_id: input.tripId ?? null,
    price: input.price ?? null,
    currency: input.currency ?? null,
    source: input.source || "search_results",
    clicked_at: input.clickedAt,
    converted: false,
    conversion_value: null,
  };
}

/** Fail closed when a click would not land in the affiliate_clicks ledger. */
export function affiliateClickLedgerFailures(row: object): string[] {
  const record = row as Record<string, unknown>;
  const failures: string[] = [];
  for (const column of AFFILIATE_CLICK_COLUMNS) {
    if (!(column in record)) failures.push(`missing:${column}`);
  }
  for (const column of LEGACY_CLICK_COLUMNS) {
    if (column in record) failures.push(`legacy:${column}`);
  }
  if (
    typeof record.affiliate_url !== "string" ||
    !record.affiliate_url.startsWith("https://")
  )
    failures.push("affiliate_url");
  if (
    typeof record.affiliate_partner !== "string" ||
    !record.affiliate_partner.trim()
  )
    failures.push("affiliate_partner");
  if (typeof record.item_id !== "string" || !record.item_id.trim())
    failures.push("item_id");
  if (record.converted !== false) failures.push("converted");
  return failures;
}
