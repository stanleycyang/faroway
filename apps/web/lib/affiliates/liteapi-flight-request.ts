import { z } from "zod";
import { isValidDateOnly } from "../api/date-range";

// Contract: https://docs.liteapi.travel/reference/post_flights-rates
// The provider body is legs + passenger counts. It does not accept the
// app's origin/departureDate shape and does not return a sandbox flag.
const date = z.string().refine(isValidDateOnly);
const airport = z.string().regex(/^[A-Z]{3}$/);
const currency = z.string().regex(/^[A-Z]{3}$/);

export const LiteApiFlightSearchSchema = z
  .object({
    origin: airport,
    destination: airport,
    departureDate: date,
    returnDate: date.optional(),
    adults: z.number().int().min(1).max(50),
    childAges: z.array(z.number().int().min(0).max(17)).max(49),
    currency,
    cabinClass: z
      .enum(["economy", "premium_economy", "business", "first"])
      .default("economy"),
    maxStops: z.number().int().min(0).max(2).default(1),
    limit: z.number().int().min(1).max(20).default(5),
  })
  .strict()
  .refine(
    (p) =>
      p.origin !== p.destination &&
      (!p.returnDate || p.returnDate > p.departureDate) &&
      p.adults + p.childAges.length <= 50,
    "Invalid itinerary or party",
  );
export type LiteApiFlightSearch = z.input<typeof LiteApiFlightSearchSchema>;
export type LiteApiFlightSearchParsed = z.output<
  typeof LiteApiFlightSearchSchema
>;

export const liteApiFlightAirport = airport;
export const liteApiFlightCurrency = currency;

/** LiteAPI classifies 12–17-year-olds as adults, unlike the trip's child count. */
export function liteApiPassengerCounts(adults: number, ages: number[]) {
  const childrenAges = ages.filter((age) => age >= 2 && age < 12);
  const infantAges = ages.filter((age) => age < 2);
  return {
    adults: adults + ages.filter((age) => age >= 12).length,
    children: childrenAges.length,
    infants: infantAges.length,
    childrenAges,
    infantAges,
  };
}

export function buildLiteApiFlightRequest(
  input: LiteApiFlightSearch,
  now = Date.now(),
) {
  const p = LiteApiFlightSearchSchema.parse(input);
  const horizon = new Date(now);
  const originalDay = horizon.getUTCDate();
  horizon.setUTCDate(1);
  horizon.setUTCMonth(horizon.getUTCMonth() + 11);
  const lastDay = new Date(
    Date.UTC(horizon.getUTCFullYear(), horizon.getUTCMonth() + 1, 0),
  ).getUTCDate();
  horizon.setUTCDate(Math.min(originalDay, lastDay));
  const today = new Date(now).toISOString().slice(0, 10);
  const latest = horizon.toISOString().slice(0, 10);
  if (p.departureDate < today || (p.returnDate ?? p.departureDate) > latest)
    throw new Error("Flight dates must be within 11 months");
  const party = liteApiPassengerCounts(p.adults, p.childAges);
  if (party.infants > p.adults)
    throw new Error("Each infant requires an accompanying adult");
  return {
    legs: [
      {
        origin: p.origin,
        destination: p.destination,
        date: p.departureDate,
        direction: "OUTBOUND" as const,
      },
      ...(p.returnDate
        ? [
            {
              origin: p.destination,
              destination: p.origin,
              date: p.returnDate,
              direction: "INBOUND" as const,
            },
          ]
        : []),
    ],
    ...party,
    currency: p.currency,
    cabinClass: p.cabinClass.toUpperCase(),
    filters: {
      maxStops: p.maxStops,
      cabinClass: p.cabinClass.toUpperCase(),
      cabinClassMatch: "exactly" as const,
    },
  };
}
