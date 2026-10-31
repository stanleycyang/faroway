import type { DiningResult, SuggestedDay } from "./types";
import { suppliedDistanceKm } from "./supplied-distance";

export interface DiningCoverageTarget {
  area: string;
  mealTypes: DiningResult["mealTypes"];
}
export interface DiningCoverageGap {
  dayNumber: number;
  slot: "morning" | "afternoon" | "evening";
  mealType: "breakfast" | "lunch" | "dinner";
  areas: string[];
  nearestSuppliedKm: number | null;
  reason: "missing_candidates" | "distant_candidates" | "unknown_locations";
}

/** Supply screening only: generated coordinates do not establish route feasibility. */
export function findDiningCoverageGaps(
  days: SuggestedDay[],
  dining: DiningResult[],
): DiningCoverageGap[] {
  const gaps: DiningCoverageGap[] = [];
  const slots = ["morning", "afternoon", "evening"] as const;
  const meals = ["breakfast", "lunch", "dinner"] as const;
  for (const day of days) {
    const allStops = slots.flatMap((slot) => day[slot].activities);
    for (const [index, slot] of slots.entries()) {
      const stops = day[slot].activities.length
        ? day[slot].activities
        : allStops;
      const candidates = dining.filter((meal) =>
        meal.mealTypes.includes(meals[index]),
      );
      const distances = candidates.map((meal) => {
        const values = stops.map((stop) =>
          suppliedDistanceKm(stop.location, meal.location),
        );
        return values.length && values.every((value) => value != null)
          ? Math.min(...(values as number[]))
          : null;
      });
      if (distances.some((distance) => distance != null && distance <= 3))
        continue;
      const known = distances.filter((value): value is number => value != null);
      gaps.push({
        dayNumber: day.dayNumber,
        slot,
        mealType: meals[index],
        areas: [
          ...new Set(
            stops
              .map((stop) => stop.location?.neighborhood?.trim())
              .filter((area): area is string => Boolean(area)),
          ),
        ],
        nearestSuppliedKm: known.length ? Math.min(...known) : null,
        reason: !candidates.length
          ? "missing_candidates"
          : distances.some((distance) => distance == null)
            ? "unknown_locations"
            : "distant_candidates",
      });
    }
  }
  return gaps;
}

/** Unknown coordinates require evidence, not a new model-invented location. */
export function diningCoverageTargets(
  gaps: DiningCoverageGap[],
): DiningCoverageTarget[] {
  const areas = new Map<string, Set<DiningCoverageGap["mealType"]>>();
  for (const gap of gaps) {
    if (gap.reason === "unknown_locations") continue;
    for (const area of gap.areas) {
      const meals = areas.get(area) ?? new Set();
      meals.add(gap.mealType);
      areas.set(area, meals);
    }
  }
  return [...areas].map(([area, meals]) => ({ area, mealTypes: [...meals] }));
}
