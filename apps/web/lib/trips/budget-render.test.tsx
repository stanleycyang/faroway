import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { TripBudget } from "@/components/trips/TripBudget";
import { FeaturedHotelCard } from "@/components/trips/FeaturedHotelCard";
import { summarizeBudget } from "./budget";
import type { TripDay } from "@faroway/types";

describe("traveler-facing price provenance", () => {
  it("renders separate currency estimates, party basis and missing-price disclosure", () => {
    const days = [
      {
        morning: {
          activities: [
            { estimatedCost: { amount: 50, currency: "EUR" } },
            {
              estimatedCost: { amount: 0, status: "unknown", currency: "USD" },
            },
          ],
          meals: [
            { estimatedCost: { amount: 25, currency: "USD", perPerson: true } },
          ],
        },
      },
    ] as TripDay[];
    const html = renderToStaticMarkup(
      <TripBudget budget={summarizeBudget(days, null, 0, 4)} travelers={4} />,
    );
    expect(html).toContain("EUR");
    expect(html).toContain("USD");
    expect(html).toContain("100");
    expect(html).toContain("include 4 travelers");
    expect(html).toContain("1 item(s) have unknown prices");
    expect(html).toContain("Listed estimate subtotal");
    expect(html).not.toContain("Estimated Total");
  });
  it.each([0, NaN, Infinity])(
    "never presents unknown hotel price %s as a stay total",
    (pricePerNight) => {
      const html = renderToStaticMarkup(
        <FeaturedHotelCard
          hotel={{
            name: "Fixture hotel",
            pricePerNight,
            currency: "EUR",
            affiliateUrl: "https://example.com",
          }}
          nights={3}
        />,
      );
      expect(html).toContain("Price unknown");
      expect(html).not.toContain("Stay estimate");
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("Infinity");
      expect(html).not.toContain("Best price guarantee");
      expect(html).not.toContain("Free cancellation");
      expect(html).not.toContain("No hidden fees");
      expect(html).toContain("cancellation terms");
    },
  );
  it("renders hotel currency and estimated basis for nightly and stay prices", () => {
    const html = renderToStaticMarkup(
      <FeaturedHotelCard
        hotel={{ name: "Fixture hotel", pricePerNight: 120, currency: "EUR" }}
        nights={3}
      />,
    );
    expect(html).toContain("EUR");
    expect(html).toContain("120");
    expect(html).toContain("360");
    expect(html).toContain("estimated per night");
    expect(html).not.toContain("$");
  });
  it("does not assume USD when a legacy hotel has no currency", () => {
    const html = renderToStaticMarkup(
      <FeaturedHotelCard
        hotel={{ name: "Fixture hotel", pricePerNight: 100 }}
        nights={3}
      />,
    );
    expect(html).toContain("Price unknown");
    expect(html).not.toContain("Stay estimate");
  });
});
