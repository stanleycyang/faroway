/** One live aggregator call against frozen upstream outputs; never regenerates inventory. */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  existsSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { assertStagingTarget } from "../../../scripts/uat/lib/staging-project";
import {
  evaluateAgenticTrace,
  type AgenticTrace,
} from "../../../scripts/uat/lib/agentic-eval";
import {
  onPlanningUsage,
  onPlanningFallback,
  replacePlanningStepEnv,
  sumPlanningUsage,
  type PlanningUsageRecord,
  type PlanningFallbackRecord,
} from "../lib/ai/planning-step";
import { estimateUsageUsd } from "../lib/ai/model-cost";
import { mapSearchResultsToItinerary } from "../lib/search/bridge";
import type {
  SearchPlan,
  HotelResult,
  ActivityResult,
  DiningResult,
} from "../lib/search/types";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}
async function main() {
  if (!process.argv.includes("--live"))
    throw new Error("Explicit --live required");
  assertStagingTarget({
    supabaseUrl: arg("--supabase-url"),
    projectRef: process.env.FAROWAY_STAGING_SUPABASE_PROJECT_REF,
  });
  const key = process.env.FAROWAY_STAGING_AI_GATEWAY_KEY?.trim();
  if (!key) throw new Error("Dedicated staging key required");
  const input = arg("--input");
  const out = arg("--out");
  const thinking = arg("--thinking") ?? "medium";
  if (!input || !out) throw new Error("--input and --out required");
  if (!["minimal", "low", "medium", "high"].includes(thinking))
    throw new Error("Invalid thinking level");
  if (existsSync(out))
    throw new Error("Output already exists; preserve prior trials");
  const bytes = readFileSync(input);
  const frozen: AgenticTrace = JSON.parse(bytes.toString()).trace;
  evaluateAgenticTrace(frozen); // Validate trace and bounded dates before a paid call.
  const upstream = frozen.steps.slice(0, 4);
  if (
    upstream.map((s) => s.step).join() !==
      "orchestrator,hotels,activities,dining" ||
    upstream.some((s) => s.fallbacks.length || !s.output)
  )
    throw new Error("Requires complete non-fallback upstream outputs");
  if (
    upstream.slice(1).some((s) => !Array.isArray(s.output) || !s.output.length)
  )
    throw new Error("Requires nonempty frozen inventories");
  process.env.AI_GATEWAY_API_KEY = key;
  for (const name of [
    "VIATOR_API_KEY",
    "GETYOURGUIDE_API_KEY",
    "TRIPADVISOR_API_KEY",
    "TAVILY_API_KEY",
    "DUFFEL_API_TOKEN",
    "LITEAPI_API_KEY",
    "GOOGLE_PLACES_API_KEY",
  ])
    delete process.env[name];
  process.env.VIATOR_CONTENT_ENABLED = "false";
  const structuredSchedule = process.argv.includes("--structured-schedule");
  const explicitDailyBudget = process.argv.includes("--explicit-daily-budget");
  const compiledNarrated = process.argv.includes("--compiled-narrated");
  if (
    compiledNarrated &&
    (!["low", "minimal"].includes(thinking) ||
      structuredSchedule ||
      explicitDailyBudget)
  )
    throw new Error(
      "Compiled narration requires low or minimal thinking and no legacy schedule flags",
    );
  if (compiledNarrated)
    process.env.FAROWAY_SCHEDULE_EXPERIMENT = "compiled-narrated-v1";
  else delete process.env.FAROWAY_SCHEDULE_EXPERIMENT;
  if (compiledNarrated) {
    const { compiledScheduleExperimentEnabled } =
      await import("../lib/search/staging-schedule-experiment");
    if (
      !compiledScheduleExperimentEnabled({
        ...process.env,
        PLANNING_THINKING_AGGREGATOR: thinking,
      })
    )
      throw new Error(
        "Compiled narration requires the isolated staging environment",
      );
  }
  const settings = {
    PLANNING_MODEL_AGGREGATOR: "google/gemini-3-flash",
    PLANNING_THINKING_AGGREGATOR: thinking,
  };
  replacePlanningStepEnv(settings);
  const { runAggregatorAgent } =
    await import("../lib/search/agents/aggregator");
  const root = resolve(import.meta.dirname, "../../..");
  const hash = createHash("sha256");
  for (const file of [
    "apps/web/scripts/aggregator-replay-live.ts",
    "apps/web/lib/search/agents/aggregator.ts",
    "apps/web/lib/search/staging-schedule-experiment.ts",
    "apps/web/lib/search/reviewed-dining-options.ts",
    "apps/web/lib/search/dining-coverage.ts",
    "scripts/fixtures/reviewed-dining-options.json",
    "apps/web/lib/search/narration-prompt.ts",
    "apps/web/lib/search/schedule-narration.ts",
    "apps/web/lib/search/schedule-compiler.ts",
    "apps/web/lib/search/speculative-event.ts",
    "apps/web/lib/search/traveler-availability.ts",
    "apps/web/lib/search/schedule-timing.ts",
    "scripts/uat/lib/timing-proposal.ts",
    "apps/web/lib/search/meal-boundaries.ts",
    "apps/web/lib/search/highlight-match.ts",
    "apps/web/lib/search/party-suitability.ts",
    "scripts/uat/lib/venue-constraints.ts",
    "scripts/uat/lib/agentic-eval.ts",
    "scripts/uat/lib/day-availability.ts",
    "scripts/fixtures/agentic-venue-constraints.json",
    "apps/web/lib/search/supplied-distance.ts",
    "apps/web/lib/location-coordinates.ts",
    "apps/web/lib/search/bridge.ts",
    "apps/web/lib/search/fallback-itinerary.ts",
    "apps/web/lib/search/hotel-policy-screen.ts",
    "scripts/uat/lib/hotel-constraints.ts",
    "scripts/fixtures/agentic-hotel-constraints.json",
    "apps/web/lib/ai/planning-step.ts",
    "apps/web/lib/ai/sdk.ts",
    "apps/web/lib/search/runtime.ts",
    "bun.lock",
  ])
    hash.update(file).update(readFileSync(resolve(root, file)));
  const trace: AgenticTrace = {
    ...frozen,
    runId: randomUUID(),
    configId: [
      "aggregator-replay",
      thinking,
      ...(compiledNarrated ? ["compiled-narrated"] : []),
      ...(structuredSchedule ? ["bounded-schema"] : []),
      ...(explicitDailyBudget ? ["daily-budget"] : []),
    ].join("-"),
    startedAt: new Date().toISOString(),
    settings: {
      ...settings,
      compiledNarrated: String(compiledNarrated),
      structuredSchedule: String(structuredSchedule),
      explicitDailyBudget: String(explicitDailyBudget),
    },
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
    steps: upstream.map((s) => ({ ...s, latencyMs: 0, usage: [] })),
    mappedItinerary: undefined,
  };
  const provenance = {
    kind: "aggregator-only-replay",
    frozenInputSha256: createHash("sha256").update(bytes).digest("hex"),
    frozenSource: frozen.source,
    upstreamReused: true,
    applicationLatencyMeasured: false,
  };
  const usages: PlanningUsageRecord[] = [];
  const fallbacks: PlanningFallbackRecord[] = [];
  const save = () => {
    mkdirSync(dirname(resolve(out)), { recursive: true, mode: 0o700 });
    writeFileSync(
      out + ".tmp",
      JSON.stringify(
        { trace, provenance, evaluation: evaluateAgenticTrace(trace) },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    renameSync(out + ".tmp", out);
  };
  save();
  const stopUsage = onPlanningUsage((r) => {
    if (r.step === "aggregator") usages.push(r);
  });
  const stopFallback = onPlanningFallback((r) => {
    if (r.step === "aggregator") fallbacks.push(r);
  });
  const started = Date.now();
  let output: Awaited<ReturnType<typeof runAggregatorAgent>> | undefined;
  try {
    output = await runAggregatorAgent(
      upstream[0].output as SearchPlan,
      upstream[1].output as HotelResult[],
      upstream[2].output as ActivityResult[],
      upstream[3].output as DiningResult[],
      [],
      { structuredSchedule, explicitDailyBudget },
    );
    trace.mappedItinerary = mapSearchResultsToItinerary(
      {
        searchId: trace.runId,
        hotels: upstream[1].output as HotelResult[],
        activities: upstream[2].output as ActivityResult[],
        dining: upstream[3].output as DiningResult[],
        transport: [],
        itinerary: output.days,
      },
      output.topHotel,
    );
  } finally {
    stopUsage();
    stopFallback();
    trace.steps.push({
      step: "aggregator",
      output,
      latencyMs: Date.now() - started,
      usage: usages,
      fallbacks,
    });
    save();
  }
  const usage = sumPlanningUsage(usages);
  const known =
    usage && usage.inputTokens != null && usage.outputTokens != null;
  console.log(
    JSON.stringify({
      provenance,
      evaluation: evaluateAgenticTrace(trace),
      estimatedReplayUsd: known ? estimateUsageUsd(usage.model, usage) : null,
    }),
  );
  if (!known) {
    console.error(
      "Billing unknown: reconcile gateway budget before another live call",
    );
    process.exitCode = 3;
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Replay failed");
  process.exitCode = 1;
});
