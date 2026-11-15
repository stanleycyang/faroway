import { expect, test } from "bun:test";
import { runTravelerHoldout } from "../uat/lib/traveler-holdout";

test("traveler holdout accepts planned fixtures and rejects known bad days", async () => {
  const report = await runTravelerHoldout();
  expect(report.live_model_quality_measured).toBe(false);
  expect(report.results.filter((result) => result.kind === "control").every((result) => result.accepted)).toBe(true);
  expect(report.results.find((result) => result.id === "recorded-supplier-decisions")?.accepted).toBe(true);
  expect(report.accepted).toBe(true);
});
