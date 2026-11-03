import { expect, it } from "vitest";
import facts from "../../../../scripts/fixtures/reviewed-dining-days.json";
import { reviewedDiningDayExclusions } from "@/lib/search/reviewed-dining-days";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import type { DiningResult, SearchPlan } from "@/lib/search/types";
const plan = {
  ...(rome.trace.steps[0].output as unknown as SearchPlan),
  destination: "Edinburgh, United Kingdom",
  dates: { start: "2027-01-11", end: "2027-01-13", nights: 2 },
} as SearchPlan;
const meal = {
  ...(rome.trace.steps[3].output as unknown as DiningResult[])[0],
  id: "st-honore",
  name: "Cafe St Honoré",
  mealTypes: ["dinner"],
  location: {
    name: "Edinburgh",
    address: "34 Thistle St N Ln, Edinburgh EH2 1EA",
  },
} as DiningResult;
it("keeps Monday and excludes Tuesday/Wednesday only for the reviewed exact branch", () => {
  const exclusions = reviewedDiningDayExclusions(
    plan,
    [meal],
    facts,
    "2026-11-03",
  );
  expect(exclusions.map((e) => e.date)).toEqual(["2027-01-12", "2027-01-13"]);
  const result = compileSchedule(plan, [], [meal], [], {
    diningExclusions: exclusions,
  });
  expect(result.days[0].evening.meal?.id).toBe(meal.id);
  expect(result.days[1].evening.meal).toBeUndefined();
  expect(result.days[2].evening.meal).toBeUndefined();
  expect(result.days[1].tips.join(" ")).toContain(facts[0].sourceUrl);
});
it("chooses another supplied dinner when the preferred venue is excluded", () => {
  const alternative = {
    ...meal,
    id: "alternative",
    name: "Other venue",
    vibeScore: 1,
  };
  const result = compileSchedule(plan, [], [meal, alternative], [], {
    diningExclusions: reviewedDiningDayExclusions(
      plan,
      [meal, alternative],
      facts,
      "2026-11-03",
    ),
  });
  expect(result.days[1].evening.meal?.id).toBe("alternative");
});
it("does not transfer stale, future, wrong-city, wrong-address or wrong-name evidence", () => {
  for (const asOf of ["2026-11-02", "2026-12-04"])
    expect(reviewedDiningDayExclusions(plan, [meal], facts, asOf)).toEqual([]);
  expect(
    reviewedDiningDayExclusions(
      { ...plan, destination: "Paris, France" },
      [meal],
      facts,
      "2026-11-03",
    ),
  ).toEqual([]);
  expect(
    reviewedDiningDayExclusions(
      plan,
      [{ ...meal, name: "Different venue" }],
      facts,
      "2026-11-03",
    ),
  ).toEqual([]);
  expect(
    reviewedDiningDayExclusions(
      plan,
      [{ ...meal, location: { ...meal.location, address: "Other branch" } }],
      facts,
      "2026-11-03",
    ),
  ).toEqual([]);
});
it("excludes the reviewed Sabarsky branch on Tuesday without claiming allergy suitability", () => {
  const record = facts.find((fact) => fact.names.includes("Café Sabarsky"))!;
  const exclusions = reviewedDiningDayExclusions(
    { ...plan, destination: record.destination },
    [
      {
        ...meal,
        name: "Café Sabarsky",
        location: {
          name: "Café Sabarsky",
          address: "1048 5th Ave, New York, NY 10028",
        },
      },
    ],
    facts,
    "2026-11-03",
  );
  expect(exclusions.map((entry) => entry.date)).toEqual(["2027-01-12"]);
  expect(exclusions[0].sourceUrl).toBe(
    "https://www.neuegalerie.org/cafesabarsky",
  );
});
