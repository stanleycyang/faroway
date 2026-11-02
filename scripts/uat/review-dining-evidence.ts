import { readFileSync } from "node:fs";
import {
  reviewDiningEvidence,
  type DiningEvidenceReview,
} from "./lib/dining-evidence-review";
import {
  auditDiningDiscovery,
  parseDiningDiscovery,
  validatePublicDiningBrief,
  expandCompactDiningDiscovery,
} from "./lib/dining-discovery";
import { prepareDiningReplay, bindDiningReplay } from "./lib/dining-replay";
const [reviewPath, ...paths] = process.argv.slice(2);
if (!reviewPath || !paths.length)
  throw Error("Pass review JSON and original receipt files");
const reviews = JSON.parse(
  readFileSync(reviewPath, "utf8"),
) as DiningEvidenceReview[];
if (!Array.isArray(reviews)) throw Error("Review list required");
const rows = paths.map((file) => {
  const bytes = readFileSync(file, "utf8"),
    receipt = JSON.parse(bytes);
  if (
    receipt.status !== "completed" ||
    !Array.isArray(receipt.retrievalResults)
  )
    throw Error("Completed receipt required");
  const parsed = parseDiningDiscovery(receipt.text);
  const output =
    receipt.provenance?.mode === "frozen-source-selection"
      ? bindDiningReplay(
          parsed,
          prepareDiningReplay(
            receipt,
            receipt.provenance.screenSources === true,
          ),
        )
      : receipt.provenance?.compactEvidence === true
        ? expandCompactDiningDiscovery(parsed)
        : parsed;
  const audit = auditDiningDiscovery(
    output,
    receipt.retrievalResults,
    validatePublicDiningBrief(receipt.brief),
  );
  if (!audit.shapeValid)
    throw Error("Malformed extraction cannot receive evidence approval");
  return {
    file,
    ...reviewDiningEvidence(
      bytes,
      audit.options.map((o) => o.id),
      reviews,
    ),
  };
});
console.log(
  JSON.stringify(
    {
      mode: "manual-dining-evidence-review",
      automaticFactCertification: false,
      rows,
    },
    null,
    2,
  ),
);
if (
  rows.some(
    (r) =>
      !r.totalOptions ||
      r.missingReviews ||
      r.sourceAndMealReviewed !== r.totalOptions,
  )
)
  process.exitCode = 1;
