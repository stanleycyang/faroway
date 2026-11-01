/** Offline proposal audit; never writes to the application or calls a model. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { refineFixedVisits } from "./lib/fixed-visit-refinement";
import { evaluateAgenticTrace, type AgenticTrace } from "./lib/agentic-eval";
import { venueConstraintsForDate } from "./lib/venue-constraints";
import facts from "../fixtures/agentic-venue-constraints.json";
import type { SuggestedDay } from "../../packages/types/src";

const [manifest, output] = process.argv.slice(2);
if (!manifest || !output || existsSync(output))
  throw new Error(
    "Usage: refine-fixed-visits.ts INPUT_PATH_ARRAY_JSON NEW_OUTPUT",
  );
const manifestBytes = readFileSync(manifest);
const files: unknown = JSON.parse(manifestBytes.toString());
if (
  !Array.isArray(files) ||
  !files.length ||
  files.some((file) => typeof file !== "string") ||
  new Set(files).size !== files.length
)
  throw new Error("Nonempty unique input path array required");
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const rows = (files as string[]).map((file) => {
  const bytes = readFileSync(file);
  const receipt = JSON.parse(bytes.toString()) as {
    trace: AgenticTrace;
    status?: string;
  };
  const evaluation = evaluateAgenticTrace(receipt.trace);
  const provenance = {
    file,
    sha256: sha(bytes),
    briefId: receipt.trace.brief.id,
  };
  if (
    !evaluation.contractPass ||
    (receipt.status && receipt.status !== "completed")
  )
    return {
      ...provenance,
      eligible: false,
      failures: evaluation.failures,
      status: receipt.status,
    };
  const days = (
    receipt.trace.steps.find((step) => step.step === "aggregator")!.output as {
      days: SuggestedDay[];
    }
  ).days;
  const names = new Map(
    days.flatMap((day) =>
      [day.morning, day.afternoon, day.evening].flatMap((slot) =>
        slot.activities.map((a) => [a.id, a.name] as const),
      ),
    ),
  );
  const result = refineFixedVisits(days, {
    blocked: (id, date) =>
      venueConstraintsForDate(
        receipt.trace.brief.destination,
        names.get(id)!,
        date,
        facts,
      ).length > 0,
  });
  return { ...provenance, eligible: true, result };
});
const root = resolve(import.meta.dirname, "../..");
const dependencies = [
  "scripts/uat/refine-fixed-visits.ts",
  "scripts/uat/lib/fixed-visit-refinement.ts",
  "scripts/uat/lib/route-eval.ts",
  "apps/web/lib/search/supplied-distance.ts",
  "apps/web/lib/location-coordinates.ts",
  "scripts/uat/lib/agentic-eval.ts",
  "packages/types/src/day-timing.ts",
  "scripts/uat/lib/briefs.ts",
  "scripts/uat/lib/venue-constraints.ts",
  "scripts/fixtures/agentic-venue-constraints.json",
];
writeFileSync(
  output,
  JSON.stringify(
    {
      modelCalls: 0,
      qualityAccepted: false,
      manifestSha256: sha(manifestBytes),
      implementation: Object.fromEntries(
        dependencies.map((file) => [
          file,
          sha(readFileSync(resolve(root, file))),
        ]),
      ),
      limitations:
        "Fixed selected visits and meals; unverified coordinates and partial reviewed closure exclusions. No hotel returns, actual routes, booking times, daily theme validation or app mutation. No locks are present in these development traces; production integration would need authoritative lock and booking constraints.",
      rows,
    },
    null,
    2,
  ),
  { flag: "wx", mode: 0o600 },
);
console.log(
  JSON.stringify({
    count: rows.length,
    eligible: rows.filter((row) => row.eligible).length,
    changed: rows.filter((row) => "result" in row && row.result.moves.length)
      .length,
    modelCalls: 0,
  }),
);
