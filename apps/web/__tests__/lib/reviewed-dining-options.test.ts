import { expect, it } from "vitest";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import reviewed from "../../../../scripts/fixtures/reviewed-dining-options.json";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import { appendReviewedDiningOptions } from "@/lib/search/reviewed-dining-options";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";
import type { ActivityResult, SearchPlan } from "@/lib/search/types";
const plan = {
  ...(rome.trace.steps[0].output as unknown as SearchPlan),
  destination: "Singapore",
};
function fixture() {
  const activity = {
    ...(rome.trace.steps[2].output as unknown as ActivityResult[])[0],
    name: reviewed[0].anchorNames[0],
    duration: 60,
    bestTimeOfDay: "morning" as const,
  };
  return compileSchedule(plan, [activity], []).days;
}
const apply = (days = fixture(), options = reviewed, asOf = "2026-11-01") =>
  appendReviewedDiningOptions(plan, days, [], options, asOf);
it("adds a dated, sourced review option without changing visits, meals or input", () => {
  const days = fixture(),
    original = structuredClone(days),
    result = apply(days);
  expect(days).toEqual(original);
  expect(result[0].morning).toEqual(original[0].morning);
  expect(result[0].tips.at(-1)).toContain(reviewed[0].name);
  expect(result[0].tips.at(-1)).toContain("not a scheduled meal");
  expect(result[0].tips.at(-1)).toContain("stroller access");
  expect(result[0].tips.at(-1)).toContain(reviewed[0].sources[0]);
  expect(apply(result)[0].tips).toEqual(result[0].tips);
  const mapped = mapSearchResultsToItinerary(
    {
      searchId: "fixture",
      hotels: [],
      activities: [],
      dining: [],
      transport: [],
      itinerary: result,
    },
    null,
  );
  expect(mapped.days[0].tips).toEqual(result[0].tips);
});
it.each(["2026-10-30", "2026-12-01"])(
  "omits unreviewed or expired leads as of %s",
  (asOf) => {
    const days = fixture();
    expect(apply(days, reviewed, asOf)).toEqual(days);
  },
);
it.each([
  "https://user:password@example.com",
  "http://example.com",
  "javascript:alert(1)",
])("does not publish invalid source links: %s", (url) => {
  const days = fixture();
  expect(apply(days, [{ ...reviewed[0], sources: [url] }])).toEqual(days);
});
it("does not transfer a lead across destinations or merely similar anchor names", () => {
  const days = fixture();
  expect(
    appendReviewedDiningOptions(
      { destination: "Elsewhere" },
      days,
      [],
      reviewed,
      "2026-11-01",
    ),
  ).toEqual(days);
  days[0].morning.activities[0].name = "Other Botanic Gardens";
  expect(apply(days)).toEqual(days);
});
it("does not add a review lead when compatible local supply already covers breakfast", () => {
  const days = fixture();
  const close = {
    id: "close",
    mealTypes: ["breakfast" as const],
    location: days[0].morning.activities[0].location,
  };
  expect(
    appendReviewedDiningOptions(
      plan,
      days,
      [close as import("@/lib/search/types").DiningResult],
      reviewed,
      "2026-11-01",
    ),
  ).toEqual(days);
});
it("rejects invalid review dates", () => {
  expect(() => apply(fixture(), reviewed, "2026-02-30")).toThrow("review date");
});
