import { z } from "zod";
import type { TransportResult } from "@faroway/types";
import { fetchWithTimeout } from "@/lib/search/runtime";
import { isValidDateOnly } from "@/lib/api/date-range";

// Contract: https://docs.liteapi.travel/reference/post_flights-rates
const date = z.string().refine(isValidDateOnly);
const airport = z.string().regex(/^[A-Z]{3}$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
const money = z.number().finite().nonnegative();
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
type Search = z.output<typeof LiteApiFlightSearchSchema>;
export type FlightMode = "sandbox" | "production";

export function liteApiFlightsConfigured(mode: FlightMode = "production") {
  const key = process.env.LITEAPI_API_KEY?.trim() || "";
  if (!/^[A-Za-z0-9_-]{10,}$/.test(key)) return false;
  return mode === "sandbox"
    ? process.env.LITEAPI_FLIGHTS_SANDBOX_ENABLED === "true" &&
        key.startsWith("sand_")
    : process.env.LITEAPI_FLIGHTS_ENABLED === "true" &&
        process.env.LITEAPI_FLIGHTS_PRODUCTION_APPROVED === "true" &&
        !key.startsWith("sand_");
}

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
        direction: "OUTBOUND",
      },
      ...(p.returnDate
        ? [
            {
              origin: p.destination,
              destination: p.origin,
              date: p.returnDate,
              direction: "INBOUND",
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
      cabinClassMatch: "exactly",
    },
  };
}

// Airport-local wall-clock times may have no offset. Never calculate elapsed
// flight time by subtracting them; use the provider's legDurations instead.
const localTime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
  )
  .refine(
    (s) =>
      isValidDateOnly(s.slice(0, 10)) &&
      Number(s.slice(11, 13)) < 24 &&
      Number(s.slice(14, 16)) < 60 &&
      Number(s.slice(17, 19)) < 60,
  );
const duration = z.object({ minutes: z.number().int().positive() });
const segment = z.object({
  segmentKey: z.string().min(1),
  originCode: airport,
  destinationCode: airport,
  originName: z.string().optional(),
  destinationName: z.string().optional(),
  departureTime: localTime,
  arrivalTime: localTime,
  direction: z.enum(["OUTBOUND", "INBOUND"]),
  duration,
  stopCount: z.number().int().nonnegative(),
  carrier: z.object({
    marketingCode: z.string().min(1),
    marketingName: z.string().optional(),
  }),
  flight: z.object({ marketingNumber: z.string().min(1) }),
});
const offer = z.object({
  offerId: z.string().min(1),
  expiration: z.string().datetime({ offset: true }),
  pricing: z.object({ display: z.object({ total: money, currency }) }),
  fare: z.object({ mixedCabin: z.boolean().optional() }).optional(),
  segmentFares: z
    .array(z.object({ segmentKey: z.string(), cabin: z.string() }))
    .min(1),
});
const journey = z.object({
  parameters: z.object({
    adults: z.number().int(),
    children: z.number().int(),
    infants: z.number().int(),
  }),
  segments: z.array(segment).min(1).max(12),
  legDurations: z
    .array(z.object({ direction: z.enum(["OUTBOUND", "INBOUND"]), duration }))
    .min(1),
  offers: z.array(z.unknown()),
});
const responseSchema = z.object({
  data: z.array(z.object({ journeys: z.array(z.unknown()) })),
});

/** Search totals are supplier selling prices, not guarantees or booking links. */
export function normalizeLiteApiFlights(
  raw: unknown,
  input: LiteApiFlightSearch,
  now = Date.now(),
): TransportResult[] {
  const p: Search = LiteApiFlightSearchSchema.parse(input);
  const party = liteApiPassengerCounts(p.adults, p.childAges);
  const response = responseSchema.parse(raw);
  const results: TransportResult[] = [];
  const seen = new Set<string>();
  for (const batch of response.data)
    for (const item of batch.journeys) {
      const parsed = journey.safeParse(item);
      if (!parsed.success) continue;
      const j = parsed.data;
      if (
        j.parameters.adults !== party.adults ||
        j.parameters.children !== party.children ||
        j.parameters.infants !== party.infants
      )
        continue;
      if (
        new Set(j.segments.map((s) => s.segmentKey)).size !== j.segments.length
      )
        continue;
      const outbound = j.segments.filter((s) => s.direction === "OUTBOUND");
      const inbound = j.segments.filter((s) => s.direction === "INBOUND");
      const matchesLeg = (
        segments: typeof outbound,
        origin: string,
        destination: string,
        date: string,
      ) =>
        segments.length > 0 &&
        segments[0].originCode === origin &&
        segments.at(-1)!.destinationCode === destination &&
        segments[0].departureTime.slice(0, 10) === date &&
        segments.every(
          (s, i) => i === 0 || segments[i - 1].destinationCode === s.originCode,
        ) &&
        segments.length - 1 + segments.reduce((n, s) => n + s.stopCount, 0) <=
          p.maxStops;
      if (
        !matchesLeg(outbound, p.origin, p.destination, p.departureDate) ||
        (p.returnDate
          ? !matchesLeg(inbound, p.destination, p.origin, p.returnDate)
          : inbound.length !== 0)
      )
        continue;
      const elapsed = j.legDurations.filter((d) => d.direction === "OUTBOUND");
      if (elapsed.length !== 1) continue;
      for (const value of j.offers) {
        const parsedOffer = offer.safeParse(value);
        if (!parsedOffer.success) continue;
        const o = parsedOffer.data;
        if (
          seen.has(o.offerId) ||
          o.pricing.display.currency !== p.currency ||
          Date.parse(o.expiration) <= now ||
          o.fare?.mixedCabin
        )
          continue;
        const cabin = (s: string) => s.toLowerCase().replace(/[ _-]/g, "");
        if (
          !j.segments.every((s) => {
            const fares = o.segmentFares.filter(
              (f) => f.segmentKey === s.segmentKey,
            );
            return (
              fares.length === 1 &&
              cabin(fares[0].cabin) === cabin(p.cabinClass)
            );
          })
        )
          continue;
        const first = outbound[0],
          last = outbound.at(-1)!;
        seen.add(o.offerId);
        results.push({
          id: `transport_liteapi_${o.offerId}`,
          type: "flight",
          source: "liteapi",
          affiliatePartner: "liteapi",
          affiliateUrl: "",
          provider: [
            ...new Set(
              j.segments.map(
                (s) => s.carrier.marketingName || s.carrier.marketingCode,
              ),
            ),
          ].join(", "),
          departure: {
            airport: first.originCode,
            city: "",
            dateTime: first.departureTime,
          },
          arrival: {
            airport: last.destinationCode,
            city: "",
            dateTime: last.arrivalTime,
          },
          duration: elapsed[0].duration.minutes,
          stops:
            outbound.length - 1 + outbound.reduce((n, s) => n + s.stopCount, 0),
          price: o.pricing.display.total,
          currency: o.pricing.display.currency,
          expiresAt: o.expiration,
          cabinClass: p.cabinClass,
          airlines: [
            ...new Set(
              j.segments.map(
                (s) => s.carrier.marketingName || s.carrier.marketingCode,
              ),
            ),
          ],
          segments: j.segments.map((s) => ({
            carrier: s.carrier.marketingCode,
            flightNumber: `${s.carrier.marketingCode}${s.flight.marketingNumber}`,
            departure: { airport: s.originCode, dateTime: s.departureTime },
            arrival: { airport: s.destinationCode, dateTime: s.arrivalTime },
            duration: s.duration.minutes,
            cabinClass: p.cabinClass,
          })),
          vibeScore: 0,
          vibeMatch: [],
        });
      }
    }
  return results.sort((a, b) => a.price - b.price).slice(0, p.limit);
}

export async function searchLiteApiFlights(
  input: LiteApiFlightSearch,
  mode: FlightMode = "production",
) {
  if (!liteApiFlightsConfigured(mode))
    throw new Error(
      "LiteAPI flights are disabled or lack approved credentials",
    );
  const body = buildLiteApiFlightRequest(input);
  const response = await fetchWithTimeout(
    "https://api.liteapi.travel/v3.0/flights/rates",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-API-Key": process.env.LITEAPI_API_KEY!.trim(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    },
    10_000,
  );
  if (!response.ok)
    throw new Error(`Flight search unavailable (${response.status})`);
  return {
    sandbox: mode === "sandbox",
    offers: normalizeLiteApiFlights(await response.json(), input),
  };
}
