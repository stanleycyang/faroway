import { expect, test } from "bun:test";
import {
  liveQualityGate,
  runGenerationQualityEval,
} from "../uat/lib/generation-quality";

test("offline generation quality clears thresholds and catches negative controls", async () => {
  const report = await runGenerationQualityEval();
  expect(report.live_model_quality_measured).toBe(false);
  expect(report.accepted).toBe(true);
  expect(report.missed_controls).toEqual([]);
  expect(report.negative_controls_detected).toBe(report.negative_controls);
  expect(report.current.specificity).toBeGreaterThan(
    report.baseline.specificity,
  );
  expect(report.planner_case.bookable_selected).toBe(true);
  expect(report.planner_case.distant_bookable_rejected).toBe(true);
});

test("live quality mode stays closed without a flag, budget, and recorded trace", () => {
  expect(liveQualityGate({}).allowed).toBe(false);
  expect(
    liveQualityGate({
      FAROWAY_LIVE_QUALITY_EVAL: "1",
      FAROWAY_LIVE_EVAL_BUDGET_USD: "50",
    }).allowed,
  ).toBe(false);
  expect(
    liveQualityGate({
      FAROWAY_LIVE_QUALITY_EVAL: "1",
      FAROWAY_LIVE_EVAL_BUDGET_USD: "2",
      FAROWAY_LIVE_EVAL_TRACE: "scripts/fixtures/planning-quality.json",
    }).allowed,
  ).toBe(true);
});
