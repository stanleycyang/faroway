import {
  evaluateRecordedSupply,
  reviewedSupplyCatalogSha256,
} from "../../../../scripts/uat/lib/reviewed-supply-eval";
import { expect, it } from "vitest";
import records from "../../../../scripts/fixtures/reviewed-activity-supply.json";
import hours from "../../../../scripts/fixtures/reviewed-venue-hours.json";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import {
  type ReviewedActivitySupply,
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
const run = (
  rows: ReviewedActivitySupply[] = records,
  dates = ["2027-01-11"],
  input = plan,
) => addReviewedActivitySupply(input, [], dates, rows, "2026-11-02");
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

it("repairs the preserved failed Melbourne inventory without promoting unknown visits to verified", async () => {
  const { default: observed } =
    await import("../../../../scripts/fixtures/agentic-melbourne-supply-ranking.json");
  const input = observed.plan as unknown as SearchPlan;
  const inventory = observed.activities as unknown as ActivityResult[];
  const meals =
    observed.dining as unknown as import("@/lib/search/types").DiningResult[];
  const dates = ["2027-01-11", "2027-01-12", "2027-01-13"];
  const prepared = addReviewedActivitySupply(
    input,
    inventory.filter((a) => a.id !== records[0].id),
    dates,
    records,
    "2026-11-02",
  );
  const excluded = reviewedHoursExclusions(
    input,
    prepared.activities,
    dates,
    hours as ReviewedVenueHours[],
    "2026-11-02",
  );
  const ngv = inventory.find(
    (a) => a.name === "NGV International Evening Exploration",
  )!;
  expect(
    excluded
      .filter((e) => e.activityId === ngv.id)
      .every((e) => e.reason === "venue_identity_requires_review"),
  ).toBe(true);
  expect(excluded.filter((e) => e.activityId === ngv.id)).toHaveLength(3);
  const result = compileSchedule(
    input,
    prepared.activities,
    meals,
    [...excluded, ...prepared.exclusions],
    { reviewedActivityIds: prepared.admitted.map((r) => r.id) },
  );
  const selected = result.days.flatMap((d) => d.evening.activities);
  expect(result.days.every((d) => d.evening.activities.length > 0)).toBe(true);
  expect(selected.map((a) => a.name)).toEqual([
    "Flinders Street Station Architectural View",
    "Federation Square Cultural Precinct Walk",
    "Melbourne Skydeck",
  ]);
  expect(selected.filter((a) => a.id === records[0].id)).toHaveLength(1);
  expect(
    result.days.every(
      (d) =>
        !d.morning.activities.length &&
        !d.afternoon.activities.length &&
        !d.afternoon.meal,
    ),
  ).toBe(true);
});

it("admits the dated Magic Park event at its new location only in the reviewed evening window", () => {
  const event = records.find(
    (record) => record.id === "reviewed-interlaken-magic-park-2027",
  )!;
  const eventPlan = {
    ...plan,
    destination: event.destination,
    activityCriteria: {
      ...plan.activityCriteria,
      interests: ["winter activities"],
    },
  };
  const result = addReviewedActivitySupply(
    eventPlan,
    [],
    ["2027-01-11", "2027-03-01"],
    [event],
    "2026-11-03",
  );
  expect(result.activities[0].proposedVisitType).toBe("event");
  expect(result.activities[0].location.address).toContain("Kursaalgarten");
  expect(result.activities[0].location.lat).toBe(0);
  expect(
    result.exclusions.some(
      (e) => e.date === "2027-01-11" && e.slot === "evening",
    ),
  ).toBe(false);
  expect(
    result.exclusions.some(
      (e) => e.date === "2027-01-11" && e.slot === "morning",
    ),
  ).toBe(true);
  expect(
    result.exclusions.some((e) => e.date === "2027-03-01" && !e.slot),
  ).toBe(true);
  expect(event.lastEntry).toBeUndefined();
});
