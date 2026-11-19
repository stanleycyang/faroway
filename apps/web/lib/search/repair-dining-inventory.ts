import {
  diningCoverageTargets,
  findDiningCoverageGaps,
} from "./dining-coverage";
import type { DiningCoverageTarget } from "./dining-coverage";
import type { CompiledSchedule } from "./schedule-compiler";
import type { DiningResult } from "./types";

/** One bounded inventory retry. New candidates still pass the original compiler's
 * evidence, closure and distance screens; an unresolved gap stays unresolved. */
export async function repairDiningInventory(
  dining: DiningResult[],
  compile: (inventory: DiningResult[]) => CompiledSchedule,
  discover: (
    targets: DiningCoverageTarget[],
    existingNames: string[],
  ) => Promise<DiningResult[]>,
) {
  const initial = compile(dining);
  const targets = diningCoverageTargets(
    findDiningCoverageGaps(initial.days, dining).filter((gap) =>
      initial.issues.includes(
        `day_${gap.dayNumber}:${gap.mealType}:meal_supply_gap`,
      ),
    ),
  ).slice(0, 8);
  if (!targets.length) return { compiled: initial, dining };
  const additional = await discover(
    targets,
    dining.map((meal) => meal.name),
  );
  const identity = (meal: DiningResult) =>
    `${meal.name}\n${meal.location.address}`
      .normalize("NFKC")
      .toLowerCase()
      .trim();
  const ids = new Set(dining.map((meal) => meal.id));
  const identities = new Set(dining.map(identity));
  const merged = [...dining];
  for (const meal of additional.slice(0, 12)) {
    if (meal.planningIdea || ids.has(meal.id) || identities.has(identity(meal)))
      continue;
    ids.add(meal.id);
    identities.add(identity(meal));
    merged.push(meal);
  }
  return {
    compiled: merged.length === dining.length ? initial : compile(merged),
    dining: merged,
  };
}
