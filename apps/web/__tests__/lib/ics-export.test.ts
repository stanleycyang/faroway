import { describe, expect, it } from "vitest";
import {
  dayTimingBasis,
  type GeneratedItinerary,
  type TripDay,
} from "@faroway/types";
import {
  buildTripIcsContent,
  buildTripIcsFilename,
} from "@/lib/trips/ics-export";
import {
  buildTripIcsContent as reexportedBuildTripIcsContent,
  buildTripIcsFilename as reexportedBuildTripIcsFilename,
} from "@/lib/trips/export";

function makeDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber: 1,
    date: "2026-05-10",
    title: "Historic Kyoto",
    summary: "Temples and tea houses",
    morning: {
      activities: [
        {
          id: "act-1",
          name: "Kiyomizu-dera, Main Hall; Terrace",
          description:
            "Panoramic hilltop temple.\nBring comfortable shoes, cash; enjoy views\\paths.",
          duration: 90,
          estimatedCost: { amount: 5, currency: "USD" },
          timeOfDay: "morning",
          category: "cultural",
          location: {
            name: "Kiyomizu-dera",
            address: "1-294 Kiyomizu, Higashiyama-ku, Kyoto",
          },
          vibeMatch: {
            matchedVibes: ["culture"],
            reasoning: "Historic landmark",
          },
        },
      ],
      meals: [
        {
          id: "meal-1",
          name: "Inoda Coffee",
          cuisineType: ["Cafe"],
          description: "Classic Kyoto morning coffee.",
          estimatedCost: { amount: 15, currency: "USD", perPerson: true },
          mealType: "breakfast",
          location: { name: "Nakagyo-ku, Kyoto" },
          dietaryOptions: [],
          vibeMatch: { matchedVibes: ["foodie"], reasoning: "Local staple" },
        },
      ],
    },
    afternoon: {
      activities: [],
      meals: [],
    },
    evening: {
      activities: [],
      meals: [
        {
          id: "meal-2",
          name: "Gion Kappo",
          cuisineType: ["Japanese"],
          description: "Seasonal dinner in Gion.",
          estimatedCost: { amount: 65, currency: "USD", perPerson: true },
          mealType: "dinner",
          location: { name: "Gion, Kyoto" },
          dietaryOptions: [],
          vibeMatch: {
            matchedVibes: ["foodie"],
            reasoning: "Seasonal cuisine",
          },
        },
      ],
    },
    tips: [],
    ...overrides,
  };
}

describe("ics-export", () => {
  it("re-exports ICS helpers from export.ts", () => {
    expect(reexportedBuildTripIcsContent).toBe(buildTripIcsContent);
    expect(reexportedBuildTripIcsFilename).toBe(buildTripIcsFilename);
  });

  it("builds a clean .ics filename", () => {
    expect(
      buildTripIcsFilename({
        destination: "Kyoto, Japan",
        start_date: "2026-05-10",
      }),
    ).toBe("faroway-kyoto-japan-2026-05-10.ics");
    expect(
      buildTripIcsFilename({
        destination: "   ",
        start_date: "2026-05-10",
      }),
    ).toBe("faroway-trip-2026-05-10.ics");
  });

  it("generates valid RFC 5545 VCALENDAR with CRLF endings, escaped text, and folded lines", () => {
    const day = makeDay();
    const itinerary: GeneratedItinerary = {
      tripId: "trip-1",
      destination: "Kyoto, Japan",
      startDate: "2026-05-10",
      endDate: "2026-05-12",
      days: [day],
      totalEstimatedCost: { amount: 1200, currency: "USD" },
      overview: "Three days in Kyoto.",
      generatedAt: "2026-05-01T00:00:00Z",
    };

    const ics = buildTripIcsContent(
      {
        destination: "Kyoto, Japan",
        start_date: "2026-05-10",
        end_date: "2026-05-12",
        travelers: 2,
        status: "generated",
      },
      itinerary,
      new Date("2026-05-01T12:00:00Z"),
    );

    // Strictly CRLF line endings
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);

    // Every physical line obeys the RFC 5545 75-octet limit
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }

    // Unfold lines for content assertions
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("BEGIN:VCALENDAR\r\n");
    expect(unfolded).toContain("VERSION:2.0\r\n");
    expect(unfolded).toContain("END:VCALENDAR\r\n");
    expect(unfolded).toContain("DTSTAMP:20260501T120000Z\r\n");
    expect(unfolded).toContain(
      "SUMMARY:Kiyomizu-dera\\, Main Hall\\; Terrace\r\n",
    );
    expect(unfolded).toContain(
      "LOCATION:Kiyomizu-dera\\, 1-294 Kiyomizu\\, Higashiyama-ku\\, Kyoto\r\n",
    );
    expect(unfolded).toContain(
      "Panoramic hilltop temple.\\nBring comfortable shoes\\, cash\\; enjoy views\\\\paths.",
    );
    expect(unfolded).toContain("DTSTART:20260510T083000\r\n");
    expect(unfolded).toContain("DTEND:20260510T091500\r\n");
    expect(unfolded).toContain("DTSTART:20260510T193000\r\n");
    expect(unfolded).toContain("DTEND:20260510T204500\r\n");
  });

  it("uses validated timingProposal start/end minutes when present", () => {
    const baseDay = makeDay({
      evening: { activities: [], meals: [] },
    });
    const basis = dayTimingBasis(baseDay);
    const timedDay: TripDay = {
      ...baseDay,
      timingProposal: {
        policy: "day-timing-v1",
        basis,
        fitsPolicy: true,
        verified: false,
        conflict: null,
        events: [
          {
            id: "meal:morning:meal-1",
            kind: "meal",
            durationMinutes: 45,
            startMinute: 480, // 08:00
            endMinute: 525, // 08:45
            bufferBeforeMinutes: 0,
          },
          {
            id: "activity:act-1",
            kind: "activity",
            durationMinutes: 90,
            startMinute: 555, // 09:15
            endMinute: 645, // 10:45
            bufferBeforeMinutes: 30,
          },
        ],
      },
    };

    const ics = buildTripIcsContent(
      { destination: "Kyoto", start_date: "2026-05-10" },
      {
        tripId: "t1",
        destination: "Kyoto",
        startDate: "2026-05-10",
        endDate: "2026-05-10",
        days: [timedDay],
        totalEstimatedCost: { amount: 200, currency: "USD" },
        overview: "",
        generatedAt: "2026-05-01T00:00:00Z",
      },
      new Date("2026-05-01T00:00:00Z"),
    );

    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DTSTART:20260510T080000\r\n");
    expect(unfolded).toContain("DTEND:20260510T084500\r\n");
    expect(unfolded).toContain("DTSTART:20260510T091500\r\n");
    expect(unfolded).toContain("DTEND:20260510T104500\r\n");
  });

  it("handles null itinerary cleanly without emitting VEVENTs", () => {
    const ics = buildTripIcsContent(
      { destination: "Lisbon", start_date: "2026-07-01" },
      null,
      new Date("2026-06-01T00:00:00Z"),
    );

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("END:VCALENDAR\r\n");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
