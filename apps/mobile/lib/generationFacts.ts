/** Only report supplied facts. Missing or malformed values never gain defaults. */
export function reportedCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function reportedProgress(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : undefined;
}

export function hotelPreviewFacts(hotel: Record<string, unknown>) {
  const stars = reportedCount(hotel.starRating);
  const rating = hotel.userRating ?? hotel.rating;
  const amount = hotel.pricePerNight;
  const currency = hotel.currency;
  const priceKnown =
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount > 0 &&
    typeof currency === 'string' &&
    /^[A-Z]{3}$/.test(currency) &&
    hotel.priceStatus !== 'unknown';
  return {
    stars: stars !== undefined && stars >= 1 && stars <= 5 ? '★'.repeat(stars) : null,
    rating:
      typeof rating === 'number' && Number.isFinite(rating) && rating > 0 && rating <= 10
        ? rating.toFixed(1)
        : null,
    price: priceKnown
      ? `Est. ${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} / night`
      : 'Price unavailable',
  };
}
