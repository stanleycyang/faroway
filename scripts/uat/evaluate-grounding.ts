import { readFileSync } from "node:fs";
import { auditGroundingEvidence } from "./lib/grounding-evidence";
import facts from "../fixtures/agentic-venue-constraints.json";
const [receiptPath, pagesPath, date] = process.argv.slice(2);
if (!receiptPath || !pagesPath || !date)
  throw new Error(
    "Usage: evaluate-grounding.ts RECEIPT RETRIEVED_PAGES YYYY-MM-DD",
  );
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
if (receipt.status !== "completed" || !Array.isArray(receipt.extracted?.venues))
  throw new Error("Completed structured extraction required");
const pages = JSON.parse(readFileSync(pagesPath, "utf8"));
const result = auditGroundingEvidence(
  receipt.extracted.venues,
  Object.fromEntries(facts.map((f) => [f.id, f.sourceUrl])),
  pages,
  date,
);
console.log(JSON.stringify(result, null, 2));
if (result.results.some((r) => !r.evidenceLinked)) process.exitCode = 1;
