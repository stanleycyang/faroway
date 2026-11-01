import { expect, test } from "bun:test";
import {
  evaluateReviewedHours,
  type HoursReview,
} from "../uat/lib/reviewed-hours-eval";
const hash = "a".repeat(64);
const activity = { id: "museum", name: "Generated title", duration: 120 };
const trace = (slot = "evening", duration = 120) => ({
  steps: [
    {
      step: "aggregator",
      output: {
        days: [
          {
            date: "2027-01-11",
            ...Object.fromEntries(
              ["morning", "afternoon", "evening"].map((s) => [
                s,
                {
                  activities: s === slot ? [{ ...activity, duration }] : [],
                },
              ]),
            ),
          },
        ],
      },
    },
  ],
});
const review: HoursReview = {
  traceSha256: hash,
  activityId: "museum",
  date: "2027-01-11",
  intervals: [[600, 1020]],
  sourceUrl: "https://museum.example/hours",
  sourceSha256: "b".repeat(64),
  observedAt: "2026-11-01",
  reviewAfter: "2026-12-01",
  identityReview:
    "Reviewer bound this exact receipt candidate to the official branch.",
};
const evaluate = (t = trace(), facts = [review]) =>
  evaluateReviewedHours(t, hash, facts, "2026-11-01");
test("detects an evening conflict independently of generated title matching", () => {
  const result = evaluate();
  expect(result.conflicts).toBe(1);
  expect(result.evidenceComplete).toBe(true);
  expect(result.qualityAccepted).toBe(false);
  expect(evaluate(trace("morning")).compatible).toBe(1);
});
test("does not add split windows or treat empty hours as compatible", () => {
  expect(
    evaluate(trace("afternoon"), [
      {
        ...review,
        intervals: [
          [720, 780],
          [900, 960],
        ],
      },
    ]).conflicts,
  ).toBe(1);
  expect(
    evaluate(trace("morning"), [{ ...review, intervals: [] }]).conflicts,
  ).toBe(1);
  expect(evaluate(trace("morning", 121)).conflicts).toBe(1);
});
test("counts missing, stale, ambiguous, wrong-receipt and malformed evidence as unreviewed", () => {
  for (const facts of [
    [],
    [review, review],
    [{ ...review, traceSha256: "c".repeat(64) }],
    [{ ...review, activityId: "other" }],
    [{ ...review, date: "2027-01-12" }],
    [{ ...review, reviewAfter: "2026-10-31" }],
    [{ ...review, sourceSha256: "bad" }],
    [{ ...review, sourceUrl: "https://user:password@museum.example" }],
    [{ ...review, intervals: [[1000, 500]] as Array<[number, number]> }],
  ]) {
    const result = evaluate(trace(), facts);
    expect(result.unreviewed).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(result.evidenceComplete).toBe(false);
  }
  expect(evaluate(trace("morning", 0)).unreviewed).toBe(1);
});
test("rejects incomplete output rather than reporting a zero-denominator pass", () => {
  expect(() =>
    evaluateReviewedHours({ steps: [] }, hash, [], "2026-11-01"),
  ).toThrow();
  expect(() =>
    evaluateReviewedHours(trace(), hash, [], "2026-02-30"),
  ).toThrow();
});
