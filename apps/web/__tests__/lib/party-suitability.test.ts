import { describe, expect, it } from "vitest";
import { familyActivityReviewReason } from "@/lib/search/party-suitability";

describe("family activity review screen", () => {
  it.each([
    "Hviids Vinstue Mulled Wine Experience",
    "Old Town Pub Crawl",
    "Guided Beer Tasting",
    "Cocktail Masterclass and Whisky Tasting",
    "Local Distillery Tour",
    "Mixology Workshop",
  ])("defers an explicitly alcohol-focused title: %s", (title) => {
    expect(familyActivityReviewReason(title)).toBe("alcohol_focused_title");
  });
  it.each([
    "Adults-only sunset cruise",
    "Evening show (18+)",
    "21+ Comedy Night",
  ])("flags an adult-only label: %s", (title) => {
    expect(familyActivityReviewReason(title)).toBe("adult_only_label");
  });
  it.each([
    "Wine History Museum",
    "Baroque Architecture Walk",
    "Family Cooking Workshop",
    "Non-alcoholic Cocktail Class",
    "Mocktail Workshop",
    "Traditional Market Walk",
  ])(
    "does not infer an alcohol-focused activity from unrelated wording: %s",
    (title) => {
      expect(familyActivityReviewReason(title)).toBeNull();
    },
  );
});
