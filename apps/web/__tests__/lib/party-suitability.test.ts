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

import { activityMobilityReviewReason } from "@/lib/search/party-suitability";

it.each([
  "While it has some stairs, the historical significance is immense.",
  "The tour requires steep steps.",
  "The bunker is not wheelchair accessible.",
])(
  "defers an explicit supplied obstacle for stroller access: %s",
  (description) => {
    expect(
      activityMobilityReviewReason(
        { mobilityNeeds: "Stroller access, short walks" },
        description,
      ),
    ).toBe("supplied_access_conflict");
    expect(activityMobilityReviewReason({}, description)).toBeNull();
  },
);
it.each([
  "There are no stairs.",
  "The visit does not require stairs.",
  "It doesn't have stairs.",
  "Optional stairs lead to a rooftop; the main exhibit has a lift.",
  "Access information is not available.",
])(
  "does not turn absent or negated obstacles into conflicts: %s",
  (description) => {
    expect(
      activityMobilityReviewReason(
        { requirements: { accessibility: ["step_free_entrance"] } },
        description,
      ),
    ).toBeNull();
  },
);
it("does not turn a negated free-text need into an access requirement", () => {
  expect(
    activityMobilityReviewReason(
      { mobilityNeeds: "Wheelchair access is not required" },
      "The tour has stairs.",
    ),
  ).toBeNull();
});
