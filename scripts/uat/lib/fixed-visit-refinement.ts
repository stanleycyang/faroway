import type { SuggestedDay } from "../../../packages/types/src";
import { suppliedDistanceKm } from "./route-eval";

const slots = ["morning", "afternoon", "evening"] as const;
type Slot = (typeof slots)[number];
type Position = { day: number; slot: Slot; index: number };

/** Independent screening over fixed meals; no route, hours or availability claim. */
export function fixedDayGeography(day: SuggestedDay) {
  const visits = slots.flatMap((slot) => day[slot].activities);
  const anchors = [
    visits.slice(0, 1),
    [
      day.morning.activities.at(-1),
      day.afternoon.activities[0] ?? day.evening.activities[0],
    ].filter(Boolean),
    visits.slice(-1),
  ];
  let unknown = 0,
    farMeals = 0,
    mealKm = 0,
    visitKm = 0;
  for (const [index, slot] of slots.entries()) {
    const meal = day[slot].meal;
    if (!meal || !anchors[index].length) {
      unknown++;
      continue;
    }
    const legs = anchors[index].map((visit) =>
      suppliedDistanceKm(visit!.location, meal.location),
    );
    if (legs.some((leg) => leg === null)) {
      unknown++;
      continue;
    }
    const distances = legs as number[];
    mealKm += distances.reduce((sum, distance) => sum + distance, 0);
    if (Math.max(...distances) > 3) farMeals++;
  }
  for (let i = 1; i < visits.length; i++) {
    const distance = suppliedDistanceKm(
      visits[i - 1].location,
      visits[i].location,
    );
    if (distance === null) unknown++;
    else visitKm += distance;
  }
  return { unknown, farMeals, mealKm, visitKm };
}

/**
 * Offline opportunity search only. Same-slot, equal-duration swaps preserve the
 * selected visit multiset, daily counts/minutes, meal identities and time policy.
 * Caller supplies reviewed date exclusions and explicit locks. No saved plan is
 * returned: narratives and timing metadata must be regenerated before app use.
 */
export function refineFixedVisits(
  input: SuggestedDay[],
  options: {
    blocked?: (activityId: string, date: string) => boolean;
    lockedIds?: ReadonlySet<string>;
    maxEvaluations?: number;
  } = {},
) {
  const days = structuredClone(input);
  const positions: Position[] = days.flatMap((day, index) =>
    slots.flatMap((slot) =>
      day[slot].activities.map((_, i) => ({ day: index, slot, index: i })),
    ),
  );
  const activity = (p: Position) => days[p.day][p.slot].activities[p.index];
  const ids = positions.map((p) => activity(p).id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id))
    throw new Error("Unique selected activity identities required");
  const limit = options.maxEvaluations ?? 20000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100000)
    throw new Error("Evaluation limit must be an integer from 1 to 100000");
  const before = days.map(fixedDayGeography);
  let scores = before,
    evaluations = 0;
  const moves: Array<{
    first: Position;
    second: Position;
    firstId: string;
    secondId: string;
  }> = [];
  let improved = true;
  while (improved && evaluations < limit) {
    improved = false;
    for (let i = 0; i < positions.length && evaluations < limit; i++) {
      for (let j = i + 1; j < positions.length && evaluations < limit; j++) {
        const a = positions[i],
          b = positions[j],
          x = activity(a),
          y = activity(b);
        if (
          a.slot !== b.slot ||
          x.duration !== y.duration ||
          !Number.isInteger(x.duration) ||
          x.duration <= 0 ||
          options.lockedIds?.has(x.id) ||
          options.lockedIds?.has(y.id) ||
          options.blocked?.(x.id, days[b.day].date) ||
          options.blocked?.(y.id, days[a.day].date)
        )
          continue;
        const affected = [...new Set([a.day, b.day])];
        if (affected.some((day) => scores[day].unknown)) continue;
        evaluations++;
        days[a.day][a.slot].activities[a.index] = y;
        days[b.day][b.slot].activities[b.index] = x;
        const next = [...scores];
        for (const day of affected) next[day] = fixedDayGeography(days[day]);
        const noRegression = affected.every(
          (day) =>
            !next[day].unknown &&
            next[day].farMeals <= scores[day].farMeals &&
            next[day].mealKm <= scores[day].mealKm + 1e-6 &&
            next[day].visitKm <= scores[day].visitKm + 1e-6,
        );
        const gain = affected.reduce(
          (sum, day) => sum + scores[day].mealKm - next[day].mealKm,
          0,
        );
        if (noRegression && gain > 0.01) {
          scores = next;
          improved = true;
          moves.push({ first: a, second: b, firstId: x.id, secondId: y.id });
        } else {
          days[a.day][a.slot].activities[a.index] = x;
          days[b.day][b.slot].activities[b.index] = y;
        }
      }
    }
  }
  return {
    before,
    after: scores,
    moves,
    evaluations,
    searchLimitReached: evaluations >= limit,
    verified: false as const,
    placements: days.map((day) => ({
      date: day.date,
      slots: Object.fromEntries(
        slots.map((slot) => [
          slot,
          day[slot].activities.map((visit) => visit.id),
        ]),
      ),
    })),
  };
}
