/** Offline replay only; never mutates the app, fetches sources or calls AI. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { evaluateAgenticTrace, type AgenticTrace } from "./lib/agentic-eval";
import { repairWithReviewedHours } from "./lib/reviewed-availability-repair";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
} from "../../packages/types/src";

const [tracePath, evidencePath, asOf, output] = process.argv.slice(2);
if (!tracePath || !evidencePath || !asOf || !output || existsSync(output))
  throw Error(
    "Usage: repair-reviewed-availability.ts TRACE_RECEIPT REVIEWED_EVIDENCE YYYY-MM-DD NEW_OUTPUT",
  );
const traceBytes = readFileSync(tracePath),
  evidenceBytes = readFileSync(evidencePath);
const receipt = JSON.parse(traceBytes.toString()) as {
  trace: AgenticTrace;
  status?: string;
};
const before = evaluateAgenticTrace(receipt.trace);
if (!before.contractPass || (receipt.status && receipt.status !== "completed"))
  throw Error("Completed trace with intact structural contracts required");
const step = (name: string) =>
  receipt.trace.steps.find((item) => item.step === name)!.output;
const result = await repairWithReviewedHours(
  {
    plan: step("orchestrator") as SearchPlan,
    activities: step("activities") as ActivityResult[],
    dining: step("dining") as DiningResult[],
  },
  JSON.parse(evidenceBytes.toString()),
  asOf,
);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const root = resolve(import.meta.dirname, "../..");
const replaySource = {
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
};
writeFileSync(
  output,
  JSON.stringify(
    {
      mode: "offline-reviewed-availability-repair-v1",
      traceSha256: sha(traceBytes),
      evidenceSha256: sha(evidenceBytes),
      asOf,
      traceSource: receipt.trace.source,
      replaySource,
      limitations:
        "Recompiles raw specialist inventory; does not reproduce staging enrichment, locks, hotel selection or original narration. Ordinary-hour checks do not verify tickets, routes, dietary needs or accessibility. No product mutation or paid calls.",
      result,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log(
  JSON.stringify({
    outcome: result.outcome,
    selectedVisits: result.selectedVisits,
    unresolvedDayCount: result.unresolvedDayCount,
    qualityAccepted: false,
  }),
);
process.exitCode =
  result.outcome === "checked" && result.unresolvedDayCount === 0 ? 0 : 2;
