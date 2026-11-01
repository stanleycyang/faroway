import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SuggestedDay, DiningResult } from "../../packages/types/src";
import { evaluateAgenticTrace, type AgenticTrace } from "./lib/agentic-eval";
import { suppliedDistanceKm } from "./lib/route-eval";

const slots = ["morning", "afternoon", "evening"] as const;
const types = ["breakfast", "lunch", "dinner"] as const;
const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate)
  throw new Error(
    "Usage: evaluate-meal-geography.ts BASELINE_DIR CANDIDATE_DIR",
  );
const files = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
const names = files(baseline);
if (!names.length || JSON.stringify(names) !== JSON.stringify(files(candidate)))
  throw new Error("Nonempty, identical trace sets required");

function read(dir: string, file: string) {
  const trace: AgenticTrace = JSON.parse(
    readFileSync(join(dir, file), "utf8"),
  ).trace;
  const evaluation = evaluateAgenticTrace(trace);
  if (!evaluation.contractPass)
    throw new Error(`${dir}/${file}: contract failed`);
  const days = (
    trace.steps.find((s) => s.step === "aggregator")!.output as {
      days: SuggestedDay[];
    }
  ).days;
  const inventory = trace.steps.find((s) => s.step === "dining")!
    .output as DiningResult[];
  return { trace, days, inventory };
}

function measure({ days, inventory }: ReturnType<typeof read>) {
  let known = 0,
    unknown = 0,
    missing = 0,
    boundaryKm = 0,
    far = 0,
    avoidableFar = 0,
    regretOver1Km = 0;
  const restaurants = new Set<string>();
  for (const day of days) {
    // Independent rubric: breakfast before first visit, lunch between periods,
    // dinner after last visit. Deliberately do not import the compiler helper.
    const visits = slots.flatMap((slot) => day[slot].activities);
    const anchors = [
      visits.slice(0, 1),
      [
        day.morning.activities.at(-1),
        day.afternoon.activities[0] ?? day.evening.activities[0],
      ].filter(Boolean),
      visits.slice(-1),
    ];
    for (const [i, slot] of slots.entries()) {
      const meal = day[slot].meal;
      if (!meal) {
        missing++;
        continue;
      }
      restaurants.add(meal.id);
      const score = (m: DiningResult) => {
        const legs = anchors[i].map((a) =>
          suppliedDistanceKm(a!.location, m.location),
        );
        if (!legs.length || legs.some((d) => d === null)) return null;
        const knownLegs = legs as number[];
        return {
          total: knownLegs.reduce((a, b) => a + b, 0),
          max: Math.max(...knownLegs),
        };
      };
      const selected = score(meal);
      if (!selected) {
        unknown++;
        continue;
      }
      known++;
      boundaryKm += selected.total;
      const alternatives = inventory
        .filter((m) => m.mealTypes.includes(types[i]))
        .map(score)
        .filter((s) => s !== null);
      if (selected.max > 3) {
        far++;
        if (alternatives.some((s) => s.max <= 3)) avoidableFar++;
      }
      if (
        alternatives.length &&
        selected.total - Math.min(...alternatives.map((s) => s.total)) > 1
      )
        regretOver1Km++;
    }
  }
  return {
    known,
    unknown,
    missing,
    boundaryKm: Math.round(boundaryKm * 10) / 10,
    far,
    avoidableFar,
    regretOver1Km,
    uniqueRestaurants: restaurants.size,
  };
}

const results = names.map((file) => {
  const before = read(baseline, file),
    after = read(candidate, file);
  const signature = (r: typeof before) =>
    JSON.stringify(
      r.days.map((day) => ({
        date: day.date,
        visits: slots.map((slot) => day[slot].activities),
      })),
    );
  if (signature(before) !== signature(after))
    throw new Error(`${file}: activities changed`);
  if (
    JSON.stringify(before.inventory) !== JSON.stringify(after.inventory) ||
    JSON.stringify(before.trace.brief) !== JSON.stringify(after.trace.brief)
  )
    throw new Error(`${file}: input inventory or brief changed`);
  return {
    brief: before.trace.brief.id,
    before: measure(before),
    after: measure(after),
  };
});
console.log(
  JSON.stringify(
    {
      rubric: "supplied-meal-boundaries-v1",
      qualityAccepted: false,
      limitations:
        "Unverified supplied coordinates; no street routes, hotel returns, opening hours, reservations, dietary suitability, or transfer times modeled. Alternatives ignore reuse preference. Passing contracts and unchanged activities do not establish traveler quality.",
      results,
    },
    null,
    2,
  ),
);
