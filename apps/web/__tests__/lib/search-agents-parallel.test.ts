import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  searchViatorProducts: vi.fn(),
  searchGYGActivities: vi.fn(),
}));

vi.mock("@/lib/ai/sdk", () => ({
  generateObject: mocks.generateObject,
  gateway: (model: string) => ({ model }),
  createGateway: () => (model: string) => ({ model }),
}));

vi.mock("@/lib/affiliates/viator", () => ({
  isViatorConfigured: () => true,
  searchViatorProducts: mocks.searchViatorProducts,
  generateViatorAffiliateUrl: (productCode: string) =>
    `https://viator.test/${productCode}`,
  mapViatorCategoryToVibe: () => ["foodie"],
}));

vi.mock("@/lib/affiliates/getyourguide", () => ({
  isGYGConfigured: () => true,
  searchGYGActivities: mocks.searchGYGActivities,
  generateGYGAffiliateUrl: (activityId: string) =>
    `https://getyourguide.test/${activityId}`,
  mapGYGCategoryToVibe: () => ["foodie"],
}));

vi.mock("@/lib/affiliates/tripadvisor", () => ({
  isTripAdvisorConfigured: () => false,
  enrichWithTripAdvisor: vi.fn(async (items) => items),
}));

import { runActivitiesAgent } from "@/lib/search/agents/activities";
import { runHotelsAgent } from "@/lib/search/agents/hotels";
import { runTransportAgent } from "@/lib/search/agents/transport";

const plan = {
  destination: "Tokyo",
  dates: {
    start: "2026-06-01",
    end: "2026-06-05",
    nights: 4,
  },
  vibeInterpretation: {
    vibes: ["foodie"],
    searchKeywords: ["food", "markets"],
    avoidKeywords: [],
  },
  activityCriteria: {
    pacePreference: "balanced",
    mustSee: ["markets"],
    interests: ["food"],
  },
  hotelCriteria: {
    priceRange: { min: 100, max: 300 },
    starRating: [3, 4],
    amenities: ["wifi"],
    neighborhoods: ["Shibuya"],
  },
};

const aiActivity = {
  name: "AI Food Walk",
  description: "A fast local food walk",
  category: "food",
  duration: 120,
  price: 80,
  currency: "USD",
  rating: 4.6,
  reviewCount: 90,
  location: { name: "Tokyo", address: "", lat: 35.6, lng: 139.7 },
  images: [],
  bestTimeOfDay: "morning",
  vibeScore: 80,
  vibeMatch: ["foodie"],
  bookingRequired: false,
};

const aiHotel = {
  name: "AI Hotel",
  description: "Central stay",
  starRating: 4,
  userRating: 8.8,
  reviewCount: 120,
  pricePerNight: 180,
  totalPrice: 720,
  currency: "USD",
  amenities: ["wifi"],
  location: { name: "Tokyo", address: "", lat: 35.6, lng: 139.7 },
  images: [],
  affiliateUrl: "https://example.com/hotel",
  affiliatePartner: "ai",
  vibeScore: 75,
  vibeMatch: ["foodie"],
};

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 100,
): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

describe("search agents internal parallelism", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "test-approval");
    mocks.searchViatorProducts.mockResolvedValue([]);
    mocks.searchGYGActivities.mockResolvedValue([]);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("does not present an AI-generated activity price as a supplier estimate", async () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    mocks.searchGYGActivities.mockResolvedValue([]);
    mocks.generateObject.mockResolvedValue({
      object: { activities: [aiActivity] },
    });
    const results = await runActivitiesAgent(plan as never);
    expect(results[0]).toMatchObject({
      priceStatus: "unknown",
      price: 0,
      currency: "",
    });
  });

  it("starts Viator, GetYourGuide, and AI activity generation before awaiting any result", async () => {
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    mocks.searchViatorProducts.mockImplementation(async () => {
      started.push("viator");
      await gate;
      return [];
    });
    mocks.searchGYGActivities.mockImplementation(async () => {
      started.push("getyourguide");
      await gate;
      return [];
    });
    mocks.generateObject.mockImplementation(async () => {
      started.push("ai");
      await gate;
      return { object: { activities: [aiActivity] } };
    });

    const search = runActivitiesAgent(plan as never, 1);

    await waitFor(() => started.length === 3);
    expect(started.sort()).toEqual(["ai", "getyourguide", "viator"]);

    release();
    const results = await search;

    expect(results[0].name).toBe("AI Food Walk");
  });

  it("keeps independent AI planning when Viator content is disabled", async () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    mocks.generateObject.mockResolvedValue({
      object: { activities: [aiActivity] },
    });
    const results = await runActivitiesAgent(plan as never, 1);
    expect(mocks.searchViatorProducts).not.toHaveBeenCalled();
    expect(results[0].name).toBe("AI Food Walk");
  });

  it("keeps the complete provider description without rewriting it", async () => {
    const description = "Provider-owned wording. ".repeat(30);
    mocks.searchViatorProducts.mockResolvedValue([
      {
        productCode: "123P1",
        title: "Provider food tour",
        description,
        shortDescription: "Short provider excerpt",
        duration: { fixedDurationInMinutes: 90 },
        categories: ["food"],
        price: { amount: 30, currencyCode: "USD" },
        rating: 4,
        reviewCount: 10,
        location: { city: "Tokyo" },
        images: [],
      },
    ]);
    mocks.generateObject.mockResolvedValue({ object: { activities: [] } });
    const results = await runActivitiesAgent(plan as never);
    expect(results[0].description).toBe(description);
    expect(results[0]).toHaveProperty("viatorContentVersion", 1);
  });

  it("does not return adult-only flight quotes for a party with children", async () => {
    const result = await runTransportAgent(
      {
        ...plan,
        children: 1,
        transportCriteria: { originAirport: "SFO", destinationAirport: "TYO" },
      } as never,
      3,
    );
    expect(result).toEqual([]);
  });

  it.each([0, 1])(
    "keeps hotel suggestions unpriced for parties with %s children",
    async (children) => {
      mocks.generateObject.mockResolvedValue({ object: { hotels: [aiHotel] } });
      const results = await runHotelsAgent(
        { ...plan, adults: 2, children, travelers: 2 + children } as never,
        1,
      );
      expect(results).toHaveLength(1);
      expect(results[0].pricePerNight).toBeUndefined();
      expect(results[0].affiliateUrl).toBeUndefined();
    },
  );

  it("passes the saved hotel party and access needs even when inferred amenities omit them", async () => {
    mocks.generateObject.mockResolvedValue({ object: { hotels: [aiHotel] } });
    await runHotelsAgent(
      {
        ...plan,
        travelers: 4,
        adults: 2,
        children: 2,
        childAges: [0, 7],
        roomCount: 2,
        mobilityNeeds: "Short walks and daily midday rest",
        requirements: {
          allergies: ["peanuts"],
          dietaryPreferences: ["vegetarian"],
          accessibility: ["step_free_entrance"],
          mobilityNotes: "Lift access to the room",
        },
      } as unknown as SearchPlan,
      1,
    );
    const { prompt, system } = mocks.generateObject.mock.calls[0][0];
    for (const detail of [
      "Travelers: 4",
      "Adults: 2",
      "Children: 2",
      "Child ages: 0, 7",
      "Requested rooms: 2",
      "Short walks and daily midday rest",
      "peanuts",
      "vegetarian",
      "step_free_entrance",
      "Lift access to the room",
    ])
      expect(prompt).toContain(detail);
    expect(system).toContain(
      "Room capacity, accessibility and dietary suitability are unverified",
    );
  });

  it("does not invent hotel occupancy or child ages when they are unspecified", async () => {
    mocks.generateObject.mockResolvedValue({ object: { hotels: [aiHotel] } });
    await runHotelsAgent(plan as never, 1);
    const { prompt } = mocks.generateObject.mock.calls[0][0];
    for (const field of [
      "Travelers",
      "Adults",
      "Children",
      "Child ages",
      "Requested rooms",
    ])
      expect(prompt).toContain(`${field}: Not specified`);
  });

  it("strips model-generated booking links and ratings even when the model ignores instructions", async () => {
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        hotels: [
          {
            ...aiHotel,
            affiliateUrl: "https://retired-supplier.example/invented",
            affiliatePartner: "retired-provider",
          },
        ],
      },
    });
    const hotels = await runHotelsAgent(plan as never, 1);
    expect(hotels[0]).toMatchObject({ dataSource: "ai" });
    for (const key of [
      "affiliateUrl",
      "affiliatePartner",
      "userRating",
      "reviewCount",
      "pricePerNight",
      "totalPrice",
      "currency",
      "starRating",
    ]) {
      expect(hotels[0][key as keyof (typeof hotels)[0]]).toBeUndefined();
    }
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        activities: [
          {
            ...aiActivity,
            affiliateUrl: "https://www.viator.com/invented",
            affiliatePartner: "viator",
          },
        ],
      },
    });
    const activities = await runActivitiesAgent(plan as never, 1);
    expect(activities[0].affiliateUrl).toBeUndefined();
    expect(activities[0].rating).toBe(0);
    expect(activities[0].reviewCount).toBe(0);
  });
  it("asks for whole minutes and rejects the observed hours-as-minutes response", async () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    mocks.generateObject.mockResolvedValueOnce({
      object: { activities: [{ ...aiActivity, duration: 150 }] },
    });
    const result = await runActivitiesAgent(plan as never, 1);
    const args = mocks.generateObject.mock.calls[0][0];
    expect(args.system).toContain("whole MINUTES, never hours");
    expect(
      args.schema.safeParse({ activities: [{ ...aiActivity, duration: 2.5 }] })
        .success,
    ).toBe(false);
    expect(
      args.schema.safeParse({ activities: [{ ...aiActivity, duration: 150 }] })
        .success,
    ).toBe(true);
    expect(result[0].duration).toBe(150);
  });
});
