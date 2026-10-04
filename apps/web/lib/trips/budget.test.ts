import { describe, expect, it } from "vitest";
import type { TripDay } from "@faroway/types";
import { formatEstimate, summarizeBudget } from "./budget";

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
      ],
      { pricePerNight: 120, currency: "EUR" },
      2,
      3,
    );
    expect(result.groups).toEqual([
      {
        currency: "EUR",
        accommodation: 240,
        activities: 40,
        dining: 0,
        transport: 0,
        total: 280,
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
      { pricePerNight: 0 },
      2,
      2,
    );
    expect(result.groups).toEqual([]);
    expect(result.unknownItems).toBe(8);
  });

  it("counts missing hotel estimates but not a hotel on a zero-night trip", () => {
    expect(summarizeBudget([day()], null, 3, 1).unknownItems).toBe(1);
    expect(summarizeBudget([day()], null, 0, 1).unknownItems).toBe(0);
  });

  it("handles legacy single meals and does not multiply a group price", () => {
    const legacy = {
      morning: { activities: [], meal: cost(30, "EUR", { perPerson: true }) },
      evening: { meals: [cost(80, "EUR", { perPerson: false })] },
    } as unknown as TripDay;
    expect(summarizeBudget([legacy], null, 0, 4).groups[0].dining).toBe(200);
  });

  it("does not manufacture a party price when traveler count is invalid", () => {
    expect(
      summarizeBudget(
        [day([], [cost(20, "USD", { perPerson: true })])],
        null,
        0,
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
