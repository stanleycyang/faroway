import { describe, expect, it } from "vitest";
import type { ActivityResult, SearchPlan, SuggestedDay } from "@faroway/types";
import {
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

  it("reads the allergen out of a free-form requirement", () => {
    expect(hazardTokens(plan)).toContain("peanut");
    expect(hazardTokens(plan)).not.toContain("severe");
  });

  it("does not treat a foreign-currency amount as dollars", () => {
    expect(scheduledStopPrice({ price: 5000, currency: "JPY" })).toBe(0);
    expect(scheduledStopPrice({ price: 40, currency: "USD" })).toBe(40);
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
});
