/** Offline-only regression replay: no model, database, or provider calls. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createFallbackItinerary } from "../lib/search/fallback-itinerary";
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
if (!input || !output || existsSync(output))
  throw new Error("Usage: fallback-replay.ts INPUT_TRACE NEW_OUTPUT");
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
const started = Date.now();
const result = createFallbackItinerary(plan, hotels, activities, dining);
const elapsed = Date.now() - started;
const root = resolve(import.meta.dirname, "../../..");
const hash = createHash("sha256");
for (const file of [
  "apps/web/lib/search/fallback-itinerary.ts",
  "apps/web/lib/search/bridge.ts",
  "apps/web/lib/search/supplied-distance.ts",
  "apps/web/lib/search/fallback-itinerary.ts",
  "scripts/uat/lib/agentic-eval.ts",
  "apps/web/scripts/fallback-replay.ts",
])
  hash.update(file).update(readFileSync(resolve(root, file)));
const trace: AgenticTrace = {
  ...original,
  configId: "offline-fallback-replay",
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
      fallbacks: [
        { reason: "offline_forced_fallback", outcome: "fallback_itinerary" },
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
        kind: "offline-fallback-replay",
        originalInputSha256: createHash("sha256").update(bytes).digest("hex"),
        modelCalls: 0,
      },
      evaluation,
    },
    null,
    2,
  ),
  { mode: 0o600, flag: "wx" },
);
console.log(JSON.stringify({ evaluation, modelCalls: 0 }));
