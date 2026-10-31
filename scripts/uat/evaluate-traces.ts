import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateAgenticTrace, type AgenticTrace } from "./lib/agentic-eval";
import {
  evaluateVenueConstraints,
  type VenueConstraint,
} from "./lib/venue-constraints";

// Offline replay: never imports agents or makes network requests.
const directory = process.argv[2];
if (!directory)
  throw new Error(
    "Usage: bun scripts/uat/evaluate-traces.ts <trace-directory>",
  );
const files = readdirSync(directory)
  .filter((file) => file.endsWith(".json"))
  .sort();
if (!files.length)
  throw new Error("No trace files found; an empty suite cannot pass");
const facts: VenueConstraint[] = process.argv[3]
  ? JSON.parse(readFileSync(process.argv[3], "utf8"))
  : [];
const rows = files.map((file) => {
  const { trace } = JSON.parse(
    readFileSync(resolve(directory, file), "utf8"),
  ) as { trace: AgenticTrace };
  const evaluation = evaluateAgenticTrace(trace);
  return {
    file,
    configId: trace.configId,
    briefId: trace.brief.id,
    runId: trace.runId,
    ...evaluation,
    venueConstraints: evaluateVenueConstraints(trace, facts),
  };
});
console.log(
  JSON.stringify(
    {
      mode: "offline-agent-trace-replay",
      count: rows.length,
      contractPassCount: rows.filter((row) => row.contractPass).length,
      travelerUsefulnessMeasured: false,
      venueReviewRequiredCount: rows.filter(
        (row) => row.venueConstraints.findings.length > 0,
      ).length,
      rows,
    },
    null,
    2,
  ),
);
if (
  rows.some(
    (row) => !row.contractPass || row.venueConstraints.findings.length > 0,
  )
)
  process.exitCode = 1;
