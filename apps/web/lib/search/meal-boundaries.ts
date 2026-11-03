import type { ActivityResult, DiningResult } from "./types";

/** Only a joint name/address match establishes this duplicate. A museum and
 * its differently named cafe are not collapsed. A tasting does not prove that
 * a full meal is included; the scheduler chooses another meal venue instead. */
export function sameVisitAndMealVenue(
  visit: ActivityResult,
  meal: DiningResult,
  destination: string,
) {
  const normalize = (text: string) =>
    text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const country = destination.split(",").at(-1)?.trim();
  const address = (text: string) => {
    const value = normalize(text);
    const suffix = country ? `, ${normalize(country)}` : "";
    return suffix && value.endsWith(suffix)
      ? value.slice(0, -suffix.length)
      : value;
  };
  return (
    !!visit.location.address?.trim() &&
    !!meal.location.address?.trim() &&
    address(visit.location.address) === address(meal.location.address) &&
    normalize(visit.name).replace(/ tasting$/, "") === normalize(meal.name)
  );
}

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
