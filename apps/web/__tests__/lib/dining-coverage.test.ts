import { expect, it } from "vitest";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import {
  diningCoverageTargets,
  findDiningCoverageGaps,
} from "@/lib/search/dining-coverage";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
} from "@/lib/search/types";

const plan = rome.trace.steps[0].output as unknown as SearchPlan;
const activity = (rome.trace.steps[2].output as unknown as ActivityResult[])[0];
const meal = (rome.trace.steps[3].output as unknown as DiningResult[])[0];
function fixture() {
  const visit = {
    ...activity,
    duration: 60,
    bestTimeOfDay: "morning" as const,
    location: {
      ...activity.location,
      lat: 41.9,
      lng: 12.5,
      neighborhood: "Test area",
    },
  };
  const days = compileSchedule(plan, [visit], []).days;
  return {
    days,
    close: {
      ...meal,
      location: visit.location,
      mealTypes: ["breakfast", "lunch", "dinner"] as DiningResult["mealTypes"],
    },
  };
}
it("uses day visits to cover meals in empty activity slots", () => {
  const { days, close } = fixture();
  expect(days[0].evening.activities).toHaveLength(0);
  expect(findDiningCoverageGaps(days, [close])).toEqual([]);
});
it("does not count a nearby dinner-only venue as breakfast supply", () => {
  const { days, close } = fixture();
  const gaps = findDiningCoverageGaps(days, [
    { ...close, mealTypes: ["dinner"] },
  ]);
  expect(gaps.map((g) => g.mealType)).toEqual(["breakfast", "lunch"]);
  expect(gaps.every((g) => g.reason === "missing_candidates")).toBe(true);
});
it("reports distant supply and merges repeated area targets", () => {
  const { days, close } = fixture();
  const gaps = findDiningCoverageGaps(days, [
    { ...close, location: { ...close.location, lat: 42 } },
  ]);
  expect(gaps).toHaveLength(3);
  expect(
    gaps.every(
      (g) => g.reason === "distant_candidates" && g.nearestSuppliedKm! > 3,
    ),
  ).toBe(true);
  expect(diningCoverageTargets([...gaps, ...gaps])).toEqual([
    { area: "Test area", mealTypes: ["breakfast", "lunch", "dinner"] },
  ]);
});
it("requires evidence for unknown locations instead of treating them as remote", () => {
  const { days, close } = fixture();
  const gaps = findDiningCoverageGaps(days, [
    { ...close, location: { ...close.location, lat: 0, lng: 0 } },
  ]);
  expect(
    gaps.every(
      (g) => g.reason === "unknown_locations" && g.nearestSuppliedKm === null,
    ),
  ).toBe(true);
  expect(diningCoverageTargets(gaps)).toEqual([]);
});
