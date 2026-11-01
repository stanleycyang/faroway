import { expect, it } from "vitest";
import facts from "../../../../scripts/fixtures/reviewed-dining-addresses.json";
import {
  appendReviewedAddressNotes,
  reconcileGeneratedDiningAddresses,
} from "@/lib/search/reviewed-dining-addresses";
import type { DiningResult, SuggestedDay } from "@/lib/search/types";
const plan = { destination: "Cambridge, Massachusetts, USA" };
const meal: DiningResult = {
  id: "row34",
  name: "Row 34",
  description: "Seafood dining.",
  cuisineTypes: ["Seafood"],
  priceLevel: 3,
  location: {
    name: "Kendall Square",
    address: "383 Binney St, Cambridge, MA 02139",
    lat: 42.36,
    lng: -71.09,
    neighborhood: "Generated area",
  },
  images: [],
  mealTypes: ["dinner"],
  vibeScore: 90,
  vibeMatch: ["Foodie"],
  dietaryOptions: [],
};
it("repairs the reviewed branch without preserving the wrong location's coordinates", () => {
  const original = structuredClone(meal);
  const review = reconcileGeneratedDiningAddresses(
    plan,
    [meal],
    facts,
    "2026-11-01",
  );
  expect(review.applied).toHaveLength(1);
  expect(review.withheld).toHaveLength(0);
  const fixed = review.candidates[0];
  expect(fixed.location).toEqual({
    name: "Row 34",
    address: "314 Main Street, Cambridge, MA 02142",
  });
  expect(fixed.description).toContain(facts[0].sourceUrl);
  expect(fixed.id).toBe(meal.id);
  expect(fixed.priceLevel).toBe(meal.priceLevel);
  expect(fixed.mealTypes).toEqual(meal.mealTypes);
  expect(meal).toEqual(original);
  expect(
    reconcileGeneratedDiningAddresses(plan, [fixed], facts, "2026-11-01")
      .candidates,
  ).toEqual([fixed]);
});
it("does not transfer a source to another city, branch, or unreviewed address spelling", () => {
  for (const [request, candidate] of [
    [{ destination: "Cambridge, England, UK" }, meal],
    [plan, { ...meal, name: "Row 34 Boston" }],
    [
      plan,
      { ...meal, location: { ...meal.location, address: "383 Binney Street" } },
    ],
  ] as const) {
    const result = reconcileGeneratedDiningAddresses(
      request,
      [candidate],
      facts,
      "2026-11-01",
    );
    expect(result.applied).toEqual([]);
    expect(result.candidates).toEqual([candidate]);
  }
});
it("withholds a known conflicted address when its binding is stale, malformed or ambiguous", () => {
  for (const [evidence, date] of [
    [facts, "2026-12-02"],
    [facts, "2026-10-31"],
    [[facts[0], facts[0]], "2026-11-01"],
    [[{ ...facts[0], sourceSha256: "not-a-hash" }], "2026-11-01"],
    [[{ ...facts[0], branchReview: "" }], "2026-11-01"],
    [
      [{ ...facts[0], sourceUrl: "https://user:pass@example.com" }],
      "2026-11-01",
    ],
  ] as const) {
    const result = reconcileGeneratedDiningAddresses(
      plan,
      [meal],
      evidence,
      date,
    );
    expect(result.candidates).toEqual([]);
    expect(result.withheld).toHaveLength(1);
    expect(result.applied).toEqual([]);
  }
  expect(() =>
    reconcileGeneratedDiningAddresses(plan, [meal], facts, "2026-02-30"),
  ).toThrow();
});
it("preserves a source note only for a matching selected address without claiming routes", () => {
  const fixed = reconcileGeneratedDiningAddresses(
    plan,
    [meal],
    facts,
    "2026-11-01",
  ).candidates[0];
  const days = [
    {
      date: "2027-01-11",
      dayNumber: 1,
      title: "Day",
      summary: "Draft",
      tips: [],
      morning: { activities: [] },
      afternoon: { activities: [] },
      evening: { activities: [], meal: fixed },
    },
  ] as SuggestedDay[];
  const result = appendReviewedAddressNotes(plan, days, facts, "2026-11-01");
  expect(result[0].tips).toHaveLength(1);
  expect(result[0].tips[0]).toContain("Confirm the location and route");
  expect(result[0].evening).toEqual(days[0].evening);
  expect(days[0].tips).toEqual([]);
  expect(appendReviewedAddressNotes(plan, result, facts, "2026-11-01")).toEqual(
    result,
  );
  expect(
    appendReviewedAddressNotes(plan, days, facts, "2026-12-02")[0].tips,
  ).toEqual([]);
});
