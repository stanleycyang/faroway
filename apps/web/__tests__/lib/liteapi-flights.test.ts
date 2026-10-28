import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  buildLiteApiFlightRequest,
  normalizeLiteApiFlights,
  searchLiteApiFlights,
  liteApiFlightsConfigured,
} from "@/lib/affiliates/liteapi-flights";
const now = Date.parse("2026-11-01T00:00:00Z");
const input = {
  origin: "JFK",
  destination: "CDG",
  departureDate: "2026-12-01",
  returnDate: "2026-12-05",
  adults: 2,
  childAges: [1, 7, 15],
  currency: "USD",
};
function fixture() {
  const seg = (
    direction: string,
    originCode: string,
    destinationCode: string,
    date: string,
  ) => ({
    direction,
    originCode,
    destinationCode,
    segmentKey: direction,
    departureTime: `${date}T10:00:00`,
    arrivalTime: `${date}T18:00:00`,
    duration: { minutes: 480 },
    stopCount: 0,
    carrier: { marketingCode: "ZZ", marketingName: "Test Airline" },
    flight: { marketingNumber: "123" },
  });
  return {
    data: [
      {
        journeys: [
          {
            parameters: { adults: 3, children: 1, infants: 1 },
            segments: [
              seg("OUTBOUND", "JFK", "CDG", "2026-12-01"),
              seg("INBOUND", "CDG", "JFK", "2026-12-05"),
            ],
            legDurations: [
              { direction: "OUTBOUND", duration: { minutes: 480 } },
              { direction: "INBOUND", duration: { minutes: 480 } },
            ],
            offers: [
              {
                offerId: "offer-1",
                expiration: "2026-11-01T00:10:00Z",
                pricing: {
                  display: {
                    total: 850.55,
                    currency: "USD",
                    base: 500,
                    fees: 15,
                    taxes: 100,
                  },
                },
                fare: { mixedCabin: false },
                segmentFares: [
                  { segmentKey: "OUTBOUND", cabin: "Economy" },
                  { segmentKey: "INBOUND", cabin: "Economy" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("uses legs and maps 0–1, 2–11 and 12–17 ages without changing party size", () => {
  const body = buildLiteApiFlightRequest(input, now);
  expect(body).toMatchObject({
    adults: 3,
    children: 1,
    infants: 1,
    childrenAges: [7],
    infantAges: [1],
    cabinClass: "ECONOMY",
    legs: [
      {
        origin: "JFK",
        destination: "CDG",
        date: "2026-12-01",
        direction: "OUTBOUND",
      },
      {
        origin: "CDG",
        destination: "JFK",
        date: "2026-12-05",
        direction: "INBOUND",
      },
    ],
  });
  expect(body).not.toHaveProperty("departureDate");
});
it.each([
  { childAges: [18] },
  { childAges: [2.5] },
  { adults: 0 },
  { adults: 1, childAges: [0, 1] },
  { returnDate: "2026-11-01" },
  { departureDate: "2026-02-30" },
  { departureDate: "2028-01-01", returnDate: undefined },
])("rejects invalid party/date before sending (%j)", (patch) => {
  expect(() =>
    buildLiteApiFlightRequest({ ...input, ...patch }, now),
  ).toThrow();
});
it("keeps the total selling price, expiry and full route; never invents a checkout URL", () => {
  const [offer] = normalizeLiteApiFlights(fixture(), input, now);
  expect(offer).toMatchObject({
    price: 850.55,
    currency: "USD",
    affiliatePartner: "liteapi",
    source: "liteapi",
    affiliateUrl: "",
    duration: 480,
    stops: 0,
    expiresAt: "2026-11-01T00:10:00Z",
    departure: { airport: "JFK" },
    arrival: { airport: "CDG" },
  });
  expect(offer.segments).toHaveLength(2);
});
it.each([
  "expired",
  "currency",
  "party",
  "return",
  "cabin",
  "mixed",
  "missing total",
  "technical stops",
])("rejects mismatched or incomplete offers: %s", (kind) => {
  const data = fixture();
  const j = data.data[0].journeys[0];
  const o = j.offers[0];
  if (kind === "expired") o.expiration = new Date(now).toISOString();
  if (kind === "currency") o.pricing.display.currency = "EUR";
  if (kind === "party") j.parameters.adults = 2;
  if (kind === "return") j.segments[1].destinationCode = "LAX";
  if (kind === "cabin") o.segmentFares[1].cabin = "Business";
  if (kind === "mixed") o.fare.mixedCabin = true;
  if (kind === "missing total")
    delete (o.pricing.display as Partial<typeof o.pricing.display>).total;
  if (kind === "technical stops") j.segments[0].stopCount = 2;
  expect(normalizeLiteApiFlights(data, input, now)).toEqual([]);
});
it("counts technical stops instead of calling a single segment nonstop", () => {
  const data = fixture();
  data.data[0].journeys[0].segments[0].stopCount = 1;
  expect(normalizeLiteApiFlights(data, input, now)[0].stops).toBe(1);
  expect(normalizeLiteApiFlights(data, { ...input, maxStops: 0 }, now)).toEqual(
    [],
  );
});
it("fails closed without production approval and rejects sandbox keys on the live path", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("LITEAPI_API_KEY", "sand_test_fixture");
  vi.stubEnv("LITEAPI_FLIGHTS_ENABLED", "true");
  vi.stubEnv("LITEAPI_FLIGHTS_PRODUCTION_APPROVED", "true");
  expect(liteApiFlightsConfigured()).toBe(false);
  await expect(searchLiteApiFlights(input)).rejects.toThrow();
  vi.stubEnv("LITEAPI_API_KEY", "live_test_fixture");
  vi.stubEnv("LITEAPI_FLIGHTS_PRODUCTION_APPROVED", "false");
  await expect(searchLiteApiFlights(input)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("sandbox rehearsal is explicit, tagged and read-only", async () => {
  vi.stubEnv("LITEAPI_API_KEY", "sand_test_fixture");
  vi.stubEnv("LITEAPI_FLIGHTS_SANDBOX_ENABLED", "true");
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(fixture())));
  vi.stubGlobal("fetch", fetch);
  const result = await searchLiteApiFlights(input, "sandbox");
  expect(result.sandbox).toBe(true);
  expect(result.offers).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(
    "https://api.liteapi.travel/v3.0/flights/rates",
  );
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    cache: "no-store",
  });
});
it.each([401, 429, 502, 503])(
  "does not mask provider failures %s",
  async (status) => {
    vi.stubEnv("LITEAPI_API_KEY", "sand_test_fixture");
    vi.stubEnv("LITEAPI_FLIGHTS_SANDBOX_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status })),
    );
    await expect(searchLiteApiFlights(input, "sandbox")).rejects.toThrow(
      "unavailable",
    );
  },
);

it("clamps the 11-month horizon at month end instead of rolling into the next month", () => {
  const endOfMonth = Date.parse("2026-03-31T00:00:00Z");
  expect(() =>
    buildLiteApiFlightRequest(
      { ...input, departureDate: "2027-02-28", returnDate: undefined },
      endOfMonth,
    ),
  ).not.toThrow();
  expect(() =>
    buildLiteApiFlightRequest(
      { ...input, departureDate: "2027-03-01", returnDate: undefined },
      endOfMonth,
    ),
  ).toThrow();
});
