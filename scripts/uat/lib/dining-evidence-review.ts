import { createHash } from "node:crypto";

export interface DiningEvidenceReview {
  receiptSha256: string;
  optionId: string;
  reviewer: string;
  publisher: "corroborated_operator" | "third_party" | "unresolved";
  mealEvidence: "supports_requested_meal" | "insufficient" | "contradicted";
  note: string;
  evidenceUrls: string[];
}

/** Manual evidence labels are separate from extraction checks and are not proof of availability. */
export function reviewDiningEvidence(
  receiptBytes: string,
  optionIds: string[],
  reviews: DiningEvidenceReview[],
) {
  const receiptSha256 = createHash("sha256").update(receiptBytes).digest("hex");
  if (new Set(optionIds).size !== optionIds.length)
    throw Error("Duplicate option IDs");
  const labels = reviews.filter((r) => r.receiptSha256 === receiptSha256);
  if (
    new Set(labels.map((r) => r.optionId)).size !== labels.length ||
    labels.some((r) => !optionIds.includes(r.optionId))
  )
    throw Error("Review labels must uniquely identify options in this receipt");
  for (const r of labels) {
    if (
      !r.reviewer.trim() ||
      !r.note.trim() ||
      !["corroborated_operator", "third_party", "unresolved"].includes(
        r.publisher,
      ) ||
      !["supports_requested_meal", "insufficient", "contradicted"].includes(
        r.mealEvidence,
      ) ||
      !r.evidenceUrls.length ||
      r.evidenceUrls.some((url) => {
        try {
          const u = new URL(url);
          return u.protocol !== "https:" || !!u.username || !!u.password;
        } catch {
          return true;
        }
      })
    )
      throw Error(
        "Evidence review requires valid labels, reviewer, rationale and HTTPS references",
      );
  }
  const rows = optionIds.map((optionId) => {
    const review = labels.find((r) => r.optionId === optionId);
    return {
      optionId,
      review: review ?? null,
      sourceAndMealReviewed:
        review?.publisher === "corroborated_operator" &&
        review.mealEvidence === "supports_requested_meal",
      dateAvailabilityVerified: false,
      schedulingApproved: false,
    };
  });
  return {
    receiptSha256,
    totalOptions: optionIds.length,
    reviewed: labels.length,
    missingReviews: optionIds.length - labels.length,
    unresolvedPublishers: labels.filter((r) => r.publisher === "unresolved")
      .length,
    thirdPartySources: labels.filter((r) => r.publisher === "third_party")
      .length,
    insufficientMealEvidence: labels.filter(
      (r) => r.mealEvidence !== "supports_requested_meal",
    ).length,
    sourceAndMealReviewed: rows.filter((r) => r.sourceAndMealReviewed).length,
    rows,
  };
}
