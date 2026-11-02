import { test, expect } from "bun:test";
import { createHash } from "node:crypto";
import {
  reviewDiningEvidence,
  type DiningEvidenceReview,
} from "../uat/lib/dining-evidence-review";
const bytes = '{"synthetic":true}';
const label: DiningEvidenceReview = {
  receiptSha256: createHash("sha256").update(bytes).digest("hex"),
  optionId: "one",
  reviewer: "synthetic-test",
  publisher: "corroborated_operator",
  mealEvidence: "supports_requested_meal",
  note: "Synthetic label only",
  evidenceUrls: ["https://operator.example/menu"],
};
test("binds review to original bytes and keeps future availability unknown", () => {
  const result = reviewDiningEvidence(bytes, ["one"], [label]);
  expect(result.sourceAndMealReviewed).toBe(1);
  expect(result.rows[0].schedulingApproved).toBe(false);
  expect(result.rows[0].dateAvailabilityVerified).toBe(false);
  expect(
    reviewDiningEvidence(bytes + " ", ["one"], [label]).missingReviews,
  ).toBe(1);
  expect(
    reviewDiningEvidence(bytes, ["one", "two"], [label]).missingReviews,
  ).toBe(1);
});
test("does not equate copied evidence with operator or meal support", () => {
  for (const change of [
    { publisher: "unresolved" },
    { publisher: "third_party" },
    { mealEvidence: "insufficient" },
    { mealEvidence: "contradicted" },
  ] as const)
    expect(
      reviewDiningEvidence(bytes, ["one"], [{ ...label, ...change }])
        .sourceAndMealReviewed,
    ).toBe(0);
});
test("rejects contradictory, unrelated or unauditable labels", () => {
  expect(() => reviewDiningEvidence(bytes, ["one"], [label, label])).toThrow();
  expect(() => reviewDiningEvidence(bytes, ["other"], [label])).toThrow();
  for (const change of [
    { reviewer: "" },
    { note: "" },
    { evidenceUrls: [] },
    { evidenceUrls: ["javascript:alert(1)"] },
  ])
    expect(() =>
      reviewDiningEvidence(bytes, ["one"], [{ ...label, ...change }]),
    ).toThrow();
});
