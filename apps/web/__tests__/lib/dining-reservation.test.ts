import { beforeEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/sdk", () => ({
  generateObject,
  gateway: (model: string) => ({ model }),
  createGateway: () => (model: string) => ({ model }),
}));
vi.mock("@/lib/affiliates/tripadvisor", () => ({
  isTripAdvisorConfigured: () => false,
  enrichWithTripAdvisor: vi.fn(async (items: unknown) => items),
}));

import { runDiningAgent } from "@/lib/search/agents/dining";

const plan = {
  destination: "Lisbon",
  dates: { start: "2026-12-07", end: "2026-12-09", nights: 2 },
  diningCriteria: {
    cuisineTypes: ["local"],
    priceRange: "moderate",
    dietaryNeeds: [],
    mealPriorities: ["dinner"],
  },
  vibeInterpretation: {
    vibes: ["foodie"],
    searchKeywords: [],
    avoidKeywords: [],
  },
};

describe("dining agent reservation links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drops invented OpenTable links and does not ask the model to invent them", async () => {
    generateObject.mockResolvedValueOnce({
      object: {
        restaurants: [
          {
            name: "Invented Bistro",
            description:
              "A model guess. They are experienced in managing severe allergies.",
            cuisineTypes: ["local", "gluten-free"],
            priceLevel: 2,
            rating: 4.8,
            reviewCount: 90,
            location: { name: "Lisbon", address: "1", lat: 0, lng: 0 },
            images: [],
            reservationUrl: "https://opentable.com/r/invented-bistro",
            affiliatePartner: "opentable",
            mealTypes: ["dinner"],
            vibeScore: 80,
            vibeMatch: ["foodie", "Allergy-safe"],
            dietaryOptions: ["vegan"],
          },
        ],
      },
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const [restaurant] = await runDiningAgent(plan as never, 1);
    expect(restaurant.reservationUrl).toBeUndefined();
    expect(restaurant.affiliatePartner).toBeUndefined();
    expect(restaurant.rating).toBe(0);
    expect(restaurant.description).not.toContain("experienced in managing");
    expect(restaurant.description).toContain(
      "allergy handling has not been verified",
    );
    expect(restaurant.cuisineTypes).toEqual(["local"]);
    expect(restaurant.vibeMatch).toEqual(["foodie"]);
    expect(restaurant.dietaryOptions).toEqual([]);
    const prompt = String(generateObject.mock.calls[0][0].system);
    expect(prompt).not.toContain("https://opentable.com/r/");
    expect(prompt).toContain("Do not invent reservation URLs");
    expect(prompt).not.toContain("realistic-sounding names");
    expect(prompt).toContain("Never invent a name");
    expect(prompt).toContain("Leave dietaryOptions empty");
    expect(info.mock.calls.map((call) => String(call[0])).join("\n")).toContain(
      "planning.step.reservation_url_omitted",
    );
    expect(info.mock.calls.map((call) => String(call[0])).join("\n")).toContain(
      '"event":"planning.step.generated_dining_copy_reviewed","step":"dining","candidates":1',
    );
    info.mockRestore();
  });

  it("logs an empty fallback when dining generation fails", async () => {
    generateObject.mockRejectedValueOnce(new Error("gateway down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(runDiningAgent(plan as never, 1)).resolves.toEqual([]);
    expect(warn.mock.calls.map((call) => String(call[0])).join("\n")).toContain(
      '"event":"planning.step.fallback"',
    );
    expect(warn.mock.calls.map((call) => String(call[0])).join("\n")).toContain(
      '"step":"dining"',
    );
    warn.mockRestore();
    error.mockRestore();
  });
});
