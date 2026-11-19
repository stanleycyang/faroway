/** Offline receipt replay. No provider imports, network access or trip writes. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  bindDiningReplay,
  prepareDiningReplay,
  validDiningAssessment,
} from "./lib/dining-replay";
import {
  auditDiningDiscovery,
  parseDiningDiscovery,
  validatePublicDiningBrief,
  expandCompactDiningDiscovery,
} from "./lib/dining-discovery";

const isolateInvalidAssessments = process.argv.includes(
  "--isolate-invalid-assessments",
);
const files = process.argv
  .slice(2)
  .filter((arg) => arg !== "--isolate-invalid-assessments");
if (!files.length) throw Error("Pass one or more live discovery receipt files");
const rows = files.map((file) => {
  const bytes = readFileSync(file);
  const receipt = JSON.parse(bytes.toString());
  const brief = validatePublicDiningBrief(receipt.brief);
  if (
    receipt.status !== "completed" ||
    !Array.isArray(receipt.retrievalResults)
  )
    throw Error(`${file}: incomplete receipt cannot count as a completed run`);
  const selection = parseDiningDiscovery(receipt.text);
  const replay =
    receipt.provenance?.mode === "frozen-source-selection"
      ? prepareDiningReplay(
          receipt,
          receipt.provenance.screenSources === true,
          receipt.provenance.indexedMealEvidence === true,
          receipt.provenance.screenArea === true,
        )
      : undefined;
  const isolate =
    isolateInvalidAssessments ||
    receipt.provenance?.isolateInvalidAssessments === true;
  const audit = auditDiningDiscovery(
    replay
      ? bindDiningReplay(selection, replay, isolate)
      : receipt.provenance?.compactEvidence === true
        ? expandCompactDiningDiscovery(selection)
        : selection,
    receipt.retrievalResults,
    brief,
  );
  const cost = receipt.providerMetadata?.gateway?.cost;
  const costUsd =
    typeof cost === "string" || typeof cost === "number" ? Number(cost) : NaN;
  return {
    file,
    isolateInvalidAssessments: isolate,
    invalidAssessmentSources:
      replay &&
      replay.screenSources &&
      selection &&
      typeof selection === "object" &&
      "screening" in selection &&
      Array.isArray(selection.screening)
        ? selection.screening
            .filter((s) => !validDiningAssessment(s, replay))
            .map((s) => s?.sourceId ?? null)
        : [],
    receiptSha256: createHash("sha256").update(bytes).digest("hex"),
    brief,
    requested: brief.maxCandidates,
    retrievedSources: audit.sources.length,
    retained: audit.options.length,
    rejected: audit.rejected,
    shapeValid: audit.shapeValid,
    linkedMealQuotes: audit.options.filter((o) => o.mealQuote !== null).length,
    latencyMs: receipt.latencyMs,
    costUsd: Number.isFinite(costUsd) && costUsd >= 0 ? costUsd : null,
    options: audit.options.map((o) => ({
      name: o.name,
      address: o.address,
      url: o.sourceUrl,
      mealQuote: o.mealQuote,
    })),
  };
});
const totalRequested = rows.reduce((n, r) => n + r.requested, 0);
const totalRetained = rows.reduce((n, r) => n + r.retained, 0);
console.log(
  JSON.stringify(
    {
      mode: "offline-dining-discovery-replay",
      isolateInvalidAssessments,
      runs: rows.length,
      totalRequested,
      totalRetained,
      copyEvidenceCoverage: totalRetained / totalRequested,
      fullCoverageRuns: rows.filter((r) => r.retained === r.requested).length,
      knownCostUsd: rows.reduce((n, r) => n + (r.costUsd ?? 0), 0),
      unknownCostRuns: rows.filter((r) => r.costUsd === null).length,
      authorityAndBranchReviewed: false,
      mealSuitabilityReviewed: false,
      travelerUsefulnessMeasured: false,
      rows,
    },
    null,
    2,
  ),
);
