import { mealBoundaryAnchors } from "./meal-boundaries";
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
  /** Best candidate's farthest boundary leg, from unverified coordinates. */
  nearestSuppliedKm: number | null;
  maxSuppliedAnchorKm?: number;
  reason:
    | "missing_candidates"
    | "distant_candidates"
    | "unknown_locations"
    | "separated_visit_anchors";
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
    for (const [index, slot] of slots.entries()) {
      const stops = mealBoundaryAnchors(day, slot);
      const candidates = dining.filter((meal) =>
        meal.mealTypes.includes(meals[index]),
      );
      const distances = candidates.map((meal) => {
        const values = stops.map((stop) =>
          suppliedDistanceKm(stop.location, meal.location),
        );
        return values.length && values.every((value) => value != null)
          ? Math.max(...(values as number[]))
          : null;
      });
      if (distances.some((distance) => distance != null && distance <= 3))
        continue;
      const anchorDistances = stops
        .flatMap((stop, i) =>
          stops
            .slice(i + 1)
            .map((other) => suppliedDistanceKm(stop.location, other.location)),
        )
        .filter((value): value is number => value != null);
      const maxSuppliedAnchorKm = anchorDistances.length
        ? Math.max(...anchorDistances)
        : undefined;
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
        ...(maxSuppliedAnchorKm === undefined ? {} : { maxSuppliedAnchorKm }),
        // Triangle inequality: no point can be within 3 km of both anchors
        // when they are over 6 km apart. This uses supplied, unverified locations.
        reason:
          maxSuppliedAnchorKm !== undefined && maxSuppliedAnchorKm > 6
            ? "separated_visit_anchors"
            : !candidates.length
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
    if (
      gap.reason === "unknown_locations" ||
      gap.reason === "separated_visit_anchors"
    )
      continue;
    for (const area of gap.areas) {
      const meals = areas.get(area) ?? new Set();
      meals.add(gap.mealType);
      areas.set(area, meals);
    }
  }
  return [...areas].map(([area, meals]) => ({ area, mealTypes: [...meals] }));
}
