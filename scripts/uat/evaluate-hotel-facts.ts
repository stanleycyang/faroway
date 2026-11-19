/** Regrade saved hotel extraction receipts without making model or network calls. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import facts from "../fixtures/agentic-hotel-extraction.json";
import {
  evaluateHotelFacts,
  type HotelFactClaim,
} from "./lib/hotel-fact-extraction";
import type { RetrievedVenuePage } from "./lib/grounding-evidence";

const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const [pagesPath, ...receiptPaths] = process.argv.slice(2);
if (!pagesPath || !receiptPaths.length)
  throw new Error(
    "Usage: evaluate-hotel-facts.ts PAGES_JSON RECEIPT_JSON [...]",
  );
const pagesBytes = readFileSync(pagesPath);
if (pagesBytes.length > 150000) throw new Error("Oversized source batch");
const pages = JSON.parse(pagesBytes.toString()) as RetrievedVenuePage[];
const reports = receiptPaths.map((path) => {
  const bytes = readFileSync(path);
  if (bytes.length > 150000) throw new Error("Oversized receipt");
  const receipt = JSON.parse(bytes.toString());
  if (
    receipt.status !== "completed" ||
    receipt.provenance?.model !== "google/gemini-3-flash" ||
    receipt.billingKnown !== true ||
    !Number.isFinite(receipt.usage?.inputTokens) ||
    !Number.isFinite(receipt.usage?.outputTokens) ||
    receipt.provenance?.inputSha256 !== hash(pagesBytes) ||
    !Array.isArray(receipt.extracted?.claims)
  )
    throw new Error(
      "Require completed known-usage receipts matching the source batch",
    );
  return {
    receiptSha256: hash(bytes),
    originalBenchmarkSha256: receipt.provenance.benchmarkSha256,
    originalAudit: receipt.audit,
    currentAudit: evaluateHotelFacts(
      receipt.extracted.claims as HotelFactClaim[],
      facts,
      pages,
    ),
    latencyMs: receipt.latencyMs,
    usage: receipt.usage,
    estimatedTokenCostUsd:
      (receipt.usage.inputTokens * 0.5) / 1e6 +
      (receipt.usage.outputTokens * 3) / 1e6,
  };
});
console.log(
  JSON.stringify(
    {
      currentBenchmarkSha256: hash(JSON.stringify(facts)),
      evaluatorSha256: hash(
        readFileSync(
          new URL("./lib/hotel-fact-extraction.ts", import.meta.url),
        ),
      ),
      inputSha256: hash(pagesBytes),
      reports,
      modelCalls: 0,
      productionQualityAccepted: false,
    },
    null,
    2,
  ),
);
