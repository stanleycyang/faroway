/** Offline regression over retained synthetic inventory. Never calls a provider. */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileSchedule } from "../../apps/web/lib/search/schedule-compiler";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
} from "../../apps/web/lib/search/types";

const [directory, outputPath] = process.argv.slice(2);
if (!directory || !outputPath)
  throw new Error(
    "Usage: bun scripts/uat/evaluate-compiler.ts <trace-directory> <new-output.json>",
  );
if (existsSync(outputPath))
  throw new Error("Preserve prior evidence: output already exists");
const results = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const raw = JSON.parse(readFileSync(resolve(directory, name), "utf8"));
    const trace = raw.trace ?? raw;
    if (!Array.isArray(trace.steps)) throw new Error(`Missing steps: ${name}`);
    const output = (step: string) =>
      trace.steps.find(
        (entry: { step: string; output: unknown }) => entry.step === step,
      )?.output;
    const plan = output("orchestrator") as SearchPlan;
    const activities = output("activities") as ActivityResult[];
    const dining = output("dining") as DiningResult[];
    if (!plan || !Array.isArray(activities) || !Array.isArray(dining))
      throw new Error(`Missing inventory: ${name}`);
    const result = compileSchedule(plan, activities, dining, [], {
      maxUnverifiedTransferKm: 6,
      maxUnverifiedMealDistanceKm: 3,
    });
    return {
      case: name,
      days: result.days.length,
      scheduledVisits: result.days.reduce(
        (sum, day) =>
          sum +
          day.morning.activities.length +
          day.afternoon.activities.length +
          day.evening.activities.length,
        0,
      ),
      timingConflicts: result.timingProposals.filter(
        (proposal) => !proposal.fitsPolicy,
      ).length,
      mealGaps: result.issues.filter((issue) =>
        issue.endsWith(":meal_supply_gap"),
      ).length,
      activityGaps: result.issues.filter((issue) =>
        issue.endsWith(":activity_supply_gap"),
      ).length,
      verified: false,
    };
  });
if (!results.length) throw new Error("No cases found");
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      scope:
        "Frozen development inventory, pure compiler only; no source/hour/identity review or live generation. Not traveler acceptance.",
      results,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    cases: results.length,
    days: results.reduce((n, r) => n + r.days, 0),
    timingConflicts: results.reduce((n, r) => n + r.timingConflicts, 0),
    mealGaps: results.reduce((n, r) => n + r.mealGaps, 0),
    activityGaps: results.reduce((n, r) => n + r.activityGaps, 0),
  }),
);
