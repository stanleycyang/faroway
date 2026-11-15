import { expect, it } from "vitest";
import {
  corroborateAccessClaim,
  corroborateDiningClaim,
} from "@/lib/search/requirement-corroboration";
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
