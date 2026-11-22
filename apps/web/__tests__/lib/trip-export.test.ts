import { describe, expect, it } from "vitest";
import type { TripDay } from "@faroway/types";
import {
  buildTripExportFilename,
  buildTripExportText,
  type TripExportTrip,
} from "@/lib/trips/export";
import { sanitizeExportEssentials } from "@/lib/trips/export-links";

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

  it("includes allowed affiliate booking URLs, essentials, disclosure, and Viator gating", () => {
    const day = {
      dayNumber: 1,
      date: "2026-04-01",
      title: "Arrival",
      summary: "Explore",
      morning: {
        activities: [
          {
            id: "gyg-1",
            name: "Food Tour",
            bookingInfo: {
              requiresReservation: true,
              bookingUrl:
                "https://www.getyourguide.com/activity-t123/?partner_id=GYG1",
              affiliateId: "getyourguide",
            },
          },
          {
            id: "activity_v_1",
            name: "Viator Legacy Tour",
            affiliatePartner: "viator",
            bookingInfo: {
              requiresReservation: true,
              bookingUrl:
                "https://www.viator.com/tours/Tokyo/t1?pid=P1&mcid=1&medium=api",
              affiliateId: "viator",
            },
          },
          {
            id: "bad-1",
            name: "Unallowed Link Tour",
            bookingInfo: {
              requiresReservation: true,
              bookingUrl: "https://evil.example/book",
            },
          },
        ],
        meals: [
          {
            id: "meal-1",
            name: "Sushi Counter",
            reservationInfo: {
              recommended: true,
              url: "https://www.opentable.com/booking/restref/availability?rid=12345",
            },
          },
        ],
      },
      afternoon: { activities: [], meals: [] },
      evening: { activities: [], meals: [] },
      transport: {
        type: "flight",
        provider: "JAL",
        departure: {
          airport: "SFO",
          city: "San Francisco",
          dateTime: "2026-04-01T10:00:00Z",
        },
        arrival: {
          airport: "HND",
          city: "Tokyo",
          dateTime: "2026-04-02T14:00:00Z",
        },
        duration: 660,
        stops: 0,
        price: 900,
        currency: "USD",
        affiliateUrl: "https://links.duffel.com/sess_1",
      },
      tips: [],
    } as unknown as TripDay;

    const text = buildTripExportText(
      trip,
      {
        overview: "Overview",
        topHotel: {
          id: "h1",
          name: "Hotel Century",
          description: "Central",
          amenities: [],
          location: { name: "Shinjuku", address: "1-1", lat: 0, lng: 0 },
          images: [],
          vibeScore: 90,
          vibeMatch: [],
          affiliateUrl:
            "https://www.stay22.com/allez/roam?aid=s1&address=Tokyo",
          affiliatePartner: "stay22",
        },
        days: [day],
      },
      new Date("2026-04-08T12:00:00.000Z"),
      {
        viatorContentEnabled: false,
        essentials: [
          {
            label: "Airalo Japan eSIM",
            category: "esim",
            url: "https://www.airalo.com/japan-esim?ref=a1",
          },
          {
            label: "Blocked Essential",
            category: "other",
            url: "https://evil.example/bad",
          },
        ],
      },
    );

    expect(text).toContain("Top Hotel: Hotel Century");
    expect(text).toContain(
      "https://www.stay22.com/allez/roam?aid=s1&address=Tokyo",
    );
    expect(text).toContain(
      "https://www.getyourguide.com/activity-t123/?partner_id=GYG1",
    );
    expect(text).toContain(
      "https://www.opentable.com/booking/restref/availability?rid=12345",
    );
    expect(text).toContain("https://links.duffel.com/sess_1");
    expect(text).toContain("Airalo Japan eSIM");
    expect(text).not.toContain("Viator Legacy Tour");
    expect(text).not.toContain("evil.example");
    expect(text).toContain("commission");
    expect(text.match(/Transport:/g)).toHaveLength(1);
  });

  it("blocks viator.com URLs in sanitizeExportEssentials and exports when viatorContentEnabled is false", () => {
    const essentials = [
      {
        label: "Tours on Viator",
        category: "activities",
        url: "https://www.viator.com/tours/Tokyo/t1?pid=P1&mcid=1&medium=api",
      },
      {
        label: "Airalo Japan eSIM",
        category: "esim",
        url: "https://www.airalo.com/japan-esim?ref=a1",
      },
    ];

    const filtered = sanitizeExportEssentials(essentials, "export_txt", false);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.label).toBe("Airalo Japan eSIM");

    const text = buildTripExportText(
      trip,
      null,
      new Date("2026-04-08T12:00:00.000Z"),
      {
        viatorContentEnabled: false,
        essentials,
      },
    );
    expect(text).toContain("Airalo Japan eSIM");
    expect(text).not.toContain("viator.com");
  });

  it("never throws on missing, padded, or malformed currencies in totalEstimatedCost or day.totalEstimatedCost", () => {
    const makeDay = (currency: unknown, amount = 140) =>
      ({
        dayNumber: 1,
        date: "2026-04-01",
        title: "Arrival",
        summary: "Explore",
        morning: { activities: [], meals: [] },
        afternoon: { activities: [], meals: [] },
        evening: { activities: [], meals: [] },
        totalEstimatedCost: { amount, currency },
        tips: [],
      }) as unknown as TripDay;

    for (const badCurrency of ["", "INVALID", "US", undefined, null, 123]) {
      const text = buildTripExportText(
        trip,
        {
          totalEstimatedCost: {
            amount: 1500,
            currency: badCurrency as string,
          },
          days: [makeDay(badCurrency)],
        },
        new Date("2026-04-08T12:00:00.000Z"),
      );
      expect(text).toContain("Estimated total: 1,500");
      expect(text).toContain("Day estimate: 140");
    }

    const paddedUsd = buildTripExportText(
      trip,
      {
        totalEstimatedCost: { amount: 1500, currency: " usd " },
        days: [makeDay(" eur ", 220)],
      },
      new Date("2026-04-08T12:00:00.000Z"),
    );
    expect(paddedUsd).toContain("Estimated total: $1,500");
    expect(paddedUsd).toContain("Day estimate: €220");

    const nonFinite = buildTripExportText(
      trip,
      {
        totalEstimatedCost: { amount: Number.NaN, currency: "USD" },
        days: [makeDay("USD", Number.POSITIVE_INFINITY)],
      },
      new Date("2026-04-08T12:00:00.000Z"),
    );
    expect(nonFinite).not.toContain("Estimated total:");
    expect(nonFinite).not.toContain("Day estimate:");
  });
});
