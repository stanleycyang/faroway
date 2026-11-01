import { test, expect } from "bun:test";
import { attachComparisonContracts } from "../uat/lib/comparison-contracts";
import type { CompareReport } from "../uat/lib/model-compare";
const report: CompareReport = {
  ok: true,
  mode: "live",
  projectRef: "fixture",
  capUsd: 0.5,
  spentUsd: 0.1,
  aborted: false,
  rows: [],
  markdown: "Execution completed.",
};
const expected = [
  { configId: "candidate", briefId: "rest" },
  { configId: "candidate", briefId: "city" },
];
const passing = expected.map((item) => ({
  ...item,
  contractPass: true,
  failures: [],
}));
test("successful billing cannot hide a failed trip contract", () => {
  const result = attachComparisonContracts(report, expected, [
    {
      ...passing[0],
      contractPass: false,
      failures: ["day_1:midday_rest_timing_conflict"],
    },
    passing[1],
  ]);
  expect(result.executionOk).toBe(true);
  expect(result.ok).toBe(false);
  expect(result.contracts).toMatchObject({
    expected: 2,
    passed: 1,
    failed: 1,
    notRun: 0,
  });
  expect(result.markdown).toContain("midday_rest_timing_conflict");
});
test("unrun cases remain in the denominator and cannot pass", () => {
  const result = attachComparisonContracts(report, expected, [passing[0]]);
  expect(result.ok).toBe(false);
  expect(result.contracts.notRun).toBe(1);
});
test("all contracts passing still does not certify traveler quality or bypass an execution abort", () => {
  const result = attachComparisonContracts(report, expected, passing);
  expect(result.ok).toBe(true);
  expect(result.qualityAccepted).toBe(false);
  expect(
    attachComparisonContracts(
      { ...report, ok: false, aborted: true },
      expected,
      passing,
    ).ok,
  ).toBe(false);
});
test("ambiguous or unexpected results are rejected rather than replacing failed cases", () => {
  expect(() =>
    attachComparisonContracts(report, expected, [passing[0], passing[0]]),
  ).toThrow("Duplicate");
  expect(() => attachComparisonContracts(report, [], [])).toThrow("Nonempty");
  expect(() =>
    attachComparisonContracts(report, expected, [
      { ...passing[0], briefId: "unknown" },
    ]),
  ).toThrow("unexpected");
});
test("inconsistent pass metadata with recorded failures cannot pass", () => {
  expect(
    attachComparisonContracts(report, expected, [
      { ...passing[0], failures: ["failure"] },
      passing[1],
    ]).ok,
  ).toBe(false);
});
