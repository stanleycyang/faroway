import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  searchViatorProducts: vi.fn(),
  searchGYGActivities: vi.fn(),
  searchBookingHotels: vi.fn(),
  searchAmadeusHotels: vi.fn(),
  isAmadeusConfigured: vi.fn(),
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

vi.mock("@/lib/affiliates/booking", () => ({
  isBookingConfigured: () => true,
  searchBookingHotels: mocks.searchBookingHotels,
  generateBookingAffiliateUrl: (hotelId: string) =>
    `https://booking.test/${hotelId}`,
}));

vi.mock("@/lib/affiliates/amadeus", () => ({
  isAmadeusConfigured: mocks.isAmadeusConfigured,
  searchAmadeusHotels: mocks.searchAmadeusHotels,
  generateAmadeusAffiliateUrl: () => "https://amadeus.test/hotel",
  resolveAmadeusCityCode: (destination: string) =>
    destination.toLowerCase().startsWith("tokyo")
      ? "TYO"
      : destination.slice(0, 3).toUpperCase(),
}));

vi.mock("@/lib/affiliates/tripadvisor", () => ({
  isTripAdvisorConfigured: () => false,
  enrichWithTripAdvisor: vi.fn(async (items) => items),
}));

import { runActivitiesAgent } from "@/lib/search/agents/activities";
import { runHotelsAgent } from "@/lib/search/agents/hotels";

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
    mocks.searchViatorProducts.mockResolvedValue([]);
    mocks.searchGYGActivities.mockResolvedValue([]);
    mocks.isAmadeusConfigured.mockReturnValue(false);
    mocks.searchAmadeusHotels.mockResolvedValue([]);
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

  it("starts Booking.com and AI hotel fallback before awaiting either result", async () => {
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    mocks.searchBookingHotels.mockImplementation(async () => {
      started.push("booking");
      await gate;
      return [];
    });
    mocks.generateObject.mockImplementation(async () => {
      started.push("ai");
      await gate;
      return { object: { hotels: [aiHotel] } };
    });

    const search = runHotelsAgent(plan as never, 1);

    await waitFor(() => started.length === 2);
    expect(started.sort()).toEqual(["ai", "booking"]);

    release();
    const results = await search;

    expect(results[0].name).toBe("AI Hotel");
  });

  it("passes resolved Amadeus city codes into hotel search", async () => {
    mocks.isAmadeusConfigured.mockReturnValue(true);
    mocks.searchBookingHotels.mockResolvedValue([]);
    mocks.searchAmadeusHotels.mockResolvedValue([]);
    mocks.generateObject.mockResolvedValue({ object: { hotels: [aiHotel] } });

    await runHotelsAgent(plan as never, 1);

    expect(mocks.searchAmadeusHotels).toHaveBeenCalledWith(
      expect.objectContaining({ cityCode: "TYO" }),
    );
  });
});
