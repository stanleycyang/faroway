/** One hotel call with a frozen orchestrator plan; no other agents or providers run. */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
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
import type { SearchPlan, HotelResult } from "../lib/search/types";

function arg(flag: string) {
  const index = process.argv.indexOf(flag);
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
  const thinking = arg("--thinking");
  if (!input || !out) throw new Error("--input and --out required");
  if (thinking !== "low" && thinking !== "minimal")
    throw new Error("Explicit low or minimal thinking required");
  if (existsSync(out))
    throw new Error("Output already exists; preserve prior trials");
  const bytes = readFileSync(input);
  const parsed = JSON.parse(bytes.toString()) as {
    trace: AgenticTrace;
    status?: string;
  };
  const frozen = parsed.trace;
  if (
    (parsed.status && parsed.status !== "completed") ||
    !evaluateAgenticTrace(frozen).contractPass ||
    frozen.steps.some((s) => s.fallbacks.length)
  )
    throw new Error("Completed passing non-fallback trace required");
  const plan = frozen.steps[0].output as SearchPlan;
  const planJson = JSON.stringify(plan);
  const sha = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");
  process.env.AI_GATEWAY_API_KEY = key;
  // This runner measures raw generation; policy screening has its own offline replay.
  delete process.env.FAROWAY_SCHEDULE_EXPERIMENT;
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
  const settings = {
    PLANNING_MODEL_HOTELS: "google/gemini-3-flash",
    PLANNING_THINKING_HOTELS: thinking,
  };
  replacePlanningStepEnv(settings);
  const { runHotelsAgent } = await import("../lib/search/agents/hotels");
  const root = resolve(import.meta.dirname, "../../..");
  const hash = createHash("sha256");
  for (const file of [
    "apps/web/scripts/hotel-replay-live.ts",
    "apps/web/lib/search/agents/hotels.ts",
    "apps/web/lib/search/staging-schedule-experiment.ts",
    "apps/web/lib/search/hotel-policy-screen.ts",
    "scripts/uat/lib/hotel-constraints.ts",
    "scripts/fixtures/agentic-hotel-constraints.json",
    "apps/web/lib/ai/planning-step.ts",
    "apps/web/lib/ai/planning-disclosure.ts",
    "apps/web/lib/ai/sdk.ts",
    "apps/web/lib/ai/model-cost.ts",
    "apps/web/lib/search/runtime.ts",
    "bun.lock",
  ])
    hash.update(file).update(readFileSync(resolve(root, file)));
  const usageRecords: PlanningUsageRecord[] = [];
  const fallbacks: PlanningFallbackRecord[] = [];
  const report = {
    kind: "hotel-only-frozen-plan-replay",
    status: "running",
    briefId: frozen.brief.id,
    startedAt: new Date().toISOString(),
    settings,
    provenance: {
      frozenInputSha256: sha(bytes),
      planSha256: sha(planJson),
      plan,
      sourceSha256: hash.digest("hex"),
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      upstreamReused: true,
      applicationLatencyMeasured: false,
    },
    latencyMs: 0,
    usageRecords,
    fallbacks,
    estimatedUsd: null as number | null,
    hotels: [] as HotelResult[],
    qualityAccepted: false,
    limitations:
      "Hotel existence, room capacity, availability, access and dietary suitability require independent evidence. Passing output checks is not quality acceptance.",
  };
  mkdirSync(dirname(resolve(out)), { recursive: true, mode: 0o700 });
  const save = (first = false) => {
    writeFileSync(first ? out : out + ".tmp", JSON.stringify(report, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    if (!first) renameSync(out + ".tmp", out);
  };
  save(true);
  const stopUsage = onPlanningUsage((r) => {
    if (r.step === "hotels") {
      usageRecords.push(r);
      save();
    }
  });
  const stopFallback = onPlanningFallback((r) => {
    if (r.step === "hotels") {
      fallbacks.push(r);
      save();
    }
  });
  const started = Date.now();
  try {
    report.hotels = await runHotelsAgent(plan);
    report.status =
      report.hotels.length === 10 && !fallbacks.length
        ? "completed"
        : "failed_output_or_fallback";
    if (JSON.stringify(plan) !== planJson)
      throw new Error("Frozen input was mutated");
  } catch {
    report.status = "failed";
  } finally {
    stopUsage();
    stopFallback();
    report.latencyMs = Date.now() - started;
    const usage = sumPlanningUsage(usageRecords);
    if (usage && usage.inputTokens != null && usage.outputTokens != null)
      report.estimatedUsd = estimateUsageUsd(usage.model, usage);
    else report.status = "billing_unknown";
    save();
  }
  console.log(
    JSON.stringify({
      status: report.status,
      estimatedUsd: report.estimatedUsd,
      latencyMs: report.latencyMs,
      count: report.hotels.length,
    }),
  );
  if (report.status !== "completed")
    process.exitCode = report.status === "billing_unknown" ? 3 : 1;
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Hotel replay failed");
  process.exitCode = 1;
});
