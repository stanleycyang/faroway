import { expect, it } from "vitest";
import {
  accessRequested,
  corroborateAccessClaim,
  corroborateDiningClaim,
  stepFreeRequested,
} from "@/lib/search/requirement-corroboration";
import { activityMobilityReviewReason } from "@/lib/search/party-suitability";
import type { ActivityResult, DiningResult } from "@/lib/search/types";

const meal = {
  id: "lunch",
  name: "Market lunch",
  description: "The kitchen is vegan, vegetarian, halal and kosher.",
  cuisineTypes: ["vegan"],
  dietaryOptions: [],
  mealTypes: ["lunch"],
  location: { name: "Market lunch", address: "recorded", lat: 0, lng: 0 },
} as unknown as DiningResult;

it("removes vegan, vegetarian, halal and kosher claims when no dietary badge is set", () => {
  const reviewed = corroborateDiningClaim(meal);
  expect(reviewed.stripped).toBe(true);
  expect(reviewed.meal.description).not.toMatch(
    /vegan|vegetarian|halal|kosher/i,
  );
  expect(reviewed.meal.cuisineTypes).toEqual([]);
  expect(reviewed.meal.description).toContain("has not been verified");
});

it("removes an access promise from the title travelers actually see", () => {
  const activity = {
    id: "garden",
    name: "Wheelchair Accessible Garden",
    description: "A recorded garden.",
    vibeMatch: [],
  } as unknown as ActivityResult;
  const reviewed = corroborateAccessClaim(activity, true);
  expect(reviewed.stripped).toBe(true);
  expect(reviewed.activity.name).toBe("Garden");
  expect(reviewed.activity.name).not.toMatch(/wheelchair/i);
  expect(reviewed.activity.description).toContain("has not been verified");
});

it("strips unverified top-9 FDA allergen claims in dining descriptions", () => {
  const allergenMeal = {
    ...meal,
    name: "Sesame-Free Bistro",
    description:
      "Seasonal kitchen. All dishes are egg-free, soy-free, fish-free, wheat-free, lactose-free, and peanut-safe.",
    cuisineTypes: ["local", "soy-free"],
  } as unknown as DiningResult;
  const reviewed = corroborateDiningClaim(allergenMeal);
  expect(reviewed.stripped).toBe(true);
  expect(reviewed.meal.name).toBe("Bistro");
  expect(reviewed.meal.cuisineTypes).toEqual(["local"]);
  expect(reviewed.meal.description).not.toMatch(
    /egg-free|soy-free|fish-free|wheat-free|lactose-free|peanut-safe/i,
  );
  expect(reviewed.meal.description).toContain("has not been verified");
});

it("detects mobility needs in requirements.mobilityNotes and mid-sentence phrasing while honoring negations", () => {
  expect(
    accessRequested({
      mobilityNeeds: "I use a wheelchair for museum days",
    }),
  ).toBe(true);
  expect(
    stepFreeRequested({
      requirements: {
        allergies: [],
        dietaryPreferences: [],
        accessibility: [],
        mobilityNotes: "Traveling with a stroller and need step-free entrances",
      },
    }),
  ).toBe(true);
  expect(
    stepFreeRequested({
      mobilityNeeds: "Wheelchair access not required",
    }),
  ).toBe(false);
  expect(
    activityMobilityReviewReason(
      {
        requirements: {
          accessibility: [],
          mobilityNotes: "Parent uses a wheelchair",
        },
      },
      "The gallery has steep stairs to the upper floor.",
      "Historic Tower",
    ),
  ).toBe("supplied_access_conflict");
});
