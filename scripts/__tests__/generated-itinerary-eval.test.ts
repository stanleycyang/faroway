import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runGeneratedItineraryEval } from "../uat/lib/generated-itinerary-eval";

test("generated development itineraries clear the release rubric after repair", () => {
  const source = readFileSync(
    new URL("../uat/lib/generated-itinerary-eval.ts", import.meta.url),
    "utf8",
  );
  expect(source.includes("holdout-briefs")).toBe(false);
  expect(source.includes("HOLDOUT_BRIEFS")).toBe(false);
  const report = runGeneratedItineraryEval();
  expect(report.holdout_used).toBe(false);
  expect(report.briefs).toBeGreaterThan(0);
  expect(report.empty_search).toEqual({
    grounding: 5,
    stops: 0,
    honest: true,
  });
  expect(report.failures_after).toEqual([]);
  expect(report.accepted).toBe(true);
  for (const key of Object.keys(report.after.model.dimensions)) {
    expect(
      report.after.model.dimensions[
        key as keyof typeof report.after.model.dimensions
      ],
    ).toBeGreaterThanOrEqual(4);
    expect(
      report.after.compiler.dimensions[
        key as keyof typeof report.after.compiler.dimensions
      ],
    ).toBeGreaterThanOrEqual(4);
  }
  for (const key of Object.keys(report.after.model.affiliate)) {
    expect(
      report.after.model.affiliate[
        key as keyof typeof report.after.model.affiliate
      ],
    ).toBeGreaterThanOrEqual(4);
    expect(
      report.after.compiler.affiliate[
        key as keyof typeof report.after.compiler.affiliate
      ],
    ).toBeGreaterThanOrEqual(4);
  }
});
