/** Offline receipt replay. No provider imports, network access or trip writes. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  auditDiningDiscovery,
  parseDiningDiscovery,
  validatePublicDiningBrief,
} from "./lib/dining-discovery";

const files = process.argv.slice(2);
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
  const audit = auditDiningDiscovery(
    parseDiningDiscovery(receipt.text),
    receipt.retrievalResults,
    brief,
  );
  const cost = receipt.providerMetadata?.gateway?.cost;
  const costUsd =
    typeof cost === "string" || typeof cost === "number" ? Number(cost) : NaN;
  return {
    file,
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
