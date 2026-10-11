/** Missing/invalid data is not zero, free, USD, or a positive review score. */
export function nonNegativeAmount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/** Provider APIs sometimes serialize decimal amounts as strings. No coercion of blanks/null. */
export function providerAmount(value: unknown): number | undefined {
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim()))
    return nonNegativeAmount(Number(value));
  return nonNegativeAmount(value);
}

export function currencyCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : undefined;
}

export function readPrice(
  amount: unknown,
  currency: unknown,
): { amount: number; currency: string } | undefined {
  const value = nonNegativeAmount(amount);
  const code = currencyCode(currency);
  return value !== undefined && code
    ? { amount: value, currency: code }
    : undefined;
}

/** Explicit ISO code avoids ambiguous dollar symbols and preserves currency decimals. */
export function formatPrice(
  amount: unknown,
  currency: unknown,
): string | undefined {
  const price = readPrice(amount, currency);
  if (!price) return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
    currencyDisplay: "code",
  })
    .format(price.amount)
    .replace(/\u00a0/g, " ");
}

export function reviewRating(
  value: unknown,
  scale: 5 | 10 = 5,
): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= scale
    ? value
    : undefined;
}
