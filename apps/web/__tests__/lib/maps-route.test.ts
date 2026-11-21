import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TripDay } from "@faroway/types";
import {
  buildAppleMapsDayRouteUrl,
  buildGoogleMapsDayRouteUrl,
  summarizeDayClustering,
} from "@/lib/trips/maps-route";
import { ItineraryDay } from "@/components/trips/ItineraryDay";
import { SharedTripView } from "@/components/trips/SharedTripView";

function makeActivity(
  id: string,
  name: string,
  location: {
    name: string;
    address?: string;
    neighborhood?: string;
    coordinates?: { lat: number; lng: number };
  },
) {
  return {
    id,
    name,
    description: "Stop description",
    duration: 60,
    estimatedCost: { amount: 10, currency: "USD" },
    timeOfDay: "morning" as const,
    category: "sightseeing" as const,
    location,
    vibeMatch: { matchedVibes: [], reasoning: "" },
  };
}

function makeEmptyDay(): TripDay {
  return {
    dayNumber: 1,
    date: "2026-05-10",
    title: "Free Day",
    summary: "",
    morning: { activities: [], meals: [] },
    afternoon: { activities: [], meals: [] },
    evening: { activities: [], meals: [] },
    tips: [],
  };
}

describe("maps-route helpers", () => {
  it("returns null URLs and empty clustering for a day with no stops", () => {
    const emptyDay = makeEmptyDay();
    expect(buildGoogleMapsDayRouteUrl(emptyDay, "Kyoto")).toBeNull();
    expect(buildAppleMapsDayRouteUrl(emptyDay, "Kyoto")).toBeNull();
    expect(summarizeDayClustering(emptyDay)).toEqual({
      neighborhoods: [],
      estimatedDistanceKm: null,
      stopCount: 0,
      summaryLabel: null,
    });
  });

  it("builds safely encoded Google & Apple Maps multi-stop routes and walking clustering summary", () => {
    const day: TripDay = {
      ...makeEmptyDay(),
      morning: {
        activities: [
          makeActivity("1", "Kiyomizu-dera", {
            name: "Higashiyama",
            address: "1-294 Kiyomizu, Kyoto",
            coordinates: { lat: 34.9949, lng: 135.785 },
          }),
          makeActivity("2", "Ninenzaka & Sannenzaka", {
            name: "Higashiyama",
            coordinates: { lat: 34.9978, lng: 135.7808 },
          }),
        ],
        meals: [],
      },
      afternoon: {
        activities: [
          makeActivity("3", "Yasaka Shrine", {
            name: "Gion",
            coordinates: { lat: 35.0037, lng: 135.7785 },
          }),
        ],
        meals: [],
      },
      evening: {
        activities: [
          makeActivity("4", "Hanamikoji Street", {
            name: "Gion",
            coordinates: { lat: 35.0025, lng: 135.7751 },
          }),
        ],
        meals: [],
      },
    };

    const googleUrl = buildGoogleMapsDayRouteUrl(day, "Kyoto");
    const appleUrl = buildAppleMapsDayRouteUrl(day, "Kyoto");
    const summary = summarizeDayClustering(day);

    expect(googleUrl).not.toBeNull();
    const parsedGoogle = new URL(googleUrl!);
    expect(parsedGoogle.origin + parsedGoogle.pathname).toBe(
      "https://www.google.com/maps/dir/",
    );
    expect(parsedGoogle.searchParams.get("api")).toBe("1");
    expect(parsedGoogle.searchParams.get("origin")).toContain("Kiyomizu-dera");
    expect(parsedGoogle.searchParams.get("destination")).toContain(
      "Hanamikoji Street",
    );
    expect(parsedGoogle.searchParams.get("waypoints")).toContain(
      "Ninenzaka & Sannenzaka",
    );
    expect(parsedGoogle.searchParams.get("waypoints")).toContain(
      "Yasaka Shrine",
    );
    expect(parsedGoogle.searchParams.get("travelmode")).toBe("walking");

    expect(appleUrl).not.toBeNull();
    const parsedApple = new URL(appleUrl!);
    expect(parsedApple.origin).toBe("https://maps.apple.com");
    expect(parsedApple.searchParams.get("saddr")).toContain("Kiyomizu-dera");
    expect(parsedApple.searchParams.getAll("daddr")).toHaveLength(3);
    expect(parsedApple.searchParams.get("dirflg")).toBe("w");

    expect(summary.stopCount).toBe(4);
    expect(summary.neighborhoods).toEqual(["Higashiyama", "Gion"]);
    expect(summary.estimatedDistanceKm).not.toBeNull();
    expect(summary.estimatedDistanceKm!).toBeGreaterThan(1);
    expect(summary.estimatedDistanceKm!).toBeLessThan(3);
    expect(summary.summaryLabel).toMatch(
      /^Higashiyama & Gion · ~\d+\.\d km across 4 stops$/,
    );
  });

  it("caps Google Maps waypoints at 9 when a day has > 11 stops and uses driving for wide multi-stop routes", () => {
    const manyActivities = Array.from({ length: 13 }, (_, idx) =>
      makeActivity(`stop-${idx}`, `Stop #${idx + 1} | Co`, {
        name: `District ${idx + 1}`,
        coordinates: { lat: 35.65 + idx * 0.02, lng: 139.7 + idx * 0.01 },
      }),
    );

    const packedDay: TripDay = {
      ...makeEmptyDay(),
      morning: { activities: manyActivities, meals: [] },
    };

    const googleUrl = buildGoogleMapsDayRouteUrl(packedDay, "Tokyo")!;
    const parsed = new URL(googleUrl);
    const waypoints = (parsed.searchParams.get("waypoints") || "").split("|");
    expect(waypoints).toHaveLength(9);
    // Driving preserves waypoints (Google Maps drops waypoints in transit mode)
    expect(parsed.searchParams.get("travelmode")).toBe("driving");

    const appleUrl = buildAppleMapsDayRouteUrl(packedDay, "Tokyo")!;
    const parsedApple = new URL(appleUrl);
    expect(parsedApple.searchParams.get("dirflg")).toBe("d");
    const appleDaddrs = parsedApple.searchParams.getAll("daddr");
    expect(appleDaddrs[appleDaddrs.length - 1]).toContain("Stop #13");
  });

  it("handles single-stop days and missing coordinates cleanly", () => {
    const singleDay: TripDay = {
      ...makeEmptyDay(),
      morning: {
        activities: [
          makeActivity("only", "Louvre Museum", {
            name: "1st Arrondissement",
          }),
        ],
        meals: [],
      },
    };

    const googleUrl = buildGoogleMapsDayRouteUrl(singleDay, "Paris")!;
    const appleUrl = buildAppleMapsDayRouteUrl(singleDay, "Paris")!;
    const summary = summarizeDayClustering(singleDay);

    expect(new URL(googleUrl).searchParams.get("destination")).toBe(
      "Louvre Museum, 1st Arrondissement, Paris",
    );
    expect(new URL(appleUrl).searchParams.get("daddr")).toBe(
      "Louvre Museum, 1st Arrondissement, Paris",
    );
    expect(summary.estimatedDistanceKm).toBeNull();
    expect(summary.stopCount).toBe(1);
    expect(summary.summaryLabel).toBe("1 stop");
  });

  it("renders day clustering, Google/Apple Maps links, and remix buttons in ItineraryDay", () => {
    const day: TripDay = {
      ...makeEmptyDay(),
      morning: {
        activities: [
          makeActivity("1", "Kiyomizu-dera", {
            name: "Higashiyama",
            coordinates: { lat: 34.9949, lng: 135.785 },
          }),
          makeActivity("2", "Yasaka Shrine", {
            name: "Gion",
            coordinates: { lat: 35.0037, lng: 135.7785 },
          }),
        ],
        meals: [],
      },
    };

    const html = renderToStaticMarkup(
      createElement(ItineraryDay, {
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
        summary: day.summary,
        morning: day.morning,
        afternoon: day.afternoon,
        evening: day.evening,
        destination: "Kyoto",
        vibes: ["sightseeing"],
        onQuickAction: () => {},
      }),
    );

    expect(html).toContain("Higashiyama &amp; Gion");
    expect(html).toContain("Google Maps route");
    expect(html).toContain("Apple Maps");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Relax this day");
    expect(html).toContain("Rainy-day backup");
  });

  it("renders stop voting and Clone & customize CTA with query params in SharedTripView", () => {
    const day: TripDay = {
      ...makeEmptyDay(),
      morning: {
        activities: [
          makeActivity("1", "Kiyomizu-dera", {
            name: "Higashiyama",
            coordinates: { lat: 34.9949, lng: 135.785 },
          }),
        ],
        meals: [],
      },
    };

    const html = renderToStaticMarkup(
      createElement(SharedTripView, {
        destination: "Kyoto",
        startDate: "2026-05-10",
        endDate: "2026-05-13",
        travelers: 3,
        budgetTier: "moderate",
        vibes: ["foodie", "culture"],
        shareToken: "share_tok_1234",
        shareUrl: "https://www.faroway.ai/s/share_tok_1234",
        itinerary: {
          days: [day],
          overview: "Kyoto highlights",
          generatedAt: "2026-05-01T00:00:00Z",
        },
      }),
    );

    expect(html).toContain("Clone &amp; customize this trip");
    expect(html).toContain(
      "/create?destination=Kyoto&amp;travelers=3&amp;budget=moderate&amp;vibes=foodie%2Cculture",
    );
    expect(html).toContain("Vote on Day 1 stops");
    expect(html).toContain("Thumbs up Kiyomizu-dera");
    expect(html).toContain("Love Kiyomizu-dera");
  });
});
