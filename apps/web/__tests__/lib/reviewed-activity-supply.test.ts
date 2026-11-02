import {
  evaluateRecordedSupply,
  reviewedSupplyCatalogSha256,
} from "../../../../scripts/uat/lib/reviewed-supply-eval";
import { expect, it } from "vitest";
import records from "../../../../scripts/fixtures/reviewed-activity-supply.json";
import hours from "../../../../scripts/fixtures/reviewed-venue-hours.json";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import {
  addReviewedActivitySupply,
  appendActivitySourceNotes,
} from "@/lib/search/reviewed-activity-supply";
import {
  reviewedHoursExclusions,
  type ReviewedVenueHours,
} from "@/lib/search/reviewed-venue-hours";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import type { SearchPlan, ActivityResult } from "@/lib/search/types";
const plan: SearchPlan = {
  ...(rome.trace.steps[0].output as unknown as SearchPlan),
  destination: "Melbourne, Australia",
  dates: { start: "2027-01-11", end: "2027-01-11", nights: 0 },
  activityCriteria: {
    ...(rome.trace.steps[0].output as unknown as SearchPlan).activityCriteria,
    interests: ["culture"],
  },
  mobilityNeeds: "Working 09:00–17:00 on each trip day; only evening visits",
};
const run = (rows = records, dates = ["2027-01-11"], input = plan) =>
  addReviewedActivitySupply(input, [], dates, rows, "2026-11-02");
it("replaces a closed evening selection with a source-backed candidate without inventing coordinates or quotes", () => {
  const supply = run();
  expect(supply.activities).toHaveLength(1);
  const skydeck = supply.activities[0];
  expect(skydeck.priceStatus).toBe("unknown");
  expect(skydeck.images).toEqual([]);
  expect(skydeck.affiliateUrl).toBeUndefined();
  const library: ActivityResult = {
    ...skydeck,
    id: "library",
    name: "State Library Victoria",
    bestTimeOfDay: "evening",
    location: {
      ...skydeck.location,
      address: "328 Swanston St, Melbourne VIC 3000, Australia",
    },
  };
  const excluded = reviewedHoursExclusions(
    plan,
    [library],
    ["2027-01-11"],
    hours as ReviewedVenueHours[],
    "2026-11-02",
  );
  const result = compileSchedule(
    plan,
    [library, ...supply.activities],
    [],
    [...excluded, ...supply.exclusions],
  );
  expect(result.days[0].evening.activities.map((a) => a.name)).toEqual([
    "Melbourne Skydeck",
  ]);
  expect(result.days[0].morning.activities).toEqual([]);
  expect(result.days[0].afternoon.activities).toEqual([]);
  appendActivitySourceNotes(result.days, supply.admitted);
  expect(result.days[0].tips.join(" ")).toContain(records[0].sourceUrl);
  expect(result.days[0].tips.join(" ")).toContain("planning estimate");
});
it("limits admission to fresh, unique, matching and valid evidence", () => {
  for (const patch of [
    { reviewAfter: "2026-11-01" },
    { observedAt: "2026-11-03" },
    { sourceSha256: "bad" },
    { sourceUrl: "javascript:alert(1)" },
    { lastEntry: 1440 },
    { durationMinutes: 0 },
    { validThrough: "2026-12-31" },
  ])
    expect(run([{ ...records[0], ...patch }]).activities).toEqual([]);
  expect(run([records[0], records[0]]).activities).toEqual([]);
  expect(
    run(records, undefined, { ...plan, destination: "Melbourne, USA" })
      .activities,
  ).toEqual([]);
  expect(
    run(records, undefined, {
      ...plan,
      activityCriteria: { ...plan.activityCriteria, interests: ["surfing"] },
    }).activities,
  ).toEqual([]);
});
it("excludes exceptional and unsupported dates within mixed-date itineraries", () => {
  const supply = run(records, ["2026-12-31", "2027-01-01", "2027-04-05"]);
  expect(supply.activities).toHaveLength(1);
  expect(supply.exclusions.filter((e) => !e.slot).map((e) => e.date)).toEqual([
    "2026-12-31",
    "2027-04-05",
  ]);
  expect(run(records, ["2026-12-31"]).activities).toEqual([]);
});
it("preserves existing venue/provider entries and rejects unrelated id collisions", () => {
  const original = {
    ...run().activities[0],
    id: "provider",
    description: "Provider copy",
  };
  const result = addReviewedActivitySupply(
    plan,
    [original],
    ["2027-01-11"],
    records,
    "2026-11-02",
  );
  expect(result.activities).toEqual([original]);
  expect(result.admitted).toEqual([]);
  const collision = { ...original, id: records[0].id, name: "Another venue" };
  expect(
    addReviewedActivitySupply(
      plan,
      [collision],
      ["2027-01-11"],
      records,
      "2026-11-02",
    ).activities,
  ).toEqual([collision]);
});
it("respects last-entry when the candidate duration is shorter than the remaining opening window", () => {
  const short = { ...records[0], durationMinutes: 15, lastEntry: 1080 };
  const result = addReviewedActivitySupply(
    {
      ...plan,
      mobilityNeeds: "Working 00:00–19:00 daily; only evening visits",
    },
    [],
    ["2027-01-11"],
    [short],
    "2026-11-02",
  );
  expect(result.exclusions.some((e) => e.slot === "evening")).toBe(true);
});

it("records runtime-prepared candidates in the independent eval format", () => {
  const supply = run();
  const result = evaluateRecordedSupply(
    {
      catalogSha256: reviewedSupplyCatalogSha256,
      capturedAt: "2026-11-02T00:00:01Z",
      candidates: supply.activities,
    },
    [],
    plan.destination,
    plan.activityCriteria.interests,
    "2026-11-02T00:00:00Z",
  );
  expect(result.failures).toEqual([]);
  expect(result.accepted).toEqual(supply.activities);
});
