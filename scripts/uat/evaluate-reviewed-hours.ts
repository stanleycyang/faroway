import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { evaluateReviewedHours } from "./lib/reviewed-hours-eval";
const [tracePath, reviewsPath, asOf] = process.argv.slice(2);
if (!tracePath || !reviewsPath || !asOf)
  throw Error(
    "Usage: evaluate-reviewed-hours.ts TRACE_RECEIPT REVIEWS YYYY-MM-DD",
  );
const bytes = readFileSync(tracePath);
const receipt = JSON.parse(bytes.toString());
const reviews = JSON.parse(readFileSync(reviewsPath, "utf8"));
if (!Array.isArray(reviews)) throw Error("Review array required");
const result = evaluateReviewedHours(
  receipt.trace,
  createHash("sha256").update(bytes).digest("hex"),
  reviews,
  asOf,
);
console.log(JSON.stringify(result, null, 2));
// Unknown coverage must not masquerade as a successful factual audit.
process.exitCode = result.conflicts ? 1 : result.evidenceComplete ? 0 : 2;
