import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  renameSync,
  readdirSync,
} from "node:fs";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  evaluateAgenticTrace,
  type AgenticTrace,
} from "../../../scripts/uat/lib/agentic-eval";
import {
  DEVELOPMENT_BRIEFS,
  HOLDOUT_BRIEFS,
} from "../../../scripts/uat/lib/eval-briefs";
import { UAT_BRIEFS } from "../../../scripts/uat/lib/briefs";
import { mapSearchResultsToItinerary } from "../lib/search/bridge";
import {
  onPlanningFallback,
  onPlanningUsage,
  planningModel,
  replacePlanningStepEnv,
  sumPlanningUsage,
  type PlanningFallbackRecord,
  type PlanningUsageRecord,
} from "../lib/ai/planning-step";
import type { SearchInput } from "../lib/search/types";
import {
  runModelComparison,
  MODEL_COMPARE_CONFIGS,
  type CompareStep,
  type StepExecution,
} from "../../../scripts/uat/lib/model-compare";
import type { UatBrief } from "../../../scripts/uat/lib/briefs";
import { assertStagingTarget } from "../../../scripts/uat/lib/staging-project";

const VENDOR_ENV = [
  "VIATOR_API_KEY",
  "GETYOURGUIDE_API_KEY",
  "TRIPADVISOR_API_KEY",
  "TAVILY_API_KEY",
  "DUFFEL_API_TOKEN",
  "LITEAPI_API_KEY",
  "GOOGLE_PLACES_API_KEY",
];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function briefInput(brief: UatBrief): SearchInput {
  return {
    destination: brief.destination,
    startDate: brief.startDate,
    endDate: brief.endDate,
    travelers: brief.travelers,
    adults: brief.adults,
    children: brief.children,
    interests: brief.interests,
    budget: brief.budget,
    vibes: brief.vibes,
    travelerType: brief.travelerType,
    dietaryRestrictions: brief.dietaryRestrictions,
    mobilityNeeds: brief.mobilityNeeds,
    requirements: brief.requirements
      ? ({
          allergies: brief.requirements.allergies,
          dietaryPreferences: brief.requirements.dietaryPreferences,
          accessibility: brief.requirements.accessibility,
          mobilityNotes: brief.requirements.mobilityNotes ?? "",
        } as SearchInput["requirements"])
      : undefined,
    flightProvider: "none",
  };
}

async function main() {
  if (!process.argv.includes("--live"))
    throw new Error("Live model calls require --live");
  const supabaseUrl = arg("--supabase-url");
  const projectRef = process.env.FAROWAY_STAGING_SUPABASE_PROJECT_REF;
  assertStagingTarget({ supabaseUrl, projectRef });
  const key = process.env.FAROWAY_STAGING_AI_GATEWAY_KEY?.trim();
  if (!key) {
    console.error("Refusing to run: FAROWAY_STAGING_AI_GATEWAY_KEY is not set");
    process.exit(2);
  }
  process.env.AI_GATEWAY_API_KEY = key;
  for (const name of VENDOR_ENV) delete process.env[name];
  process.env.VIATOR_CONTENT_ENABLED = "false";
  process.env.VIATOR_SANDBOX = "false";
  process.env.LITEAPI_SANDBOX_ENABLED = "false";
  process.env.LITEAPI_FLIGHTS_SANDBOX_ENABLED = "false";

  const [{ runOrchestratorAgent }, hotels, activities, dining, aggregator] =
    await Promise.all([
      import("../lib/search/agents/orchestrator"),
      import("../lib/search/agents/hotels"),
      import("../lib/search/agents/activities"),
      import("../lib/search/agents/dining"),
      import("../lib/search/agents/aggregator"),
    ]);

  const select = <T extends { id: string }>(items: T[], flag: string): T[] => {
    const ids = arg(flag)?.split(",");
    if (!ids) return items;
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !items.some((item) => item.id === id))
    )
      throw new Error(`Invalid ${flag} selection`);
    return ids.map((id) => items.find((item) => item.id === id)!);
  };
  const compiledNarrated = process.argv.includes("--compiled-narrated");
  const upstreamThinking = arg("--upstream-thinking") ?? "low";
  if (
    !["low", "minimal"].includes(upstreamThinking) ||
    (arg("--upstream-thinking") && !compiledNarrated)
  )
    throw new Error(
      "--upstream-thinking requires compiled narration and low or minimal",
    );
  const selectedConfigs = select(MODEL_COMPARE_CONFIGS, "--configs");
  if (
    compiledNarrated &&
    (selectedConfigs.length !== 1 || selectedConfigs[0].id !== "flash-low")
  )
    throw new Error("Compiled candidate requires --configs flash-low");
  const configs = compiledNarrated
    ? selectedConfigs.map((config) => ({
        ...config,
        id:
          upstreamThinking === "minimal"
            ? "compiled-upstream-minimal"
            : "compiled-minimal",
        label: `Compiled schedule with minimal narration and ${upstreamThinking}-thinking upstream agents`,
        env: {
          ...config.env,
          PLANNING_THINKING_ORCHESTRATOR: upstreamThinking,
          PLANNING_THINKING_HOTELS: upstreamThinking,
          PLANNING_THINKING_ACTIVITIES: upstreamThinking,
          PLANNING_THINKING_DINING: upstreamThinking,
          PLANNING_THINKING_AGGREGATOR: "minimal",
        },
      }))
    : selectedConfigs;
  if (compiledNarrated) {
    process.env.FAROWAY_SCHEDULE_EXPERIMENT = "compiled-narrated-v1";
    const { compiledScheduleExperimentEnabled } =
      await import("../lib/search/staging-schedule-experiment");
    if (
      !compiledScheduleExperimentEnabled({ ...process.env, ...configs[0].env })
    )
      throw new Error(
        "Compiled candidate requires the isolated staging environment",
      );
  } else delete process.env.FAROWAY_SCHEDULE_EXPERIMENT;
  const suite = arg("--suite") ?? "uat";
  if (!["uat", "development", "holdout"].includes(suite))
    throw new Error("Invalid --suite");
  const briefs = select(
    suite === "development"
      ? DEVELOPMENT_BRIEFS
      : suite === "holdout"
        ? HOLDOUT_BRIEFS
        : UAT_BRIEFS,
    "--briefs",
  );
  const capUsd = Number(arg("--cap-usd") ?? "20");
  const root = resolve(import.meta.dirname, "../../..");
  const runId = randomUUID();
  const traceDir = resolve(
    arg("--trace-dir") ?? resolve(root, "artifacts/uat/traces", runId),
  );
  mkdirSync(traceDir, { recursive: true, mode: 0o700 });
  if (readdirSync(traceDir).length)
    throw new Error("Trace directory must be empty; preserve prior trials");
  const sourceFiles = [
    ...["orchestrator", "hotels", "activities", "dining", "aggregator"].map(
      (name) => `apps/web/lib/search/agents/${name}.ts`,
    ),
    "apps/web/scripts/model-compare-live.ts",
    "apps/web/lib/search/staging-schedule-experiment.ts",
    "apps/web/lib/search/schedule-compiler.ts",
    "apps/web/lib/search/meal-boundaries.ts",
    "apps/web/lib/search/schedule-narration.ts",
    "apps/web/lib/search/narration-prompt.ts",
    "apps/web/lib/search/highlight-match.ts",
    "apps/web/lib/search/party-suitability.ts",
    "scripts/uat/lib/venue-constraints.ts",
    "scripts/fixtures/agentic-venue-constraints.json",
    "apps/web/lib/search/bridge.ts",
    "apps/web/lib/search/supplied-distance.ts",
    "apps/web/lib/location-coordinates.ts",
    "apps/web/lib/search/fallback-itinerary.ts",
    "apps/web/lib/ai/planning-step.ts",
    "apps/web/lib/ai/sdk.ts",
    "apps/web/lib/ai/planning-disclosure.ts",
    "scripts/uat/lib/briefs.ts",
    "scripts/uat/lib/eval-briefs.ts",
    "bun.lock",
  ];
  const hash = createHash("sha256");
  for (const file of sourceFiles) {
    hash.update(file);
    hash.update(readFileSync(resolve(root, file)));
  }
  const source = {
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
  };
  let trace: AgenticTrace;
  const saveTrace = () => {
    const file = resolve(traceDir, `${trace.configId}--${trace.brief.id}.json`);
    writeFileSync(
      file + ".tmp",
      JSON.stringify(
        { trace, evaluation: evaluateAgenticTrace(trace) },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    renameSync(file + ".tmp", file);
  };
  console.error(`Trace directory: ${traceDir}`);

  let plan: Awaited<ReturnType<typeof runOrchestratorAgent>> | undefined;
  let hotelResults: Awaited<ReturnType<typeof hotels.runHotelsAgent>> = [];
  let activityResults: Awaited<
    ReturnType<typeof activities.runActivitiesAgent>
  > = [];
  let diningResults: Awaited<ReturnType<typeof dining.runDiningAgent>> = [];

  const report = await runModelComparison({
    mode: "live",
    configs,
    briefs,
    capUsd,
    target: { supabaseUrl, projectRef },
    executeStep: async ({ config, brief, step }) => {
      replacePlanningStepEnv(config.env);
      if (step === "orchestrator") {
        plan = undefined;
        hotelResults = [];
        activityResults = [];
        diningResults = [];
        trace = {
          version: 1,
          runId,
          configId: config.id,
          brief,
          source,
          startedAt: new Date().toISOString(),
          settings: {
            ...config.env,
            ...(compiledNarrated
              ? { FAROWAY_SCHEDULE_EXPERIMENT: "compiled-narrated-v1" }
              : {}),
          },
          steps: [],
        };
        saveTrace();
      }
      const fallbacks: PlanningFallbackRecord[] = [];
      const usages: PlanningUsageRecord[] = [];
      const stopFallback = onPlanningFallback((record) => {
        if (record.step === step) fallbacks.push(record);
      });
      const stopUsage = onPlanningUsage((record) => {
        if (record.step === step) usages.push(record);
      });
      const started = Date.now();
      const notes: string[] = [];
      let output: unknown;
      try {
        if (step === "orchestrator") {
          plan = await runOrchestratorAgent(briefInput(brief));
          output = plan;
        } else if (!plan) {
          throw new Error("orchestrator did not produce a plan");
        } else if (step === "hotels") {
          hotelResults = await hotels.runHotelsAgent(plan);
          output = hotelResults;
          const priced = hotelResults.filter(
            (hotel) => hotel.pricePerNight != null,
          );
          notes.push(
            priced.length ? "hotel prices present" : "hotel prices omitted",
          );
        } else if (step === "activities") {
          activityResults = await activities.runActivitiesAgent(plan);
          output = activityResults;
        } else if (step === "dining") {
          diningResults = await dining.runDiningAgent(plan);
          output = diningResults;
          const links = diningResults.filter((item) => item.reservationUrl);
          notes.push(
            links.length
              ? `${links.length} reservation URLs kept`
              : "no reservation URLs",
          );
        } else if (step === "aggregator") {
          const aggregated = await aggregator.runAggregatorAgent(
            plan,
            hotelResults,
            activityResults,
            diningResults,
            [],
          );
          output = aggregated;
          trace.mappedItinerary = mapSearchResultsToItinerary(
            {
              searchId: runId,
              hotels: hotelResults,
              activities: activityResults,
              dining: diningResults,
              transport: [],
              itinerary: aggregated.days,
            },
            aggregated.topHotel,
          );
          notes.push(`${aggregated.days.length} days`);
        }
      } finally {
        stopFallback();
        stopUsage();
        trace.steps.push({
          step,
          output,
          latencyMs: Date.now() - started,
          usage: usages,
          fallbacks,
        });
        saveTrace();
      }
      const usage = sumPlanningUsage(usages);
      const execution: StepExecution = {
        model: usage?.model ?? planningModel(step as CompareStep),
        thinkingLevel: usage?.thinkingLevel ?? "high",
        latencyMs: Date.now() - started,
        usage: {
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          reasoningTokens: usage?.reasoningTokens,
          totalTokens: usage?.totalTokens,
        },
        notes,
        ...(fallbacks[0]
          ? {
              fallback: {
                reason: fallbacks[0].reason,
                outcome: fallbacks[0].outcome,
              },
            }
          : {}),
      };
      return execution;
    },
  });

  const out = arg("--out");
  if (out) {
    mkdirSync(resolve(out, ".."), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2), { mode: 0o600 });
  }
  console.log(`FAROWAY_MODEL_COMPARE_JSON:${JSON.stringify(report)}`);
  if (report.aborted) process.exitCode = 3;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
