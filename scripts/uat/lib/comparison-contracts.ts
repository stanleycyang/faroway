import type { CompareReport } from "./model-compare";
export interface ComparisonContractResult {
  configId: string;
  briefId: string;
  contractPass: boolean;
  failures: string[];
}
/** Execution/billing completion is separate from contract and traveler acceptance. */
export function attachComparisonContracts(
  report: CompareReport,
  expected: Array<{ configId: string; briefId: string }>,
  evaluations: ComparisonContractResult[],
) {
  const key = (item: { configId: string; briefId: string }) =>
    JSON.stringify([item.configId, item.briefId]);
  const expectedIds = new Set(expected.map(key));
  if (!expected.length || expectedIds.size !== expected.length)
    throw new Error("Nonempty unique expected cases required");
  const byCase = new Map(evaluations.map((item) => [key(item), item]));
  if (
    byCase.size !== evaluations.length ||
    evaluations.some((item) => !expectedIds.has(key(item)))
  )
    throw new Error("Duplicate or unexpected contract evaluation");
  const rows = expected.map((item) => {
    const evaluation = byCase.get(key(item));
    return {
      ...item,
      status: evaluation
        ? evaluation.contractPass && !evaluation.failures.length
          ? ("pass" as const)
          : ("fail" as const)
        : ("not_run" as const),
      failures: evaluation?.failures ?? [],
    };
  });
  const passed = rows.filter((item) => item.status === "pass").length;
  const contracts = {
    expected: rows.length,
    passed,
    failed: rows.filter((item) => item.status === "fail").length,
    notRun: rows.filter((item) => item.status === "not_run").length,
    rows,
  };
  return {
    ...report,
    executionOk: report.ok,
    ok: report.ok && passed === rows.length,
    qualityAccepted: false as const,
    contracts,
    markdown: `${report.markdown}\n\nStructural contracts: ${passed}/${rows.length} passed; ${contracts.failed} failed; ${contracts.notRun} not run. Execution/billing success does not establish contract success. Passing contracts does not establish traveler usefulness or production readiness.\n${rows
      .filter((item) => item.status !== "pass")
      .map(
        (item) =>
          `- ${item.configId} / ${item.briefId}: ${item.status}${item.failures.length ? ` (${item.failures.join(", ")})` : ""}`,
      )
      .join("\n")}\n`,
  };
}
