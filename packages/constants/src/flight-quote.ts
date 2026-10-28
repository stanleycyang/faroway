/** Flight supplier quotes are usable as price references only until their stated expiry. */
export function flightQuoteIsCurrent(
  quote: { affiliatePartner?: string; expiresAt?: string },
  now: number = Date.now(),
): boolean {
  if (
    quote.affiliatePartner !== "duffel" &&
    quote.affiliatePartner !== "liteapi"
  )
    return true;
  if (!quote.expiresAt) return false;
  const expires = Date.parse(quote.expiresAt);
  return Number.isFinite(expires) && expires > now;
}
