import { scheduleNarrationPrompt } from "../lib/search/narration-prompt";
/** Bounded narration experiment over a frozen compiler trace; no production caller. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createGateway, generateObject } from "../lib/ai/sdk";
import { usageFromModelError } from "../lib/ai/planning-step";
import { assertStagingTarget } from "../../../scripts/uat/lib/staging-project";
import {
  evaluateAgenticTrace,
  type AgenticTrace,
} from "../../../scripts/uat/lib/agentic-eval";
import {
  applyScheduleNarration,
  type DayNarration,
} from "../lib/search/schedule-narration";
import { mapSearchResultsToItinerary } from "../lib/search/bridge";
import type {
  SuggestedDay,
  SearchPlan,
  HotelResult,
  ActivityResult,
  DiningResult,
} from "../lib/search/types";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
async function main() {
  if (!process.argv.includes("--live"))
    throw new Error("Explicit --live required");
  const thinkingLevel = arg("--thinking") ?? "low";
  if (thinkingLevel !== "low" && thinkingLevel !== "minimal")
    throw new Error("Narration thinking must be low or minimal");
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
  const bytes = readFileSync(input),
    original = JSON.parse(bytes.toString()) as {
      trace: AgenticTrace;
      provenance?: { kind: string };
    };
  if (
    original.provenance?.kind !== "offline-compiled-schedule" ||
    !evaluateAgenticTrace(original.trace).contractPass
  )
    throw new Error("Passing frozen compiler trace required");
  const trace = structuredClone(original.trace);
  const itinerary = trace.steps[4].output as {
    days: SuggestedDay[];
    topHotel: HotelResult | null;
  };
  const plan = trace.steps[0].output as SearchPlan;
  if (!itinerary.days.length || itinerary.days.length > 7)
    throw new Error("Pilot is bounded to 1–7 days");
  const prompt = scheduleNarrationPrompt(plan, itinerary.days);
  const root = resolve(import.meta.dirname, "../../..");
  const sourceHash = createHash("sha256");
  for (const file of [
    "apps/web/scripts/narration-live.ts",
    "apps/web/lib/search/schedule-narration.ts",
    "apps/web/lib/search/narration-prompt.ts",
    "apps/web/lib/search/bridge.ts",
    "apps/web/lib/ai/sdk.ts",
    "apps/web/lib/ai/planning-step.ts",
    "bun.lock",
  ])
    sourceHash.update(file).update(readFileSync(resolve(root, file)));
  trace.runId = randomUUID();
  trace.startedAt = new Date().toISOString();
  trace.source = {
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
    filesSha256: sourceHash.digest("hex"),
  };
  trace.settings = { model: "google/gemini-3-flash", thinkingLevel };
  const provenance = {
    kind: "fixed-schedule-narration",
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
    promptSha256: createHash("sha256").update(prompt).digest("hex"),
    model: "google/gemini-3-flash",
    thinkingLevel,
    referenceFormat: "date-slot-position-v1",
    modelCallsMaximum: 1,
    semanticReviewRequired: true,
    qualityAccepted: false,
    upstreamGenerationCostExcluded: true,
  };
  mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
  writeFileSync(out, JSON.stringify({ status: "started", provenance }), {
    flag: "wx",
    mode: 0o600,
  });
  const started = Date.now();
  let usage: unknown;
  let narration: DayNarration[] | undefined;
  try {
    const result = await generateObject<{ days: DayNarration[] }>({
      model: createGateway({ apiKey: key })(provenance.model),
      providerOptions: { google: { thinkingConfig: { thinkingLevel } } },
      schema: z.object({
        days: z
          .array(
            z.object({
              date: z.string(),
              title: z.string().min(1).max(100),
              summary: z.string().min(1).max(600),
              activityIds: z.array(z.string()),
            }),
          )
          .length(itinerary.days.length),
      }),
      prompt,
      maxOutputTokens: 2000,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(30000),
    });
    usage = result.usage;
    // Private experiment evidence: retain rejected references for diagnosis.
    narration = result.object.days;
    const days = applyScheduleNarration(itinerary.days, result.object.days);
    trace.configId = `fixed-schedule-narration-compact-${thinkingLevel}`;
    trace.steps = trace.steps.map((step) => ({
      ...step,
      latencyMs: 0,
      usage: [],
    }));
    trace.steps[4] = {
      step: "aggregator",
      output: { ...itinerary, days },
      latencyMs: Date.now() - started,
      usage: result.usage ? [result.usage] : [],
      fallbacks: [],
    };
    trace.mappedItinerary = mapSearchResultsToItinerary(
      {
        searchId: trace.runId,
        hotels: trace.steps[1].output as HotelResult[],
        activities: trace.steps[2].output as ActivityResult[],
        dining: trace.steps[3].output as DiningResult[],
        transport: [],
        itinerary: days,
      },
      itinerary.topHotel,
    );
    const evaluation = evaluateAgenticTrace(trace);
    writeFileSync(
      out,
      JSON.stringify(
        {
          status: "completed",
          provenance,
          trace,
          evaluation,
          usage,
          narration,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        latencyMs: trace.steps[4].latencyMs,
        usage,
        contractPass: evaluation.contractPass,
      }),
    );
    if (result.usage?.inputTokens == null || result.usage?.outputTokens == null)
      process.exitCode = 3;
  } catch (error) {
    usage ??= usageFromModelError(error);
    const failure = error as { text?: unknown; finishReason?: unknown } | null;
    writeFileSync(
      out,
      JSON.stringify({
        status: "failed",
        provenance,
        usage,
        narration,
        rejectedText:
          typeof failure?.text === "string"
            ? failure.text.slice(0, 20_000)
            : undefined,
        finishReason:
          typeof failure?.finishReason === "string"
            ? failure.finishReason
            : undefined,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : "unknown",
        billing: "Reconcile gateway before another call",
      }),
      { mode: 0o600 },
    );
    process.exitCode = 3;
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Narration failed");
  process.exitCode = 1;
});
