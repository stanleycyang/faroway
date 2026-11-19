import type { DiningResult, SearchPlan, SuggestedDay } from "./types";
import { mealBoundaryAnchors, sameVisitAndMealVenue } from "./meal-boundaries";
import { suppliedDistanceKm } from "./supplied-distance";
import {
  availableMealMinutes,
  availableSlotMinutes,
  travelerAvailability,
} from "./traveler-availability";
import { reviewedDiningDayExclusions } from "./reviewed-dining-days";
import reviewedDays from "../../../../scripts/fixtures/reviewed-dining-days.json";

/** Complete accidental omissions from existing inventory only. Never generate a
 * venue, expand a distance limit or override meal-specific traveler instructions. */
export function completeMissingMeals(
  plan: SearchPlan,
  days: SuggestedDay[],
  dining: DiningResult[],
): SuggestedDay[] {
  const instructions = [
    plan.mobilityNeeds,
    plan.requirements?.mobilityNotes,
    ...(plan.dietaryRestrictions ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  // Meal-specific free text needs semantic review; a model's null may be intentional.
  if (
    /\b(breakfast|lunch|dinner|meal|meals|fasting|reservation)\b/i.test(
      instructions,
    )
  )
    return days;
  const availability = travelerAvailability(plan, days.length);
  if (availability.needsReview) return days;
  const exclusions = reviewedDiningDayExclusions(plan, dining, reviewedDays);
  const slots = ["morning", "afternoon", "evening"] as const;
  const meals = ["breakfast", "lunch", "dinner"] as const;
  const used = new Set(
    days.flatMap((day) =>
      slots.flatMap((slot) => (day[slot].meal ? [day[slot].meal!.id] : [])),
    ),
  );
  return days.map((day, dayIndex) => {
    const next = { ...day };
    const visits = slots.flatMap((slot) => day[slot].activities);
    for (const [index, slot] of slots.entries()) {
      if (day[slot].meal || day.timingProposal) continue;
      const minutes = index === 0 ? 45 : 60;
      const window = availability.windows[dayIndex];
      const visitMinutes = day[slot].activities.reduce(
        (sum, visit) => sum + visit.duration,
        0,
      );
      if (
        availableMealMinutes(window, index) < minutes ||
        availableSlotMinutes(window, index) <
          minutes + visitMinutes + day[slot].activities.length * 30
      )
        continue;
      const anchors = mealBoundaryAnchors(day, slot);
      if (!anchors.length) continue;
      const candidates = dining
        .flatMap((meal) => {
          if (
            meal.planningIdea ||
            !meal.name.trim() ||
            !meal.mealTypes.includes(meals[index]) ||
            exclusions.some(
              (e) => e.diningId === meal.id && e.date === day.date,
            ) ||
            visits.some((visit) =>
              sameVisitAndMealVenue(visit, meal, plan.destination),
            )
          )
            return [];
          const distances = anchors.map((anchor) =>
            suppliedDistanceKm(anchor.location, meal.location),
          );
          if (distances.some((distance) => distance === null || distance > 3))
            return [];
          return [{ meal, distance: Math.max(...(distances as number[])) }];
        })
        .sort(
          (a, b) =>
            Number(used.has(a.meal.id)) - Number(used.has(b.meal.id)) ||
            a.distance - b.distance ||
            a.meal.id.localeCompare(b.meal.id),
        );
      const meal = candidates[0]?.meal;
      if (meal) {
        next[slot] = { ...day[slot], meal };
        used.add(meal.id);
      }
    }
    return next;
  });
}
