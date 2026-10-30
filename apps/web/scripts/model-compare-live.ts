import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

  let plan: Awaited<ReturnType<typeof runOrchestratorAgent>> | undefined;
  let hotelResults: Awaited<ReturnType<typeof hotels.runHotelsAgent>> = [];
  let activityResults: Awaited<
    ReturnType<typeof activities.runActivitiesAgent>
  > = [];
  let diningResults: Awaited<ReturnType<typeof dining.runDiningAgent>> = [];

  const report = await runModelComparison({
    mode: "live",
    target: { supabaseUrl, projectRef },
    executeStep: async ({ config, brief, step }) => {
      replacePlanningStepEnv(config.env);
      if (step === "orchestrator") {
        plan = undefined;
        hotelResults = [];
        activityResults = [];
        diningResults = [];
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
      try {
        if (step === "orchestrator") {
          plan = await runOrchestratorAgent(briefInput(brief));
        } else if (!plan) {
          throw new Error("orchestrator did not produce a plan");
        } else if (step === "hotels") {
          hotelResults = await hotels.runHotelsAgent(plan);
          const priced = hotelResults.filter(
            (hotel) => hotel.pricePerNight != null,
          );
          notes.push(
            priced.length ? "hotel prices present" : "hotel prices omitted",
          );
        } else if (step === "activities") {
          activityResults = await activities.runActivitiesAgent(plan);
        } else if (step === "dining") {
          diningResults = await dining.runDiningAgent(plan);
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
          notes.push(`${aggregated.days.length} days`);
        }
      } finally {
        stopFallback();
        stopUsage();
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
    writeFileSync(out, JSON.stringify(report, null, 2));
  }
  console.log(`FAROWAY_MODEL_COMPARE_JSON:${JSON.stringify(report)}`);
  if (report.aborted) process.exitCode = 3;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
