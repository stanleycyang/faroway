import { expect, test } from "bun:test";
import {
  liveQualityGate,
  runGenerationQualityEval,
} from "../uat/lib/generation-quality";

test("offline generation quality clears thresholds and catches negative controls", async () => {
  const report = await runGenerationQualityEval();
  expect(report.live_model_quality_measured).toBe(true);
  expect(report.scores_measure_model_output).toBe(false);
  expect(report.keyword_self_score_is_release_gate).toBe(false);
  expect(report.accepted).toBe(true);
  expect(report.missed_controls).toEqual([]);
  expect(report.mutations_missed).toEqual([]);
  expect(report.negative_controls_detected).toBe(report.negative_controls);
  expect(report.current.specificity).toBeGreaterThan(
    report.baseline.specificity,
  );
  expect(Object.values(report.current).every((score) => score >= 4)).toBe(true);
  expect(Object.values(report.coverage).every(Boolean)).toBe(true);
  expect(report.holdout_integrity.ok).toBe(true);
  expect(report.holdout_integrity.default_suite_uses_holdout).toBe(false);
  expect(report.planner_case.bookable_selected).toBe(true);
  expect(report.planner_case.distant_bookable_rejected).toBe(true);
});

test("offline generation quality does not call Tavily when a key is set", async () => {
  const previous = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = "present";
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    throw new Error("offline eval must not fetch");
  }) as typeof fetch;
  try {
    const report = await runGenerationQualityEval();
    expect(report.accepted).toBe(true);
    expect(calls).toEqual([]);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = previous;
  }
});

test("live quality mode stays closed without a flag, budget, and model key", () => {
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
  ).toBe(false);
  const closed = liveQualityGate({
    FAROWAY_LIVE_QUALITY_EVAL: "1",
    FAROWAY_LIVE_EVAL_BUDGET_USD: "2",
  });
  expect(closed.allowed).toBe(false);
  expect(closed.reason).toContain("FAROWAY_STAGING_AI_GATEWAY_KEY");
  expect(closed.reason).toContain("AI_GATEWAY_API_KEY");
  const open = liveQualityGate({
    FAROWAY_LIVE_QUALITY_EVAL: "1",
    FAROWAY_LIVE_EVAL_BUDGET_USD: "2",
    AI_GATEWAY_API_KEY: "test-key",
  });
  expect(open.allowed).toBe(true);
  expect(
    liveQualityGate({
      FAROWAY_LIVE_QUALITY_EVAL: "1",
      FAROWAY_LIVE_EVAL_BUDGET_USD: "2",
      FAROWAY_STAGING_AI_GATEWAY_KEY: "staging-key",
    }).allowed,
  ).toBe(true);
});
