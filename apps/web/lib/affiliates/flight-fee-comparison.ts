import { z } from "zod";

/** Published standard pricing checked 2026-10-28; not a fare or all-in quote.
 * https://docs.liteapi.travel/reference/api-pricing-usage-costs
 * https://duffel.com/pricing
 * Account-specific fees, payment fees, FX spreads, fares and airline penalties
 * must be compared separately. LiteAPI's response may already include fees.
 */
const Input = z
  .object({
    bookingValueEur: z.number().finite().nonnegative(),
    usdToEur: z.number().finite().positive(),
    duffelManagedContent: z.boolean(),
    paidAncillaries: z.number().int().nonnegative().default(0),
    excessSearches: z.number().int().nonnegative().default(0),
    liteApiVoluntaryChanges: z.number().int().nonnegative().default(0),
  })
  .strict();
export type FlightFeeScenario = z.input<typeof Input>;
export function comparePublishedFlightFees(input: FlightFeeScenario) {
  const p = Input.parse(input);
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const liteApiTicketing = Math.min(10, Math.max(2, p.bookingValueEur * 0.01));
  const duffelOrder = 3 * p.usdToEur;
  const duffelManaged = p.duffelManagedContent ? p.bookingValueEur * 0.01 : 0;
  return {
    basis:
      "Published fees only; not an all-in price or supplier recommendation",
    currency: "EUR",
    liteapi: {
      ticketing: round(liteApiTicketing),
      excessSearches: round(0.005 * p.excessSearches),
      voluntaryServicing: round(25 * p.liteApiVoluntaryChanges),
      knownFees: round(
        liteApiTicketing +
          0.005 * p.excessSearches +
          25 * p.liteApiVoluntaryChanges,
      ),
    },
    duffel: {
      order: round(duffelOrder),
      managedContent: round(duffelManaged),
      ancillaries: round(2 * p.usdToEur * p.paidAncillaries),
      excessSearches: round(0.005 * p.usdToEur * p.excessSearches),
      knownFees: round(
        duffelOrder +
          duffelManaged +
          2 * p.usdToEur * p.paidAncillaries +
          0.005 * p.usdToEur * p.excessSearches,
      ),
    },
    allInComparisonComplete: false,
    excluded: [
      "Underlying fares and equivalent fare conditions",
      "Payment and merchant-of-record fees",
      "Account-specific ticketing/ancillary settings",
      "FX spreads",
      "Airline penalties and Duffel servicing terms",
    ],
  };
}
