import {
  venueConstraintsForDate,
  type VenueConstraint,
} from "../../../scripts/uat/lib/venue-constraints";
import { inclusiveDays } from "../../../scripts/uat/lib/briefs";
/** Offline-only regression replay: no model, database, or provider calls. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createFallbackItinerary } from "../lib/search/fallback-itinerary";
import {
  compileSchedule,
  type ScheduleExclusion,
} from "../lib/search/schedule-compiler";
import { mapSearchResultsToItinerary } from "../lib/search/bridge";
import {
  evaluateAgenticTrace,
  type AgenticTrace,
} from "../../../scripts/uat/lib/agentic-eval";
import type {
  SearchPlan,
  HotelResult,
  ActivityResult,
  DiningResult,
} from "../lib/search/types";
const [input, output] = process.argv.slice(2);
const compiledSchedule = process.argv.includes("--compiled-schedule");
const exclusionsIndex = process.argv.indexOf("--exclusions");
const exclusionsBytes =
  exclusionsIndex >= 0
    ? readFileSync(process.argv[exclusionsIndex + 1])
    : undefined;
const factsIndex = process.argv.indexOf("--venue-constraints");
const factsBytes =
  factsIndex >= 0 ? readFileSync(process.argv[factsIndex + 1]) : undefined;
const facts: VenueConstraint[] = factsBytes
  ? JSON.parse(factsBytes.toString())
  : [];
const exclusions: ScheduleExclusion[] = exclusionsBytes
  ? JSON.parse(exclusionsBytes.toString())
  : [];
if ((exclusionsIndex >= 0 || factsIndex >= 0) && !compiledSchedule)
  throw new Error("Exclusions require --compiled-schedule");
if (!input || !output || existsSync(output))
  throw new Error(
    "Usage: fallback-replay.ts INPUT_TRACE NEW_OUTPUT [--compiled-schedule]",
  );
const bytes = readFileSync(input);
const original: AgenticTrace = JSON.parse(bytes.toString()).trace;
evaluateAgenticTrace(original);
const upstream = original.steps.slice(0, 4);
if (
  upstream.map((s) => s.step).join() !== "orchestrator,hotels,activities,dining"
)
  throw new Error("Complete upstream trace required");
const plan = upstream[0].output as SearchPlan;
const hotels = upstream[1].output as HotelResult[];
const activities = upstream[2].output as ActivityResult[];
const dining = upstream[3].output as DiningResult[];
if (factsBytes) {
  const span =
    (Date.parse(`${plan.dates.end}T00:00:00Z`) -
      Date.parse(`${plan.dates.start}T00:00:00Z`)) /
      86400000 +
    1;
  if (!Number.isInteger(span) || span < 1 || span > 31)
    throw new Error("Evidence replay requires 1–31 valid days");
  const dates = inclusiveDays(plan.dates.start, plan.dates.end);
  if (dates.length > 31) throw new Error("Evidence replay limited to 31 days");
  for (const date of dates)
    for (const activity of activities) {
      for (const finding of venueConstraintsForDate(
        plan.destination,
        activity.name,
        date,
        facts,
      )) {
        exclusions.push({
          activityId: activity.id,
          date,
          reason: finding.finding,
          sourceUrl: finding.sourceUrl,
          observedAt: finding.observedAt,
        });
      }
    }
}
const started = Date.now();
const compiled = compiledSchedule
  ? compileSchedule(plan, activities, dining, exclusions)
  : undefined;
// Freeze the existing hotel choice so this experiment only changes scheduling.
const originalHotel = (
  original.steps[4]?.output as { topHotel?: HotelResult } | undefined
)?.topHotel;
const topHotel =
  hotels.find((hotel) => hotel.id === originalHotel?.id) ?? hotels[0] ?? null;
const result = compiled
  ? {
      days: compiled.days.map((day) => ({
        ...day,
        hotel: topHotel ?? undefined,
      })),
      topHotel,
    }
  : createFallbackItinerary(plan, hotels, activities, dining);
const elapsed = Date.now() - started;
const root = resolve(import.meta.dirname, "../../..");
const hash = createHash("sha256");
for (const file of [
  "apps/web/lib/search/schedule-compiler.ts",
  "apps/web/lib/search/speculative-event.ts",
  "apps/web/lib/search/schedule-timing.ts",
  "scripts/uat/lib/timing-proposal.ts",
  "apps/web/lib/search/meal-boundaries.ts",
  "apps/web/lib/search/highlight-match.ts",
  "apps/web/lib/search/party-suitability.ts",
  "apps/web/lib/search/bridge.ts",
  "packages/types/src/day-timing.ts",
  "apps/web/lib/search/supplied-distance.ts",
  "apps/web/lib/location-coordinates.ts",
  "apps/web/lib/search/fallback-itinerary.ts",
  "scripts/uat/lib/agentic-eval.ts",
  "scripts/uat/lib/venue-constraints.ts",
  "scripts/uat/lib/briefs.ts",
  "apps/web/scripts/fallback-replay.ts",
])
  hash.update(file).update(readFileSync(resolve(root, file)));
const trace: AgenticTrace = {
  ...original,
  configId: compiledSchedule
    ? "offline-compiled-schedule"
    : "offline-fallback-replay",
  startedAt: new Date().toISOString(),
  source: {
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    dirty: Boolean(
      execFileSync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
    ),
    filesSha256: hash.digest("hex"),
  },
  steps: [
    ...upstream.map((s) => ({ ...s, latencyMs: 0, usage: [] })),
    {
      step: "aggregator",
      output: result,
      latencyMs: elapsed,
      usage: [],
      fallbacks: compiledSchedule
        ? []
        : [
            {
              reason: "offline_forced_fallback",
              outcome: "fallback_itinerary",
            },
          ],
    },
  ],
  mappedItinerary: mapSearchResultsToItinerary(
    {
      searchId: original.runId,
      hotels,
      activities,
      dining,
      transport: [],
      itinerary: result.days,
    },
    result.topHotel,
  ),
};
const evaluation = evaluateAgenticTrace(trace);
mkdirSync(dirname(resolve(output)), { recursive: true, mode: 0o700 });
writeFileSync(
  output,
  JSON.stringify(
    {
      trace,
      provenance: {
        kind: compiledSchedule
          ? "offline-compiled-schedule"
          : "offline-fallback-replay",
        originalInputSha256: createHash("sha256").update(bytes).digest("hex"),
        modelCalls: 0,
        upstreamGenerationCostExcluded: true,
        ...(factsBytes
          ? {
              inputVenueConstraintsSha256: createHash("sha256")
                .update(factsBytes)
                .digest("hex"),
              constraintSource: "manually-reviewed-fixture",
              exclusions,
            }
          : {}),
        ...(exclusionsBytes
          ? {
              inputExclusionsSha256: createHash("sha256")
                .update(exclusionsBytes)
                .digest("hex"),
              exclusions,
            }
          : {}),
        ...(compiled
          ? { experimental: true, narration: "inventory-name-template" }
          : {}),
      },
      ...(compiled
        ? {
            compiler: {
              timingProposals: compiled.timingProposals,
              issues: compiled.issues,
              unselectedActivityIds: compiled.unselectedActivityIds,
              deferredLongVisits: compiled.deferredLongVisits,
              unfulfilledHighlights: compiled.unfulfilledHighlights,
              reviewRequiredActivities: compiled.reviewRequiredActivities,
              verified: compiled.verified,
            },
          }
        : {}),
      evaluation,
    },
    null,
    2,
  ),
  { mode: 0o600, flag: "wx" },
);
console.log(
  JSON.stringify({
    evaluation,
    modelCalls: 0,
    ...(compiled ? { issues: compiled.issues } : {}),
  }),
);
