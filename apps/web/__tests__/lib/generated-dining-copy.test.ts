import { expect, it } from "vitest";
import {
  screenGeneratedDiningCopy,
  GENERATED_DINING_REVIEW_NOTE,
} from "@/lib/search/generated-dining-copy";

const candidate = {
  id: "restaurant-1",
  name: "A restaurant",
  description: "A dining room in a converted warehouse.",
  vibeMatch: ["Cultural"],
  cuisineTypes: ["Thai"],
  location: { address: "Original address", lat: 13.7, lng: 100.5 },
  priceLevel: 2,
  mealTypes: ["dinner"],
};

it("removes observed unsupported handling claims while retaining unrelated detail and identity", () => {
  for (const claim of [
    "They are highly experienced in managing international diners with severe allergies.",
    "They work closely with local farmers and can accommodate dietary restrictions with advance notice given their curated set menu approach.",
    "They are transparent about ingredients, which is helpful for managing severe allergies.",
    "The kitchen is celiac-safe.",
    "The team controls cross-contamination.",
  ]) {
    const input = {
      ...candidate,
      description: `${candidate.description} ${claim}`,
    };
    const result = screenGeneratedDiningCopy(input);
    expect(result.description).toBe(
      `${candidate.description} ${GENERATED_DINING_REVIEW_NOTE}`,
    );
    expect(input.description).toContain(claim);
    expect({ ...result, description: input.description }).toEqual(input);
    expect(screenGeneratedDiningCopy(result)).toEqual(result);
  }
});

it("screens generated labels and normalizes typography for detection without renaming venues", () => {
  const result = screenGeneratedDiningCopy({
    ...candidate,
    name: "Gluten Free Kitchen",
    vibeMatch: ["Cultural", "Allergy-friendly", "Coeliac friendly"],
    cuisineTypes: [
      "Thai",
      "Ｇｌｕｔｅｎ-free",
      "nut-free",
      "allerg\u200By safe",
    ],
  });
  expect(result.name).toBe("Gluten Free Kitchen");
  expect(result.vibeMatch).toEqual(["Cultural"]);
  expect(result.cuisineTypes).toEqual(["Thai"]);
  expect(result.description).toContain(GENERATED_DINING_REVIEW_NOTE);
});

it("does not edit ordinary food descriptions or convert ingredient mentions into safety claims", () => {
  const input = {
    ...candidate,
    description:
      "A casual dining room. Peanut sauces and shellfish dishes feature on the menu.",
  };
  expect(screenGeneratedDiningCopy(input)).toEqual(input);
});

it("keeps an explicit generated concern visible instead of replacing it with reassurance", () => {
  for (const description of [
    "Not suitable for people with peanut allergies.",
    "The kitchen cannot accommodate dietary restrictions.",
    "Not safe for nut allergies, but completely safe for shellfish allergies.",
  ]) {
    const result = screenGeneratedDiningCopy({ ...candidate, description });
    expect(result.description).toContain("raised a dietary or allergy concern");
    expect(result.description).toContain("Do not rely on this suggestion");
    expect(result.description).not.toContain("completely safe");
    expect(screenGeneratedDiningCopy(result)).toEqual(result);
  }
});
