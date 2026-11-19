import { repairActivityAvailability } from "../../../apps/web/lib/search/activity-availability-repair";
import {
  assessOrdinaryHoursEvidence,
  availabilityCandidateSha256,
  type AdjudicatedHoursEvidence,
} from "./activity-hours-evidence";

/** Offline bridge only. Receipts must already have been independently reviewed;
 * retrieval/model output cannot establish that review. No source fetching occurs.
 */
export async function repairWithReviewedHours(
  input: Parameters<typeof repairActivityAvailability>[0],
  evidence: readonly AdjudicatedHoursEvidence[],
  asOf: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(asOf) ||
    !Number.isFinite(Date.parse(asOf)) ||
    new Date(asOf).toISOString().slice(0, 10) !== asOf ||
    !Array.isArray(evidence) ||
    evidence.length > 144 ||
    evidence.some((item) => !item || typeof item.candidateSha256 !== "string")
  )
    throw Error(
      "Valid review date and at most 144 candidate-bound receipts required",
    );
  return repairActivityAvailability(input, async (requests, signal) => {
    return requests.map((request) => {
      if (signal.aborted) throw Error("Review replay aborted");
      const hash = availabilityCandidateSha256(request);
      return assessOrdinaryHoursEvidence(
        request,
        evidence.filter((receipt) => receipt.candidateSha256 === hash),
        asOf,
      );
    });
  });
}
