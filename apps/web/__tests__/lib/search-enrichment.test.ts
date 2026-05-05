import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  enrichNonAffiliateCandidates,
  runSearchEnrichment,
} from "@/lib/search/enrichment";
import type { SearchPlan } from "@faroway/types";

const basePlan: SearchPlan = {
  destination: "Tokyo",
  country: "Japan",
  dates: { start: "2026-05-10", end: "2026-05-14", nights: 4 },
  searchPriorities: ["hotels", "activities", "dining"],
  hotelCriteria: {
    priceRange: { min: 120, max: 300 },
    starRating: [3, 4, 5],
    amenities: ["wifi"],
    neighborhoods: ["Shibuya"],
  },
  activityCriteria: {
    categories: ["culture", "food"],
    interests: ["culture"],
    pacePreference: "moderate",
    mustSee: ["Senso-ji"],
  },
  diningCriteria: {
    cuisineTypes: ["ramen", "izakaya"],
    dietaryNeeds: [],
    priceRange: "moderate",
    mealPriorities: ["dinner"],
  },
  transportCriteria: undefined,
  vibeInterpretation: {
    vibes: ["foodie", "cultural"],
    searchKeywords: ["local", "hidden gem"],
    avoidKeywords: [],
  },
};

describe("enrichNonAffiliateCandidates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.TAVILY_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  it("returns non-affiliate fallback suggestions when tavily is absent", async () => {
    const result = await enrichNonAffiliateCandidates(basePlan);
    expect(result.activities.length).toBeGreaterThan(0);
    expect(result.dining.length).toBeGreaterThan(0);
    expect(result.activities.every((a) => !a.affiliatePartner)).toBe(true);
    expect(result.dining.every((d) => !d.affiliatePartner)).toBe(true);
    expect(result.notes[0]).toContain("not configured");
  });

  it("adds tavily-backed activities when configured", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Yanaka neighborhood walk",
              content: "Historic district with local cafes and artisan shops.",
              score: 0.92,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await enrichNonAffiliateCandidates(basePlan);
    expect(result.activities.some((a) => a.name.includes("Yanaka"))).toBe(true);
    expect(result.activities.every((a) => !a.affiliateUrl)).toBe(true);
    expect(result.notes.join(" ")).toContain("Tavily");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(
      JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)),
    ).not.toHaveProperty("api_key");
  });

  it("merges Google Places activity and dining candidates", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "places-key";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        const isDining = url.includes("restaurant");
        return new Response(
          JSON.stringify({
            results: [
              {
                name: isDining ? "Places dining" : "Places activity",
                formatted_address: isDining ? "2 Chome" : "1 Chome",
                rating: isDining ? 4.5 : 4.7,
                user_ratings_total: isDining ? 42 : 99,
                geometry: {
                  location: isDining
                    ? { lat: 35.7, lng: 139.8 }
                    : { lat: 35.6, lng: 139.7 },
                },
              },
            ],
          }),
          { status: 200 },
        );
      });

    const result = await runSearchEnrichment(basePlan, "search-1");

    expect(result.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "places_activity_search-1_0",
          name: "Places activity",
          location: expect.objectContaining({ lat: 35.6, lng: 139.7 }),
        }),
      ]),
    );
    expect(result.dining).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "places_dining_search-1_0",
          name: "Places dining",
          location: expect.objectContaining({ lat: 35.7, lng: 139.8 }),
        }),
      ]),
    );
    expect(result.notes.join(" ")).toContain("Google Places");
    expect(fetchSpy).toHaveBeenCalled();
  });
});
