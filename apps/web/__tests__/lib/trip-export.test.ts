import { describe, expect, it } from "vitest";
import type { TripDay } from "@faroway/types";
import {
  buildTripExportFilename,
  buildTripExportText,
  type TripExportTrip,
} from "@/lib/trips/export";

const trip: TripExportTrip = {
  destination: "Tokyo, Japan",
  start_date: "2026-04-01",
  end_date: "2026-04-07",
  travelers: 2,
  status: "generated",
};

describe("trip export helpers", () => {
  it("builds a stable filename from the destination and start date", () => {
    expect(buildTripExportFilename(trip)).toBe(
      "faroway-tokyo-japan-2026-04-01.txt",
    );
  });

  it("exports itinerary details as readable text", () => {
    const day = {
      dayNumber: 1,
      date: "2026-04-01",
      title: "Arrival",
      summary: "Settle in and explore the neighborhood.",
      morning: {
        activities: [{ name: "Senso-ji Temple" }],
        meals: [{ name: "Tsukiji breakfast" }],
      },
      afternoon: { activities: [], meals: [] },
      evening: { activities: [], meals: [] },
      transport: {
        type: "train",
        provider: "JR",
        departure: {
          airport: "NRT",
          city: "Narita",
          dateTime: "2026-04-01T10:00:00Z",
        },
        arrival: {
          airport: "TYO",
          city: "Tokyo",
          dateTime: "2026-04-01T11:00:00Z",
        },
        duration: 60,
        stops: 0,
        price: 25,
        currency: "USD",
      },
      totalEstimatedCost: { amount: 140, currency: "USD" },
      tips: ["Bring cash for small vendors."],
    } as unknown as TripDay;

    const text = buildTripExportText(
      trip,
      {
        overview: "A focused week in Tokyo.",
        totalEstimatedCost: 3000,
        days: [day],
        packingList: ["Passport"],
        generalTips: ["Reserve popular restaurants early."],
      },
      new Date("2026-04-08T12:00:00.000Z"),
    );

    expect(text).toContain("Faroway Trip Export");
    expect(text).toContain("Destination: Tokyo, Japan");
    expect(text).toContain("Estimated total: $3,000");
    expect(text).toContain("Day 1: Arrival");
    expect(text).toContain("  - Senso-ji Temple");
    expect(text).toContain("  - Tsukiji breakfast");
    expect(text).toContain("Transport:");
    expect(text).toContain("Packing Suggestions");
    expect(text).toContain("Exported: 2026-04-08T12:00:00.000Z");
  });
});
