import type { ActivityResult } from "./types";

export type MealSlot = "morning" | "afternoon" | "evening";
export type VisitSlots = Record<MealSlot, { activities: ActivityResult[] }>;

/**
 * A screening convention, not a timed route: breakfast precedes the first
 * visit, lunch bridges morning and later visits, dinner follows the last visit.
 * Hotel returns, transfers and fixed booking times still require verification.
 */
export function mealBoundaryAnchors(
  day: VisitSlots,
  slot: MealSlot,
): ActivityResult[] {
  const first =
    day.morning.activities[0] ??
    day.afternoon.activities[0] ??
    day.evening.activities[0];
  const last =
    day.evening.activities.at(-1) ??
    day.afternoon.activities.at(-1) ??
    day.morning.activities.at(-1);
  if (slot === "morning") return first ? [first] : [];
  if (slot === "evening") return last ? [last] : [];
  const before = day.morning.activities.at(-1);
  const after = day.afternoon.activities[0] ?? day.evening.activities[0];
  return [before, after].filter((visit): visit is ActivityResult =>
    Boolean(visit),
  );
}
