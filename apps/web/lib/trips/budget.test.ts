import { describe, expect, it } from "vitest";
import type { TripDay, HotelResult } from "@faroway/types";
import {
  formatEstimate,
  summarizeBudget,
  occupiedHotelNights,
  featuredStayEstimate,
} from "./budget";

function day(
  activities: unknown[] = [],
  meals: unknown[] = [],
  transport?: unknown,
): TripDay {
  return { morning: { activities, meals }, transport } as TripDay;
}
const cost = (amount: number, currency: string, extra = {}) => ({
  estimatedCost: { amount, currency, ...extra },
});

describe("planning budget trust", () => {
  it("keeps mixed currencies separate and scales only explicitly per-person meals", () => {
    const result = summarizeBudget(
      [
        day(
          [cost(40, "EUR")],
          [
            cost(20, "USD", { perPerson: true }),
            cost(50, "USD", { perPerson: false }),
          ],
          { price: 100, currency: "GBP" },
        ),
      ].map(
        (item) =>
          ({
            ...item,
            date: "2026-06-01",
            hotel: { id: "h", name: "H", pricePerNight: 120, currency: "EUR" },
          }) as TripDay,
      ),
      { startDate: "2026-06-01", endDate: "2026-06-02" },
      3,
    );
    expect(result.groups).toEqual([
      {
        currency: "EUR",
        accommodation: 120,
        activities: 40,
        dining: 0,
        transport: 0,
        total: 160,
      },
      {
        currency: "GBP",
        accommodation: 0,
        activities: 0,
        dining: 0,
        transport: 100,
        total: 100,
      },
      {
        currency: "USD",
        accommodation: 0,
        activities: 0,
        dining: 110,
        transport: 0,
        total: 110,
      },
    ]);
    expect(result.unknownItems).toBe(0);
  });

  it("excludes unknown, zero, invalid and currencyless prices rather than implying free", () => {
    const result = summarizeBudget(
      [
        day([
          cost(90, "USD", { status: "unknown" }),
          cost(0, "USD"),
          cost(NaN, "USD"),
          cost(Infinity, "USD"),
          cost(-1, "USD"),
          cost(10, ""),
          cost(20, "bad currency"),
        ]),
      ],
      { startDate: "2026-06-01", endDate: "2026-06-03" },
      2,
    );
    expect(result.groups).toEqual([]);
    expect(result.unknownItems).toBe(8);
  });

  it("counts missing hotel estimates but not a hotel on a zero-night trip", () => {
    expect(
      summarizeBudget(
        [day()],
        { startDate: "2026-06-01", endDate: "2026-06-04" },
        1,
      ).unknownItems,
    ).toBe(1);
    expect(
      summarizeBudget(
        [day()],
        { startDate: "2026-06-01", endDate: "2026-06-01" },
        1,
      ).unknownItems,
    ).toBe(0);
  });

  it("handles legacy single meals and does not multiply a group price", () => {
    const legacy = {
      morning: { activities: [], meal: cost(30, "EUR", { perPerson: true }) },
      evening: { meals: [cost(80, "EUR", { perPerson: false })] },
    } as unknown as TripDay;
    expect(summarizeBudget([legacy], null, 4).groups[0].dining).toBe(200);
  });

  it("does not manufacture a party price when traveler count is invalid", () => {
    expect(
      summarizeBudget(
        [day([], [cost(20, "USD", { perPerson: true })])],
        null,
        NaN,
      ),
    ).toEqual({ groups: [], unknownItems: 1 });
  });

  it("formats the stated currency and never displays NaN, zero or missing currency as a quote", () => {
    expect(formatEstimate(120, "EUR")).toContain("EUR");
    expect(formatEstimate(0.25, "USD")).toContain("0.25");
    for (const amount of [0, -1, NaN, Infinity, undefined])
      expect(formatEstimate(amount, "USD")).toBe("Price unknown");
    expect(formatEstimate(100, undefined)).toBe("Price unknown");
    expect(formatEstimate(100, "USD", "unknown")).toBe("Price unknown");
  });
});

describe("occupied-night reconciliation", () => {
  const stay = { startDate: "2026-06-01", endDate: "2026-06-03" };
  const hotel = (
    id: string,
    pricePerNight: number,
    currency = "EUR",
  ): HotelResult => ({
    id,
    name: id,
    pricePerNight,
    currency,
    description: "Fixture",
    amenities: [],
    images: [],
    location: { name: "Paris", address: "", lat: 0, lng: 0 },
    vibeScore: 0,
    vibeMatch: [],
  });
  const days = [
    { ...day(), date: "2026-06-01", hotel: hotel("a", 100) },
    { ...day(), date: "2026-06-02", hotel: hotel("b", 200) },
    { ...day(), date: "2026-06-03", hotel: hotel("checkout", 9000) },
  ] as TripDay[];
  it("sums distinct occupied nights and excludes checkout regardless of row order", () => {
    expect(
      summarizeBudget([...days].reverse(), stay, 2).groups[0].accommodation,
    ).toBe(300);
    expect(featuredStayEstimate(days, stay, { id: "b" })).toEqual({
      amount: 200,
      currency: "EUR",
      nights: 1,
    });
    expect(featuredStayEstimate(days, stay, { id: "global-only" })).toBeNull();
    expect(featuredStayEstimate(days, stay, { id: "checkout" })).toBeNull();
  });
  it("suppresses uncertain assignments, gaps, duplicate dates and invalid ranges", () => {
    for (const rows of [
      days.slice(1),
      [...days, days[0]],
      [{ ...days[0], hotel: undefined }, days[1]],
    ]) {
      expect(occupiedHotelNights(rows, stay)).toBeNull();
      expect(summarizeBudget(rows, stay, 2)).toEqual({
        groups: [],
        unknownItems: 1,
      });
      expect(featuredStayEstimate(rows, stay, { id: "a" })).toBeNull();
    }
    expect(
      occupiedHotelNights(days, { startDate: "bad", endDate: "2026-06-03" }),
    ).toBeNull();
    expect(
      occupiedHotelNights(days, {
        startDate: "2026-06-04",
        endDate: "2026-06-03",
      }),
    ).toBeNull();
    expect(
      occupiedHotelNights(days, {
        startDate: "2026-02-30",
        endDate: "2026-06-03",
      }),
    ).toBeNull();
  });
  it("keeps currencies separate and suppresses mixed or unknown featured stay totals", () => {
    const mixed = [days[0], { ...days[1], hotel: hotel("b", 200, "USD") }];
    expect(
      summarizeBudget(mixed, stay, 2).groups.map((group) => [
        group.currency,
        group.accommodation,
      ]),
    ).toEqual([
      ["EUR", 100],
      ["USD", 200],
    ]);
    expect(featuredStayEstimate(mixed, stay, { id: "a" })).toBeNull();
    for (const amount of [0, NaN, Infinity, -1]) {
      const unknown = [days[0], { ...days[1], hotel: hotel("b", amount) }];
      expect(featuredStayEstimate(unknown, stay, { id: "a" })).toBeNull();
      expect(summarizeBudget(unknown, stay, 2).unknownItems).toBe(1);
    }
  });
  it("has no accommodation on a zero-night trip, even with a checkout hotel", () => {
    const zero = { startDate: "2026-06-03", endDate: "2026-06-03" };
    expect(summarizeBudget(days, zero, 2)).toEqual({
      groups: [],
      unknownItems: 0,
    });
    expect(featuredStayEstimate(days, zero, { id: "checkout" })).toBeNull();
  });
});
