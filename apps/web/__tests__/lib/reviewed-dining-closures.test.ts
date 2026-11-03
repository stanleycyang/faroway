import { expect, it } from "vitest";
import facts from "../../../../scripts/fixtures/reviewed-dining-closures.json";
import { screenReportedDiningClosures } from "@/lib/search/reviewed-dining-closures";
import type { DiningResult } from "@/lib/search/types";
const plan = {
  destination: "Cambridge, Massachusetts, USA",
  dates: { start: "2027-01-11", end: "2027-01-13", nights: 2 },
};
const meal = {
  id: "closed",
  name: "Loyal Nine",
  location: {
    name: "Cambridge",
    address: "660 Cambridge St, Cambridge, MA 02141",
  },
} as DiningResult;
it("withholds an exact reported-closed venue without treating absence of evidence as opening proof", () => {
  const other = { ...meal, id: "other", name: "Other restaurant" };
  const result = screenReportedDiningClosures(
    plan,
    [meal, other],
    facts,
    "2026-11-01",
  );
  expect(result.candidates).toEqual([other]);
  expect(result.withheld[0].evidenceId).toBe(facts[0].id);
  expect(
    screenReportedDiningClosures(plan, [meal], [], "2026-11-01").candidates,
  ).toEqual([meal]);
});
it("does not transfer closure evidence to another address, city, or pre-closure trip", () => {
  expect(
    screenReportedDiningClosures(
      { ...plan, destination: "Cambridge, England, UK" },
      [meal],
      facts,
      "2026-11-01",
    ).withheld,
  ).toEqual([]);
  expect(
    screenReportedDiningClosures(
      plan,
      [{ ...meal, location: { name: "Elsewhere", address: "Other address" } }],
      facts,
      "2026-11-01",
    ).withheld,
  ).toEqual([]);
  expect(
    screenReportedDiningClosures(
      { ...plan, dates: { ...plan.dates, start: "2020-01-11" } },
      [meal],
      facts,
      "2026-11-01",
    ).withheld,
  ).toEqual([]);
  expect(
    screenReportedDiningClosures(plan, [meal], facts, "2026-10-31").withheld,
  ).toEqual([]);
});
