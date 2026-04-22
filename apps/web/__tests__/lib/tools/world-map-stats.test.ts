import { describe, it, expect } from "vitest";
import { computeStats } from "@/lib/tools/world-map/stats";
import type { CountryVisit } from "@/lib/tools/world-map/types";

function mk(iso: string, status: CountryVisit["status"]): CountryVisit {
  return { iso, status };
}

describe("computeStats", () => {
  it("counts visited countries and ignores wishlist", () => {
    const visits = {
      JPN: mk("JPN", "lived"),
      FRA: mk("FRA", "visited"),
      DEU: mk("DEU", "day_trip"),
      CAN: mk("CAN", "transit"),
      ARG: mk("ARG", "wishlist"),
    };
    const stats = computeStats(visits);
    expect(stats.totalVisited).toBe(4);
    expect(stats.byStatus.lived).toBe(1);
    expect(stats.byStatus.visited).toBe(1);
    expect(stats.byStatus.day_trip).toBe(1);
    expect(stats.byStatus.transit).toBe(1);
    expect(stats.byStatus.wishlist).toBe(1);
  });

  it("buckets visits by continent", () => {
    const visits = {
      JPN: mk("JPN", "visited"),
      FRA: mk("FRA", "visited"),
      DEU: mk("DEU", "visited"),
    };
    const stats = computeStats(visits);
    const europe = stats.byContinent.find((c) => c.continent === "Europe");
    const asia = stats.byContinent.find((c) => c.continent === "Asia");
    expect(europe?.visited).toBe(2);
    expect(asia?.visited).toBe(1);
    expect(stats.continentsVisited).toBe(2);
  });

  it("caps percent at 100 and returns 0 on empty visits", () => {
    const stats = computeStats({});
    expect(stats.totalVisited).toBe(0);
    expect(stats.continentsVisited).toBe(0);
    for (const c of stats.byContinent) {
      expect(c.percent).toBe(0);
    }
  });

  it("excludes Antarctica from the continent breakdown", () => {
    const visits = { JPN: mk("JPN", "visited") };
    const stats = computeStats(visits);
    expect(
      stats.byContinent.find((c) => c.continent === "Antarctica"),
    ).toBeUndefined();
  });
});
