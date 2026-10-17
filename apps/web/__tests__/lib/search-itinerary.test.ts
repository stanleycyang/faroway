import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ActivityResult,
  HotelResult,
  SearchPlan,
  SuggestedDay,
} from "@faroway/types";

const mocks = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/sdk", () => ({
  generateObject: mocks.generateObject,
  gateway: (model: string) => ({ model }),
  createGateway: () => (model: string) => ({ model }),
}));

import { runAggregatorAgent } from "@/lib/search/agents/aggregator";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";

const plan: SearchPlan = {
  destination: "Tokyo",
  country: "Japan",
  searchPriorities: ["hotels", "activities", "dining"],
  dates: { start: "2026-06-01", end: "2026-06-02", nights: 1 },
  vibeInterpretation: {
    vibes: ["culture"],
    searchKeywords: [],
    avoidKeywords: [],
  },
  hotelCriteria: {
    priceRange: { min: 100, max: 300 },
    starRating: [3, 4],
    amenities: [],
    neighborhoods: [],
  },
  activityCriteria: {
    categories: [],
    pacePreference: "moderate",
    mustSee: [],
    interests: [],
  },
  diningCriteria: {
    cuisineTypes: [],
    dietaryNeeds: [],
    priceRange: "moderate",
    mealPriorities: [],
  },
};

const hotel: HotelResult = {
  id: "hotel-1",
  name: "Central stay",
  description: "Near the station",
  amenities: ["wifi"],
  location: {
    name: "Tokyo",
    address: "Near the station",
    lat: 35.6,
    lng: 139.7,
  },
  images: [],
  vibeScore: 80,
  vibeMatch: ["culture"],
};

function activity(
  id: string,
  bestTimeOfDay: ActivityResult["bestTimeOfDay"] = "any",
): ActivityResult {
  return {
    id,
    name: id,
    description: "A local walk",
    category: "sightseeing",
    duration: 60,
    price: 0,
    currency: "USD",
    rating: 4,
    reviewCount: 10,
    location: { name: "Tokyo", address: "City center", lat: 35.6, lng: 139.7 },
    images: [],
    bestTimeOfDay,
    vibeScore: 80,
    vibeMatch: ["culture"],
    bookingRequired: false,
  };
}

function scheduledIds(days: SuggestedDay[]): string[] {
  return days.flatMap((day) =>
    [day.morning, day.afternoon, day.evening].flatMap((slot) =>
      slot.activities.map((item) => item.id),
    ),
  );
}

beforeEach(() => {
  mocks.generateObject.mockRejectedValue(new Error("Offline fallback fixture"));
});
afterEach(() => vi.unstubAllEnvs());

describe("search itinerary fallback", () => {
  it("schedules flexible activities once across all slots and days", async () => {
    const activities = Array.from({ length: 8 }, (_, i) =>
      activity(`walk-${i}`),
    );
    const { days } = await runAggregatorAgent(plan, [], activities, []);

    const ids = scheduledIds(days);
    expect(ids).toHaveLength(activities.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(activities.map((item) => item.id).sort());
  });

  it("does not repeat duplicate candidate IDs or fill exhausted slots", async () => {
    const flexible = activity("walk");
    const { days } = await runAggregatorAgent(
      plan,
      [],
      [flexible, { ...flexible }],
      [],
    );

    expect(scheduledIds(days)).toEqual(["walk"]);
    expect(days[0].afternoon.activities).toEqual([]);
    expect(days[0].evening.activities).toEqual([]);
    expect(scheduledIds(days.slice(1))).toEqual([]);
  });

  it("keeps fixed-time activities in eligible slots and preserves slot capacities", async () => {
    const activities = [
      activity("morning-1", "morning"),
      activity("morning-2", "morning"),
      activity("morning-3", "morning"),
      activity("afternoon", "afternoon"),
      activity("evening", "evening"),
    ];
    const { days } = await runAggregatorAgent(plan, [], activities, []);

    expect(days[0].morning.activities.map((item) => item.id)).toEqual([
      "morning-1",
      "morning-2",
    ]);
    expect(days[1].morning.activities.map((item) => item.id)).toEqual([
      "morning-3",
    ]);
    for (const day of days) {
      for (const time of ["morning", "afternoon", "evening"] as const) {
        expect(
          day[time].activities.every((item) => item.bestTimeOfDay === time),
        ).toBe(true);
      }
    }
    expect(scheduledIds(days)).toHaveLength(activities.length);
  });

  it.each([
    ["America/Los_Angeles", "2026-03-07", "2026-03-08", "2026-03-09"],
    ["Europe/Berlin", "2026-03-28", "2026-03-29", "2026-03-30"],
    ["UTC", "2028-02-28", "2028-02-29", "2028-03-01"],
    ["America/Los_Angeles", "2026-12-31", "2027-01-01", "2027-01-02"],
  ])(
    "keeps calendar dates consecutive in %s from %s",
    async (timezone, start, middle, end) => {
      vi.stubEnv("TZ", timezone);
      const { days } = await runAggregatorAgent(
        { ...plan, dates: { start, end, nights: 2 } },
        [],
        [],
        [],
      );

      expect(days.map((day) => day.date)).toEqual([start, middle, end]);
      expect(days.map((day) => day.dayNumber)).toEqual([1, 2, 3]);
      expect(scheduledIds(days)).toEqual([]);
    },
  );
});

describe("search itinerary bridge", () => {
  it("preserves each day's hotel, including unknown prices, without assigning one to an empty day", () => {
    const day: SuggestedDay = {
      dayNumber: 1,
      date: "2026-06-01",
      title: "Arrival",
      summary: "Explore Tokyo",
      hotel,
      morning: { activities: [] },
      afternoon: { activities: [] },
      evening: { activities: [] },
      estimatedCost: 0,
      currency: "USD",
      tips: [],
    };
    const anotherHotel = { ...hotel, id: "hotel-2", name: "Another stay" };
    const result = mapSearchResultsToItinerary(
      {
        searchId: "search-1",
        hotels: [hotel, anotherHotel],
        activities: [],
        dining: [],
        transport: [],
        itinerary: [
          day,
          { ...day, dayNumber: 2, date: "2026-06-02", hotel: anotherHotel },
          { ...day, dayNumber: 3, date: "2026-06-03", hotel: undefined },
        ],
      },
      hotel,
    );

    expect(result.days[0]).toHaveProperty("hotel", hotel);
    expect(result.days[1]).toHaveProperty("hotel", anotherHotel);
    expect(result.days[2].hotel).toBeUndefined();
    expect(result.days[0]).not.toHaveProperty("hotel.pricePerNight");
    expect(result.totalEstimatedCost).toBeUndefined();
  });
});
