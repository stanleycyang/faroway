import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SharedTripView } from "@/components/trips/SharedTripView";
import type { TripDay } from "@/lib/ai/types";

function renderTransport(transport: TripDay["transport"]) {
  const empty = { activities: [], meals: [] };
  const day: TripDay = {
    dayNumber: 1,
    date: "2026-11-01",
    title: "Arrival",
    summary: "Arrive in Tokyo",
    morning: empty,
    afternoon: empty,
    evening: empty,
    tips: [],
    totalEstimatedCost: { amount: 0, currency: "GBP" },
    transport,
  };
  return renderToStaticMarkup(
    <SharedTripView
      destination="Tokyo"
      startDate="2026-11-01"
      endDate="2026-11-04"
      travelers={2}
      shareToken="fixture"
      shareUrl="https://example.invalid/s/fixture"
      itinerary={{
        days: [day],
        overview: "A shared journey",
        generatedAt: "2026-10-01",
      }}
    />,
  );
}

test("shared transport retains provider-local times and its reported currency without a party-price claim", () => {
  const html = renderTransport({
    type: "flight",
    provider: "Fixture Air",
    departure: {
      airport: "LHR",
      city: "London",
      dateTime: "2026-11-01T22:15:00+00:00",
    },
    arrival: {
      airport: "HND",
      city: "Tokyo",
      dateTime: "2026-11-02T19:40:00+09:00",
    },
    duration: 735,
    stops: 0,
    price: 137,
    currency: "GBP",
  });
  expect(html).toContain("Fixture Air");
  expect(html).toContain("22:15");
  expect(html).toContain("19:40");
  expect(html).toContain("GBP");
  expect(html).not.toContain("per person");
  expect(html).not.toContain("60 seconds");
  expect(html).toContain('aria-label="Faroway home"');
});

test("a legacy shared transport record with missing facts stays readable", () => {
  const html = renderTransport({ type: "flight" } as TripDay["transport"]);
  expect(html).toContain("Airport unavailable");
  expect(html).toContain("Time unavailable");
  expect(html).toContain("Duration unavailable");
  expect(html).toContain("Price unknown");
  expect(html).not.toContain("NaN");
});
