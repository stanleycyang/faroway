import { expect, it } from "vitest";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import { mealBoundaryAnchors } from "@/lib/search/meal-boundaries";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
} from "@/lib/search/types";
const base = (rome.trace.steps[2].output as unknown as ActivityResult[])[0];
const meal = (rome.trace.steps[3].output as unknown as DiningResult[])[0];
const plan = rome.trace.steps[0].output as unknown as SearchPlan;
const visit = (
  id: string,
  lat = 48.86,
  bestTimeOfDay: ActivityResult["bestTimeOfDay"] = "any",
) => ({
  ...base,
  id,
  name: id,
  duration: 30,
  vibeScore: 100,
  bestTimeOfDay,
  location: { ...base.location, lat, lng: 2.34 },
});
it("uses ordered meal boundaries rather than any visit in the slot", () => {
  const day = {
    morning: { activities: [visit("m1"), visit("m2")] },
    afternoon: { activities: [visit("a1"), visit("a2")] },
    evening: { activities: [visit("e1"), visit("e2")] },
  };
  expect(mealBoundaryAnchors(day, "morning").map((a) => a.id)).toEqual(["m1"]);
  expect(mealBoundaryAnchors(day, "afternoon").map((a) => a.id)).toEqual([
    "m2",
    "a1",
  ]);
  expect(mealBoundaryAnchors(day, "evening").map((a) => a.id)).toEqual(["e2"]);
  day.afternoon.activities = [];
  expect(mealBoundaryAnchors(day, "afternoon").map((a) => a.id)).toEqual([
    "m2",
    "e1",
  ]);
  day.morning.activities = [];
  expect(mealBoundaryAnchors(day, "morning").map((a) => a.id)).toEqual(["e1"]);
  day.evening.activities = [];
  expect(mealBoundaryAnchors(day, "evening")).toEqual([]);
});
it("places lunch near the morning-to-evening transition and dinner by the last visit", () => {
  const activities = [
    visit("museum", 48.86, "morning"),
    visit("cruise", 48.86, "evening"),
    visit("tower", 48.92, "evening"),
  ];
  const restaurants = [
    {
      ...meal,
      id: "museum-meal",
      name: "Museum meal",
      location: activities[0].location,
      mealTypes: ["breakfast", "lunch", "dinner"],
    },
    {
      ...meal,
      id: "tower-meal",
      name: "Tower meal",
      location: activities[2].location,
      mealTypes: ["breakfast", "lunch", "dinner"],
    },
  ] as DiningResult[];
  const result = compileSchedule(
    {
      ...plan,
      activityCriteria: {
        ...plan.activityCriteria,
        pacePreference: "moderate",
      },
    },
    activities,
    restaurants,
  );
  const day = result.days[0];
  expect(day.morning.activities.map((a) => a.id)).toEqual(["museum"]);
  expect(day.evening.activities.map((a) => a.id)).toEqual(["cruise", "tower"]);
  expect(day.afternoon.meal?.id).toBe("museum-meal");
  expect(day.evening.meal?.id).toBe("tower-meal");
  expect(result.verified).toBe(false);
});
