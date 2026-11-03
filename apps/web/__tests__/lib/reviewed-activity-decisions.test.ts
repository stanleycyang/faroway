import { expect, it } from "vitest";
import {
  activityDecisionSchema,
  applyReviewedActivityDecisions,
} from "@/lib/search/reviewed-activity-decisions";
import records from "../../../../scripts/fixtures/reviewed-activity-decisions.json";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import type { SearchPlan, ActivityResult } from "@/lib/search/types";
const facts = activityDecisionSchema.array().parse(records);
const plan = rome.trace.steps[0].output as unknown as SearchPlan;
const visit = (index: number): ActivityResult => ({
  ...(rome.trace.steps[2].output as unknown as ActivityResult[])[0],
  id: `case-${index}`,
  name: facts[index].names[0],
  proposedVisitType: facts[index].visitTypes[0],
  location: {
    name: facts[index].names[0],
    address: facts[index].addresses[0],
    lat: 0,
    lng: 0,
  },
  affiliatePartner: undefined,
  affiliateUrl: undefined,
});
const dates = ["2027-01-11", "2027-01-12", "2027-01-13"];
it("withholds the full Round Tower route only for the scoped step-free request", () => {
  const request = {
    ...plan,
    destination: facts[0].destination,
    mobilityNeeds: "step-free",
  };
  const result = applyReviewedActivityDecisions(
    request,
    [visit(0)],
    dates,
    facts,
    "2026-11-03",
  );
  expect(result.exclusions.map((e) => e.date)).toEqual(dates);
  expect(result.notes[0]).toContain("requires stairs");
  expect(
    applyReviewedActivityDecisions(
      { ...request, mobilityNeeds: "", requirements: undefined },
      [visit(0)],
      dates,
      facts,
      "2026-11-03",
    ).exclusions,
  ).toEqual([]);
  expect(
    applyReviewedActivityDecisions(
      request,
      [{ ...visit(0), proposedVisitType: "exterior_walk" }],
      dates,
      facts,
      "2026-11-03",
    ).exclusions,
  ).toEqual([]);
});
it.each([1, 2, 3])(
  "defers the winter service/entity failure %i without asserting a future closure",
  (index) => {
    const result = applyReviewedActivityDecisions(
      { ...plan, destination: facts[index].destination },
      [visit(index)],
      dates,
      facts,
      "2026-11-03",
    );
    expect(result.exclusions).toHaveLength(3);
    expect(result.notes[0]).toContain(facts[index].sourceUrl);
  },
);
it("corrects generated Castle prose without transferring the trip to Perth or rewriting vendor content", () => {
  const request = { ...plan, destination: facts[4].destination };
  const activity = {
    ...visit(4),
    description: "View the Stone of Destiny here.",
  };
  const result = applyReviewedActivityDecisions(
    request,
    [activity],
    dates,
    facts,
    "2026-11-03",
  );
  expect(result.activities[0].id).toBe(activity.id);
  expect(result.activities[0].location).toEqual(activity.location);
  expect(result.activities[0].description).toContain("now at Perth Museum");
  const provider = { ...activity, affiliatePartner: "vendor" };
  expect(
    applyReviewedActivityDecisions(
      request,
      [provider],
      dates,
      facts,
      "2026-11-03",
    ).activities[0],
  ).toEqual(provider);
});
it("does not transfer evidence to another city, branch, scope or date; stale reviews defer rather than certify", () => {
  const request = { ...plan, destination: facts[1].destination };
  expect(
    applyReviewedActivityDecisions(
      { ...request, destination: "Paris" },
      [visit(1)],
      dates,
      facts,
      "2026-11-03",
    ).exclusions,
  ).toEqual([]);
  expect(
    applyReviewedActivityDecisions(
      request,
      [
        {
          ...visit(1),
          location: { ...visit(1).location, address: "Another branch" },
        },
      ],
      dates,
      facts,
      "2026-11-03",
    ).exclusions,
  ).toEqual([]);
  expect(
    applyReviewedActivityDecisions(
      request,
      [visit(1)],
      ["2027-07-01"],
      facts,
      "2026-11-03",
    ).exclusions,
  ).toEqual([]);
  const stale = applyReviewedActivityDecisions(
    request,
    [visit(1)],
    dates,
    facts,
    "2026-12-04",
  );
  expect(stale.exclusions).toHaveLength(3);
  expect(stale.notes[0]).toContain("needs refreshing");
});
