import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ActivityResult,
  HotelResult,
  SearchPlan,
  SuggestedDay,
  TransportResult,
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

const outbound: TransportResult = {
  id: "outbound-1",
  type: "flight",
  provider: "Outbound airline",
  departure: {
    airport: "SFO",
    city: "San Francisco",
    dateTime: "2026-06-01T10:00:00Z",
  },
  arrival: { airport: "NRT", city: "Tokyo", dateTime: "2026-06-02T14:00:00Z" },
  duration: 660,
  stops: 0,
  price: 900,
  currency: "USD",
  affiliateUrl: "https://example.com/offer",
  affiliatePartner: "duffel",
  airlines: ["Outbound airline"],
  segments: [],
  source: "duffel",
  vibeScore: 0,
  vibeMatch: [],
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

function generatedDay(dayNumber: number, hotelId?: string) {
  return {
    dayNumber,
    date: `2026-06-0${dayNumber}`,
    title: `AI day ${dayNumber}`,
    summary: "Explore Tokyo",
    hotelId,
    transportId: undefined as string | undefined,
    morning: { activityIds: [] as string[] },
    afternoon: { activityIds: [] as string[] },
    evening: { activityIds: [] as string[] },
    estimatedCost: 0,
    currency: "USD",
    tips: [],
  };
}

describe.each(["successful", "recovered"] as const)(
  "%s AI itinerary mapping",
  (responsePath) => {
    function respondWith(result: {
      days: ReturnType<typeof generatedDay>[];
      topHotelId?: string;
    }) {
      if (responsePath === "successful") {
        mocks.generateObject.mockResolvedValue({ object: result });
      } else {
        mocks.generateObject.mockRejectedValue(
          Object.assign(new Error("Offline schema recovery fixture"), {
            text: JSON.stringify({
              days: JSON.stringify(result.days),
              topHotelId: result.topHotelId,
            }),
          }),
        );
      }
    }

    it("honors a valid day hotel and falls back to the selected top hotel for missing or unknown IDs", async () => {
      const topHotel = { ...hotel, id: "hotel-top", name: "Top stay" };
      const dayHotel = { ...hotel, id: "hotel-day", name: "Selected day stay" };
      respondWith({
        topHotelId: topHotel.id,
        days: [
          generatedDay(1, dayHotel.id),
          generatedDay(2),
          generatedDay(3, "unknown-hotel"),
        ],
      });
      const hotels = [hotel, topHotel, dayHotel];
      const result = await runAggregatorAgent(
        { ...plan, dates: { ...plan.dates, end: "2026-06-03", nights: 2 } },
        hotels,
        [],
        [],
      );

      expect(result.topHotel).toBe(topHotel);
      expect(result.days[0].hotel).toBe(dayHotel);
      expect(result.days[1].hotel).toBe(topHotel);
      expect(result.days[2].hotel).toBe(topHotel);
      expect(result.days[0].title).toBe("AI day 1");
      const mapped = mapSearchResultsToItinerary(
        {
          searchId: "search-1",
          hotels,
          activities: [],
          dining: [],
          transport: [],
          itinerary: result.days,
        },
        result.topHotel,
      );
      expect(mapped.days.map((day) => day.hotel)).toEqual([
        dayHotel,
        topHotel,
        topHotel,
      ]);
    });

    it.each([undefined, "unknown-top"])(
      "retains the first-hotel fallback when topHotelId is %s",
      async (topHotelId) => {
        const anotherHotel = { ...hotel, id: "hotel-2" };
        respondWith({
          topHotelId,
          days: [generatedDay(1), generatedDay(2, "unknown-hotel")],
        });
        const result = await runAggregatorAgent(
          plan,
          [hotel, anotherHotel],
          [],
          [],
        );

        expect(result.topHotel).toBe(hotel);
        expect(result.days.map((day) => day.hotel)).toEqual([hotel, hotel]);
        expect(result.days[0].title).toBe("AI day 1");
      },
    );

    it("leaves hotel absent when no hotel candidate exists", async () => {
      respondWith({
        topHotelId: "unknown-top",
        days: [generatedDay(1, "unknown-hotel"), generatedDay(2)],
      });
      const result = await runAggregatorAgent(plan, [], [], []);

      expect(result.topHotel).toBeNull();
      expect(result.days.map((day) => day.hotel)).toEqual([
        undefined,
        undefined,
      ]);
      expect(result.days[0].title).toBe("AI day 1");
    });

    it("keeps the first known activity occurrence across slots and days with provider provenance intact", async () => {
      vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
      vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "offline-content-review");
      vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_ENABLED", "true");
      vi.stubEnv(
        "VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF",
        "offline-ai-review",
      );
      const first = activity("first");
      const provider = {
        ...activity("activity_v_fixture"),
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/fixture",
        viatorContentVersion: 1,
      };
      const last = activity("last");
      const days = [generatedDay(1), generatedDay(2)];
      days[0].morning.activityIds = ["unknown", first.id, first.id];
      days[0].afternoon.activityIds = [first.id, provider.id, "unknown"];
      days[0].evening.activityIds = [provider.id, "unknown"];
      days[1].morning.activityIds = [provider.id, last.id, "unknown"];
      days[1].afternoon.activityIds = [last.id, first.id];
      days[1].evening.activityIds = [first.id, last.id];
      respondWith({ days });
      const result = await runAggregatorAgent(
        plan,
        [],
        [first, provider, { ...provider, name: "Duplicate candidate" }, last],
        [],
      );

      expect(scheduledIds(result.days)).toEqual([
        first.id,
        provider.id,
        last.id,
      ]);
      expect(result.days[0].morning.activities[0]).toBe(first);
      expect(result.days[0].afternoon.activities[0]).toBe(provider);
      expect(result.days[1].morning.activities[0]).toBe(last);
      expect(result.days[0].evening.activities).toEqual([]);
      expect(result.days[1].afternoon.activities).toEqual([]);
      expect(result.days[1].evening.activities).toEqual([]);
      expect(result.days[0].title).toBe("AI day 1");
    });

    it("cannot restore an ineligible provider activity through model IDs", async () => {
      vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
      vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "offline-content-review");
      vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_ENABLED", "false");
      vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF", "");
      const allowed = activity("local-walk");
      const blocked = {
        ...activity("activity_v_blocked"),
        name: "PROVIDER_ONLY_TITLE",
        affiliatePartner: "viator",
        viatorContentVersion: 1,
      };
      const day = generatedDay(1);
      day.morning.activityIds = [blocked.id, "unknown", allowed.id];
      day.afternoon.activityIds = [blocked.id];
      respondWith({ days: [day] });
      const result = await runAggregatorAgent(plan, [], [blocked, allowed], []);

      expect(scheduledIds(result.days)).toEqual([allowed.id]);
      expect(result.days[0].morning.activities[0]).toBe(allowed);
      expect(result.days[0].title).toBe("AI day 1");
      expect(result.days[0].estimatedCost).toBeUndefined();
      expect(mocks.generateObject.mock.lastCall?.[0].prompt).not.toContain(
        blocked.name,
      );
    });

    it("chooses one outbound alternative on the first day and rejects later or repeated choices", async () => {
      const alternative = { ...outbound, id: "outbound-2", price: 1000 };
      const days = [
        generatedDay(1),
        generatedDay(2),
        generatedDay(3),
        generatedDay(1),
      ];
      days.forEach((day, index) => {
        day.transportId = index === 1 ? outbound.id : alternative.id;
        day.estimatedCost = 1200;
      });
      respondWith({ days });
      const result = await runAggregatorAgent(
        plan,
        [],
        [],
        [],
        [outbound, alternative],
      );

      expect(result.days.map((day) => day.transport)).toEqual([
        alternative,
        undefined,
        undefined,
        undefined,
      ]);
      expect(result.days[0].transport).toBe(alternative);
      expect(result.days.map((day) => day.estimatedCost)).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
      ]);
      const { prompt, system } = mocks.generateObject.mock.lastCall![0];
      expect(prompt).toContain("outbound alternatives");
      expect(system).toContain("outbound alternatives");
      expect(`${system}\n${prompt}`).not.toMatch(
        /return flight to (?:the )?last day/,
      );
    });

    it.each([undefined, "unknown-offer", outbound.id])(
      "handles one-day transport choice %s without substituting an offer",
      async (transportId) => {
        const day = { ...generatedDay(1), transportId, estimatedCost: 900 };
        respondWith({ days: [day] });
        const result = await runAggregatorAgent(
          {
            ...plan,
            dates: {
              start: plan.dates.start,
              end: plan.dates.start,
              nights: 0,
            },
          },
          [],
          [],
          [],
          [outbound, { ...outbound, id: "outbound-2" }],
        );
        expect(result.days[0].transport).toBe(
          transportId === outbound.id ? outbound : undefined,
        );
        expect(result.days[0].estimatedCost).toBeUndefined();
      },
    );

    it("does not assign an outbound offer to a misdated first day", async () => {
      respondWith({
        days: [
          {
            ...generatedDay(1),
            date: "2026-06-02",
            transportId: outbound.id,
            estimatedCost: 900,
          },
        ],
      });
      const result = await runAggregatorAgent(plan, [], [], [], [outbound]);
      expect(result.days[0].transport).toBeUndefined();
      expect(result.days[0].estimatedCost).toBeUndefined();
    });

    it("consumes activities only in compatible slots without trusting model totals", async () => {
      const night = { ...activity("night", "evening"), price: 50 };
      const morning = activity("morning", "morning");
      const days = [generatedDay(1), generatedDay(2), generatedDay(3)];
      days.forEach((day) => {
        day.estimatedCost = 150;
      });
      days[0].morning.activityIds = [night.id];
      days[0].afternoon.activityIds = [morning.id];
      days[0].evening.activityIds = [night.id];
      days[1].morning.activityIds = [morning.id];
      days[2].evening.activityIds = [night.id, "unknown"];
      respondWith({ days });
      const result = await runAggregatorAgent(plan, [], [night, morning], []);

      expect(result.days[0].morning.activities).toEqual([]);
      expect(result.days[0].afternoon.activities).toEqual([]);
      expect(result.days[0].evening.activities[0]).toBe(night);
      expect(result.days[1].morning.activities[0]).toBe(morning);
      expect(result.days[2].evening.activities).toEqual([]);
      expect(result.days.map((day) => day.estimatedCost)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      const mapped = mapSearchResultsToItinerary(
        {
          searchId: "search-1",
          hotels: [],
          activities: [night, morning],
          dining: [],
          transport: [],
          itinerary: result.days,
        },
        null,
      );
      expect(mapped.days.map((day) => day.totalEstimatedCost)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    });

    it("invalidates the daily estimate for an unresolved requested meal", async () => {
      const day = {
        ...generatedDay(1),
        morning: { activityIds: [], mealId: "unknown-meal" },
        estimatedCost: 45,
      };
      respondWith({ days: [day] });
      const result = await runAggregatorAgent(plan, [], [], []);
      expect(result.days[0].morning.meal).toBeUndefined();
      expect(result.days[0].estimatedCost).toBeUndefined();
    });

    it.each([undefined, -1, Infinity])(
      "does not turn an unavailable daily estimate %s into free zero",
      async (estimatedCost) => {
        respondWith({
          days: [
            { ...generatedDay(1), estimatedCost: estimatedCost as number },
          ],
        });
        const result = await runAggregatorAgent(plan, [], [], []);
        expect(result.days[0].estimatedCost).toBeUndefined();
      },
    );
  },
);

describe("search itinerary fallback", () => {
  it.each([0, 1, 3])(
    "uses only one outbound alternative for a %s-night trip and leaves daily costs unavailable",
    async (nights) => {
      const { days } = await runAggregatorAgent(
        {
          ...plan,
          dates: { ...plan.dates, nights, end: `2026-06-0${nights + 1}` },
        },
        [],
        [],
        [],
        [outbound, { ...outbound, id: "outbound-2" }],
      );
      expect(days[0].transport).toBe(outbound);
      expect(days.slice(1).every((day) => day.transport === undefined)).toBe(
        true,
      );
      expect(days.every((day) => day.estimatedCost === undefined)).toBe(true);
    },
  );
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
