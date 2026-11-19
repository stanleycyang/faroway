import { test, expect } from "bun:test";
import type { SuggestedDay } from "../../packages/types/src";
import { refineFixedVisits } from "../uat/lib/fixed-visit-refinement";

function fixture(): SuggestedDay[] {
  return [0, 1].map((i) => ({
    date: `2027-01-${11 + i}`,
    dayNumber: i + 1,
    morning: {
      activities: [
        {
          id: `visit-${i}`,
          name: `Visit ${i}`,
          duration: 60,
          location: { lat: 40, lng: i ? -74 : -73.8 },
        },
      ],
      meal: {
        id: `breakfast-${i}`,
        location: { lat: 40, lng: i ? -73.8 : -74 },
      },
    },
    afternoon: {
      activities: [],
      meal: { id: `lunch-${i}`, location: { lat: 40, lng: i ? -73.8 : -74 } },
    },
    evening: {
      activities: [],
      meal: { id: `dinner-${i}`, location: { lat: 40, lng: i ? -73.8 : -74 } },
    },
  })) as unknown as SuggestedDay[];
}
test("swaps equal-duration visits without changing input or selected identities", () => {
  const days = fixture(),
    original = structuredClone(days);
  const result = refineFixedVisits(days);
  expect(days).toEqual(original);
  expect(result.moves).toHaveLength(1);
  expect(result.before.map((day) => day.farMeals)).toEqual([3, 3]);
  expect(result.after.map((day) => day.farMeals)).toEqual([0, 0]);
  expect(result.placements.map((day) => day.slots.morning)).toEqual([
    ["visit-1"],
    ["visit-0"],
  ]);
  expect(result.verified).toBe(false);
});
test("preserves explicit locks and reviewed date exclusions", () => {
  expect(
    refineFixedVisits(fixture(), { lockedIds: new Set(["visit-0"]) }).moves,
  ).toHaveLength(0);
  expect(
    refineFixedVisits(fixture(), {
      blocked: (id, date) => id === "visit-0" && date === "2027-01-12",
    }).moves,
  ).toHaveLength(0);
});
test("does not change pacing or time slots for a distance gain", () => {
  const days = fixture();
  days[1].morning.activities[0].duration = 90;
  expect(refineFixedVisits(days).moves).toHaveLength(0);
  days[1].morning.activities[0].duration = 60;
  days[1].afternoon.activities = days[1].morning.activities;
  days[1].morning.activities = [];
  expect(refineFixedVisits(days).moves).toHaveLength(0);
});
test("does not treat unknown geography as zero distance", () => {
  const days = fixture();
  days[0].morning.meal!.location.lat = 0;
  days[0].morning.meal!.location.lng = 0;
  expect(refineFixedVisits(days).moves).toHaveLength(0);
});
test("does not trade a worse day for an aggregate improvement", () => {
  const days = fixture();
  for (const slot of ["morning", "afternoon", "evening"] as const)
    days[0][slot].meal!.location.lng = -73.8;
  expect(refineFixedVisits(days).moves).toHaveLength(0);
});
test("rejects ambiguous identities and unbounded search requests", () => {
  const days = fixture();
  days[1].morning.activities[0].id = "visit-0";
  expect(() => refineFixedVisits(days)).toThrow("Unique");
  expect(() =>
    refineFixedVisits(fixture(), { maxEvaluations: Infinity }),
  ).toThrow("limit");
  expect(
    refineFixedVisits(fixture(), { maxEvaluations: 1 }).searchLimitReached,
  ).toBe(true);
});
