/** Credential-free traveler holdout. Never calls a model or supplier. */
import { runTravelerHoldout } from "./lib/traveler-holdout";

const report = await runTravelerHoldout();
const summary = {
  mode: report.mode,
  accepted: report.accepted,
  planner_accepted: report.planner_accepted,
  planner_cases: report.planner_cases,
  planner_failed: report.planner_failed,
  negative_controls_detected: report.negative_controls_detected,
  negative_controls: report.negative_controls,
  supplier_accepted: report.supplier_accepted,
  failures: report.results
    .filter((result) => result.kind !== "control" && !result.accepted)
    .map((result) => ({ id: result.id, failures: result.failures })),
  missed_controls: report.results
    .filter((result) => result.kind === "control" && !result.accepted)
    .map((result) => result.id),
};
console.log(JSON.stringify(summary, null, 2));
if (!report.accepted) process.exit(1);
