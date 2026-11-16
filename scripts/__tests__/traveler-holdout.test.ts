import { expect, test } from "bun:test";
import { runTravelerHoldout } from "../uat/lib/traveler-holdout";

test("traveler holdout accepts planned fixtures and rejects known bad days", async () => {
  const report = await runTravelerHoldout();
  expect(report.live_model_quality_measured).toBe(false);
  expect(report.results.map((result) => result.id).sort()).toEqual(
    [
      "aggregator-day-labels",
      "control-day-label",
      "control-fallback",
      "control-invented-price",
      "control-meal-slot",
      "control-renamed-backup",
      "control-timing",
      "control-truncated",
      "control-unwalkable-fit",
      "control-visit-window",
      "edinburgh-transit",
      "kyoto-last-admission",
      "lisbon-meal-repair",
      "lisbon-step-free",
      "mexico-city-family",
      "nara-unwalkable",
      "oaxaca-vegan",
      "porto-visit-window",
      "recorded-supplier-decisions",
      "singapore-arrival",
      "tokyo-balanced",
    ].sort(),
  );
  expect(
    report.results
      .filter((result) => result.kind === "control")
      .every((result) => result.accepted),
  ).toBe(true);
  expect(
    report.results.find((result) => result.id === "recorded-supplier-decisions")
      ?.accepted,
  ).toBe(true);
  expect(report.accepted).toBe(true);
});
