import liveDefault from "../../../../scripts/fixtures/live-lisbon-default-meal-gaps.json";
import { expect, it } from "vitest";
import fixture from "../../../../scripts/fixtures/live-lisbon-meal-routing.json";
import { completeMissingMeals } from "@/lib/search/complete-meals";
import type {
  SearchPlan,
  ActivityResult,
  DiningResult,
  SuggestedDay,
} from "@/lib/search/types";
const plan = {
  ...fixture.plan,
  dates: { start: "2026-12-07", end: "2026-12-07", nights: 0 },
} as unknown as SearchPlan;
const location = {
  name: "Test district",
  address: "1 Test Street",
  lat: 38.71,
  lng: -9.14,
};
const visit = {
  ...fixture.activities[0],
  id: "visit",
  name: "Museum",
  location,
} as ActivityResult;
const meals = ["breakfast", "lunch", "dinner"].map((type) => ({
  ...fixture.dining[0],
  id: type,
  name: `Cafe ${type}`,
  mealTypes: [type],
  location: { ...location, address: "2 Test Street" },
})) as DiningResult[];
const day: SuggestedDay = {
  dayNumber: 1,
  date: plan.dates.start,
  title: "Explore",
  summary: "Explore",
  morning: { activities: [visit] },
  afternoon: { activities: [] },
  evening: { activities: [] },
  estimatedCost: 0,
  currency: "",
  tips: [],
};
it("fills omitted meals from nearby eligible inventory without mutating the input", () => {
  const [result] = completeMissingMeals(plan, [day], meals);
  expect([
    result.morning.meal?.id,
    result.afternoon.meal?.id,
    result.evening.meal?.id,
  ]).toEqual(["breakfast", "lunch", "dinner"]);
  expect(day.morning.meal).toBeUndefined();
});
it.each(["idea", "distant", "unknown", "duplicate"])(
  "does not substitute %s supply",
  (kind) => {
    const inventory = meals.map((meal) => ({
      ...meal,
      planningIdea: kind === "idea" ? (true as const) : undefined,
      ...(kind === "duplicate"
        ? { name: visit.name, location: visit.location }
        : {}),
      ...(kind === "distant" ? { location: { ...location, lat: 40 } } : {}),
      ...(kind === "unknown"
        ? { location: { ...location, lat: 0, lng: 0 } }
        : {}),
    }));
    const [result] = completeMissingMeals(plan, [day], inventory);
    expect(result.morning.meal).toBeUndefined();
    expect(result.afternoon.meal).toBeUndefined();
    expect(result.evening.meal).toBeUndefined();
  },
);
it("preserves meal-specific traveler instructions and already selected meals", () => {
  expect(
    completeMissingMeals(
      { ...plan, mobilityNeeds: "Dinner already booked" },
      [day],
      meals,
    ),
  ).toEqual([day]);
  const selected = { ...day, evening: { activities: [], meal: meals[0] } };
  expect(completeMissingMeals(plan, [selected], meals)[0].evening.meal).toBe(
    meals[0],
  );
});
it("does not fill meals during a blocked work period", () => {
  const [result] = completeMissingMeals(
    {
      ...plan,
      mobilityNeeds:
        "Working 09:00–17:00 on each trip day; only evening visits",
    },
    [day],
    meals,
  );
  expect(result.afternoon.meal).toBeUndefined();
});

it("repairs the two retained default-path dinner omissions without changing selected visits", () => {
  const days = liveDefault.days as unknown as SuggestedDay[];
  const result = completeMissingMeals(
    liveDefault.plan as unknown as SearchPlan,
    days,
    liveDefault.dining as unknown as DiningResult[],
  );
  const slots = ["morning", "afternoon", "evening"] as const;
  expect(
    days.flatMap((day) => slots.filter((slot) => !day[slot].meal)),
  ).toHaveLength(2);
  expect(
    result.flatMap((day) => slots.filter((slot) => !day[slot].meal)),
  ).toHaveLength(0);
  expect(
    result.map((day) => slots.map((slot) => day[slot].activities)),
  ).toEqual(days.map((day) => slots.map((slot) => day[slot].activities)));
});
