import { expect, it } from "vitest";
import { comparePublishedFlightFees } from "@/lib/affiliates/flight-fee-comparison";
it.each([
  [100, 2],
  [500, 5],
  [2000, 10],
])(
  "applies the published LiteAPI floor/cap at EUR %s",
  (bookingValueEur, ticketing) => {
    const result = comparePublishedFlightFees({
      bookingValueEur,
      usdToEur: 0.9,
      duffelManagedContent: true,
    });
    expect(result.liteapi.ticketing).toBe(ticketing);
    expect(result.duffel.knownFees).toBe(2.7 + bookingValueEur * 0.01);
    expect(result.allInComparisonComplete).toBe(false);
  },
);
it("does not mistake cheaper ticketing for cheaper overall servicing", () => {
  const result = comparePublishedFlightFees({
    bookingValueEur: 500,
    usdToEur: 0.9,
    duffelManagedContent: true,
    liteApiVoluntaryChanges: 1,
  });
  expect(result.liteapi.knownFees).toBe(30);
  expect(result.duffel.knownFees).toBe(7.7);
  expect(result.excluded).toContain(
    "Airline penalties and Duffel servicing terms",
  );
});
it("models excess search costs in their own currencies and optional managed content", () => {
  const result = comparePublishedFlightFees({
    bookingValueEur: 500,
    usdToEur: 0.9,
    duffelManagedContent: false,
    excessSearches: 1000,
    paidAncillaries: 2,
  });
  expect(result.liteapi.excessSearches).toBe(5);
  expect(result.duffel.excessSearches).toBe(4.5);
  expect(result.duffel.managedContent).toBe(0);
  expect(result.duffel.ancillaries).toBe(3.6);
});
it("requires explicit valid FX instead of silently treating EUR and USD as equivalent", () => {
  expect(() =>
    comparePublishedFlightFees({
      bookingValueEur: 500,
      usdToEur: 0,
      duffelManagedContent: true,
    }),
  ).toThrow();
});
