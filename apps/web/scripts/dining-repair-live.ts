/** One bounded dining-resupply experiment against a frozen compiled schedule. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { assertStagingTarget } from "../../../scripts/uat/lib/staging-project";
import {
  evaluateAgenticTrace,
  type AgenticTrace,
} from "../../../scripts/uat/lib/agentic-eval";
import {
  diningCoverageTargets,
  findDiningCoverageGaps,
} from "../lib/search/dining-coverage";
import {
  compileSchedule,
  type ScheduleExclusion,
} from "../lib/search/schedule-compiler";
import { mapSearchResultsToItinerary } from "../lib/search/bridge";
import {
  onPlanningUsage,
  onPlanningFallback,
  replacePlanningStepEnv,
  sumPlanningUsage,
  type PlanningUsageRecord,
  type PlanningFallbackRecord,
} from "../lib/ai/planning-step";
import { estimateUsageUsd } from "../lib/ai/model-cost";
import type {
  ActivityResult,
  DiningResult,
  HotelResult,
  SearchPlan,
  SuggestedDay,
} from "../lib/search/types";

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}
const signature = (days: SuggestedDay[]) =>
  JSON.stringify(
    days.map((day) => ({
      date: day.date,
      slots: [day.morning, day.afternoon, day.evening].map((slot) =>
        slot.activities.map((a) => a.id),
      ),
    })),
  );

async function main() {
  if (!process.argv.includes("--live"))
    throw new Error("Explicit --live required");
  assertStagingTarget({
    supabaseUrl: arg("--supabase-url"),
    projectRef: process.env.FAROWAY_STAGING_SUPABASE_PROJECT_REF,
  });
  const key = process.env.FAROWAY_STAGING_AI_GATEWAY_KEY?.trim();
  if (!key) throw new Error("Dedicated staging key required");
  const input = arg("--input"),
    out = arg("--out");
  if (!input || !out || existsSync(out))
    throw new Error("Existing --input and new --out required");
  const bytes = readFileSync(input);
  const original = JSON.parse(bytes.toString()) as {
    trace: AgenticTrace;
    provenance?: { kind?: string; exclusions?: ScheduleExclusion[] };
  };
  if (!evaluateAgenticTrace(original.trace).contractPass)
    throw new Error("Frozen input fails contract evaluation");
  if (
    original.provenance?.kind !== "offline-compiled-schedule" ||
    original.trace.steps.length !== 5 ||
    original.trace.steps.some((step) => step.fallbacks.length)
  )
    throw new Error("Complete non-fallback compiled schedule required");
  const plan = original.trace.steps[0].output as SearchPlan;
  const hotels = original.trace.steps[1].output as HotelResult[];
  const activities = original.trace.steps[2].output as ActivityResult[];
  const dining = original.trace.steps[3].output as DiningResult[];
  const itinerary = original.trace.steps[4].output as {
    days: SuggestedDay[];
    topHotel: HotelResult | null;
  };
  const exclusions = original.provenance.exclusions ?? [];
  // Refuse source drift before spending: this experiment must freeze activity choices.
  if (
    signature(compileSchedule(plan, activities, dining, exclusions).days) !==
    signature(itinerary.days)
  )
    throw new Error(
      "Compiler changed the frozen visits; regenerate the offline baseline first",
    );
  const before = findDiningCoverageGaps(itinerary.days, dining);
  const targets = diningCoverageTargets(before);
  if (!targets.length || targets.length > 8)
    throw new Error("Requires 1–8 actionable coverage targets");
  process.env.AI_GATEWAY_API_KEY = key;
  for (const variable of [
    "TRIPADVISOR_API_KEY",
    "GOOGLE_PLACES_API_KEY",
    "TAVILY_API_KEY",
    "VIATOR_API_KEY",
    "DUFFEL_API_TOKEN",
    "LITEAPI_API_KEY",
  ])
    delete process.env[variable];
  const settings = {
    PLANNING_MODEL_DINING: "google/gemini-3-flash",
    PLANNING_THINKING_DINING: "low",
  };
  replacePlanningStepEnv(settings);
  const { runDiningAgent } = await import("../lib/search/agents/dining");
  const root = resolve(import.meta.dirname, "../../..");
  const hash = createHash("sha256");
  for (const file of [
    "apps/web/scripts/dining-repair-live.ts",
    "apps/web/lib/search/agents/dining.ts",
    "apps/web/lib/search/dining-coverage.ts",
    "apps/web/lib/search/schedule-compiler.ts",
    "apps/web/lib/search/highlight-match.ts",
    "apps/web/lib/search/party-suitability.ts",
    "apps/web/lib/search/supplied-distance.ts",
    "apps/web/lib/ai/planning-step.ts",
    "apps/web/lib/ai/sdk.ts",
    "bun.lock",
  ])
    hash.update(file).update(readFileSync(resolve(root, file)));
  const trace: AgenticTrace = {
    ...original.trace,
    runId: randomUUID(),
    configId: "dining-coverage-repair-low",
    startedAt: new Date().toISOString(),
    settings,
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
    steps: original.trace.steps.map((step) => ({
      ...step,
      latencyMs: 0,
      usage: [],
    })),
  };
  const usages: PlanningUsageRecord[] = [],
    fallbacks: PlanningFallbackRecord[] = [];
  const provenance = {
    kind: "single-dining-resupply",
    frozenInputSha256: createHash("sha256").update(bytes).digest("hex"),
    targets,
    before,
    upstreamGenerationCostExcluded: true,
    modelCallsMaximum: 1,
    requestedCandidates: Math.min(12, targets.length * 2),
    locationEvidence: "model-supplied and unverified",
    qualityAccepted: false,
  };
  mkdirSync(dirname(resolve(out)), { recursive: true, mode: 0o700 });
  const save = (status: string, extra: object = {}) =>
    writeFileSync(
      out,
      JSON.stringify({ status, trace, provenance, ...extra }, null, 2),
      { mode: 0o600 },
    );
  writeFileSync(out, "{}", { flag: "wx", mode: 0o600 });
  save("started");
  const stopUsage = onPlanningUsage((record) => {
    if (record.step === "dining") usages.push(record);
  });
  const stopFallback = onPlanningFallback((record) => {
    if (record.step === "dining") fallbacks.push(record);
  });
  const started = Date.now();
  try {
    const additions = await runDiningAgent(
      plan,
      provenance.requestedCandidates,
      {
        coverageTargets: targets,
        existingNames: dining.map((meal) => meal.name),
      },
    );
    const normalize = (name: string) =>
      name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
        .trim();
    const names = new Set(dining.map((meal) => normalize(meal.name)));
    const accepted = additions.filter((meal) => {
      const name = normalize(meal.name);
      if (!name || names.has(name)) return false;
      names.add(name);
      return true;
    });
    const merged = [...dining, ...accepted];
    trace.steps[3] = {
      step: "dining",
      output: merged,
      latencyMs: Date.now() - started,
      usage: usages,
      fallbacks,
    };
    const compileStart = Date.now();
    const compiled = compileSchedule(plan, activities, merged, exclusions);
    if (signature(compiled.days) !== signature(itinerary.days))
      throw new Error("Repair unexpectedly changed frozen visits");
    const days = compiled.days.map((day) => ({
      ...day,
      hotel: itinerary.topHotel ?? undefined,
    }));
    trace.steps[4] = {
      step: "aggregator",
      output: { days, topHotel: itinerary.topHotel },
      latencyMs: Date.now() - compileStart,
      usage: [],
      fallbacks: [],
    };
    trace.mappedItinerary = mapSearchResultsToItinerary(
      {
        searchId: trace.runId,
        hotels,
        activities,
        dining: merged,
        transport: [],
        itinerary: days,
      },
      itinerary.topHotel,
    );
    const usage = sumPlanningUsage(usages);
    const known =
      usage && usage.inputTokens != null && usage.outputTokens != null;
    const result = {
      addedCount: accepted.length,
      duplicateNamesDropped: additions.length - accepted.length,
      after: findDiningCoverageGaps(days, merged),
      evaluation: evaluateAgenticTrace(trace),
      estimatedRepairUsd: known ? estimateUsageUsd(usage.model, usage) : null,
    };
    save("completed", result);
    console.log(JSON.stringify(result));
    if (!known) process.exitCode = 3;
    else if (fallbacks.length) process.exitCode = 2;
  } catch (error) {
    trace.steps[3].latencyMs = Date.now() - started;
    trace.steps[3].usage = usages;
    trace.steps[3].fallbacks = fallbacks;
    save("failed", {
      error: error instanceof Error ? error.message : "unknown",
      usage: usages,
      fallbacks,
      billing: "Reconcile gateway before another live call",
    });
    process.exitCode = 3;
  } finally {
    stopUsage();
    stopFallback();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Repair failed");
  process.exitCode = 1;
});
