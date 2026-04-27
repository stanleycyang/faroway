import { describe, it, expect } from "vitest";
import { computeStats } from "@/lib/tools/world-map/stats";
import type { CountryVisit } from "@/lib/tools/world-map/types";

function v(iso: string): CountryVisit {
  return { iso, status: "visited" };
}

describe("computeStats", () => {
  it("counts every visit as one pin", () => {
    const visits = {
      JPN: v("JPN"),
      FRA: v("FRA"),
      DEU: v("DEU"),
      CAN: v("CAN"),
    };
    const stats = computeStats(visits);
    expect(stats.totalVisited).toBe(4);
  });

  it("counts unique continents touched", () => {
    const visits = {
      JPN: v("JPN"),
      FRA: v("FRA"),
      DEU: v("DEU"),
    };
    const stats = computeStats(visits);
    // Japan is Asia, France + Germany are Europe.
    expect(stats.continentsVisited).toBe(2);
  });

  it("returns zeros for empty visits", () => {
    const stats = computeStats({});
    expect(stats.totalVisited).toBe(0);
    expect(stats.continentsVisited).toBe(0);
    expect(stats.totalCountries).toBeGreaterThan(0);
    expect(stats.continentsTotal).toBe(6);
  });
});
