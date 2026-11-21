import { describe, expect, it } from "vitest";
import {
  readDayTiming,
  type ActivityResult,
  type SearchPlan,
  type SuggestedDay,
} from "@faroway/types";
import {
  affiliateLinkOk,
  calendarDates,
  enforceReleaseItinerary,
  hazardTokens,
  scheduledStopPrice,
  tripActivityBudget,
} from "@/lib/search/release-itinerary";

const plan: SearchPlan = {
  destination: "Tokyo",
  country: "Japan",
  searchPriorities: ["activities"],
  dates: { start: "2026-06-01", end: "2026-06-01", nights: 0 },
  requirements: {
    allergies: ["severe peanut allergy"],
    dietaryPreferences: [],
    accessibility: [],
    mobilityNotes: "",
  },
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
    interests: ["ridge"],
  },
  diningCriteria: {
    cuisineTypes: [],
    dietaryNeeds: [],
    priceRange: "moderate",
    mealPriorities: [],
  },
};

function activity(
  id: string,
  overrides: Partial<ActivityResult> = {},
): ActivityResult {
  return {
    id,
    name: id,
    description:
      "A staffed walk through the central neighborhood, with time to look at the streets.",
    category: "sightseeing",
    duration: 60,
    price: 20,
    currency: "USD",
    rating: 4,
    reviewCount: 10,
    location: { name: "Tokyo", address: "City center", lat: 35.6, lng: 139.7 },
    images: [],
    bestTimeOfDay: "afternoon",
    vibeScore: 80,
    vibeMatch: ["culture"],
    bookingRequired: false,
    ...overrides,
  };
}

function day(title: string): SuggestedDay {
  return {
    dayNumber: 1,
    date: "2026-06-01",
    title,
    summary: "A walk through the center.",
    morning: { activities: [] },
    afternoon: { activities: [activity("walk")] },
    evening: { activities: [] },
    tips: ["This visit is allergy-safe for you."],
  };
}

describe("release itinerary", () => {
  it("keeps every date of a trip longer than three weeks", () => {
    expect(calendarDates("2026-01-01", "2026-01-30")).toHaveLength(30);
    expect(tripActivityBudget("moderate", "2026-01-01", "2026-01-30")).toBe(
      undefined,
    );
    expect(tripActivityBudget("moderate", "2026-06-01", "2026-06-02")).toBe(
      400,
    );
  });

  it("reads allergens out of free-form requirements without treating positive diet styles as hazards", () => {
    expect(hazardTokens(plan)).toContain("peanut");
    expect(hazardTokens(plan)).not.toContain("severe");
    const veganHalalPlan: SearchPlan = {
      ...plan,
      dietaryRestrictions: ["vegan", "halal", "vegetarian"],
      requirements: {
        allergies: ["shellfish allergy"],
        dietaryPreferences: ["vegan", "halal"],
        accessibility: [],
        mobilityNotes: "",
      },
      diningCriteria: {
        ...plan.diningCriteria,
        dietaryNeeds: ["vegan", "kosher", "pescatarian"],
      },
    };
    const tokens = hazardTokens(veganHalalPlan);
    expect(tokens).toContain("shellfish");
    expect(tokens).not.toContain("vegan");
    expect(tokens).not.toContain("halal");
    expect(tokens).not.toContain("vegetarian");
    expect(tokens).not.toContain("kosher");
    expect(tokens).not.toContain("pescatarian");
  });

  it("converts major foreign currencies to USD instead of treating them as raw dollars or free", () => {
    const jpyUsd = scheduledStopPrice({ price: 5000, currency: "JPY" });
    expect(jpyUsd).toBeGreaterThan(20);
    expect(jpyUsd).toBeLessThan(60);
    expect(scheduledStopPrice({ price: 40, currency: "USD" })).toBe(40);
    expect(scheduledStopPrice({ price: 5000, currency: "XYZ" })).toBe(0);
  });

  it("preserves a 5-hour morning excursion when the afternoon has no conflicting activities", () => {
    const longTour = activity("fuji-tour", {
      name: "Mount Fuji Half-Day Scenic Excursion",
      duration: 300,
      bestTimeOfDay: "morning",
    });
    const result = enforceReleaseItinerary(
      { ...plan, requirements: undefined },
      [
        {
          ...day("Mount Fuji"),
          morning: { activities: [longTour] },
          afternoon: { activities: [] },
          evening: { activities: [] },
        },
      ],
      [longTour],
      [],
    );
    expect(result.days[0].morning.activities.map((a) => a.id)).toEqual([
      "fuji-tour",
    ]);
    expect(result.days[0].timingProposal?.fitsPolicy).toBe(true);
    // Persistence & display boundary (readDayTiming) must accept the multi-slot timing proposal
    expect(readDayTiming(result.days[0])?.fitsPolicy).toBe(true);
  });

  it("removes unsourced claims from the day title and tips", () => {
    const result = enforceReleaseItinerary(
      plan,
      [day("This museum visit is allergy-safe.")],
      [activity("walk")],
      [],
    );
    expect(result.days[0].title).toBe("Day 1");
    expect(result.days[0].tips).toEqual([]);
    expect(result.days[0].summary).toBe("A walk through the center.");
  });

  it("does not add a far preference stop onto a day that already has a local visit", () => {
    const local = activity("walk");
    const far = activity("ridge-view", {
      name: "Tokyo ridge visit",
      category: "ridge",
      vibeMatch: ["ridge"],
      location: {
        name: "Ridge",
        address: "Far ridge",
        lat: 36.6,
        lng: 139.7,
      },
    });
    const result = enforceReleaseItinerary(
      { ...plan, requirements: undefined },
      [
        {
          ...day("Center"),
          afternoon: { activities: [local] },
        },
      ],
      [local, far],
      [],
    );
    const ids = result.days.flatMap((item) =>
      [item.morning, item.afternoon, item.evening].flatMap((slot) =>
        slot.activities.map((stop) => stop.id),
      ),
    );
    expect(ids).toEqual(["walk"]);
  });

  it("blocks allergen-conflicting cuisineTypes and allergen-specialty descriptions", () => {
    const shellfishPlan: SearchPlan = {
      ...plan,
      requirements: {
        allergies: ["shellfish", "peanut"],
        dietaryPreferences: [],
        accessibility: [],
        mobilityNotes: "",
      },
    };
    const riskyCuisine = {
      id: "shack-1",
      name: "Harbor Kitchen",
      description: "Waterfront spot with casual seating.",
      cuisineTypes: ["Seafood", "Shellfish"],
      priceLevel: 2 as const,
      dietaryOptions: [],
      mealTypes: ["dinner" as const],
      location: { name: "Tokyo", address: "Port", lat: 35.6, lng: 139.7 },
      images: [],
      vibeScore: 80,
      vibeMatch: [],
      rating: 0,
      reviewCount: 0,
    };
    const riskyDesc = {
      ...riskyCuisine,
      id: "satay-1",
      name: "Garden Spot",
      cuisineTypes: ["Asian"],
      description: "Famous for spicy peanut-crusted skewers and noodle bowls.",
    };
    const result = enforceReleaseItinerary(
      shellfishPlan,
      [
        {
          ...day("Dinner"),
          afternoon: { activities: [activity("walk")], meal: riskyDesc },
          evening: { activities: [], meal: riskyCuisine },
        },
      ],
      [activity("walk")],
      [riskyCuisine, riskyDesc],
    );
    expect(result.days[0].afternoon.meal).toBeUndefined();
    expect(result.days[0].evening.meal).toBeUndefined();
    expect(result.repairs).toContain("drop:hazard_cuisine:shack-1");
    expect(result.repairs).toContain("drop:hazard_description:satay-1");
  });

  it("rejects lookalike Duffel hostnames in affiliateLinkOk", () => {
    expect(
      affiliateLinkOk(
        "duffel",
        "https://evilduffel.com/links/off_123",
        "off_123",
      ),
    ).toBe(false);
    expect(
      affiliateLinkOk(
        "duffel",
        "https://links.duffel.com/links/off_123",
        "off_123",
      ),
    ).toBe(true);
    expect(
      affiliateLinkOk("duffel", "https://duffel.com/links/off_123", "off_123"),
    ).toBe(true);
  });
});
