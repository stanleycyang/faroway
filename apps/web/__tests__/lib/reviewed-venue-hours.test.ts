import { expect, it } from "vitest";
import {
  reviewedHoursExclusions,
  type ReviewedVenueHours,
} from "@/lib/search/reviewed-venue-hours";
import type { ActivityResult } from "@/lib/search/types";
const plan = { destination: "City" };
const activity = {
  id: "venue",
  name: "Museum",
  location: { address: "1 Museum Street" },
  duration: 120,
} as ActivityResult;
const fact: ReviewedVenueHours = {
  id: "hours",
  destination: "City",
  aliases: ["Museum"],
  addresses: ["1 Museum Street"],
  sourceUrl: "https://example.com/visit",
  sourceSha256: "a".repeat(64),
  observedAt: "2026-11-01",
  reviewAfter: "2026-12-01",
  branchReview: "Reviewed branch",
  months: [1],
  week: [
    { weekday: 1, intervals: [[600, 1020]] },
    { weekday: 2, intervals: [] },
  ],
};
it("excludes incompatible slots and explicit closures without treating missing days or months as closed", () => {
  const results = reviewedHoursExclusions(
    plan,
    [activity],
    ["2027-01-11", "2027-01-12", "2027-01-13", "2027-02-01"],
    [fact],
    "2026-11-01",
  );
  expect(results.map((r) => [r.date, r.slot])).toEqual([
    ["2027-01-11", "evening"],
    ["2027-01-12", "morning"],
    ["2027-01-12", "afternoon"],
    ["2027-01-12", "evening"],
  ]);
});
it("does not sum time across a published midday closure or shorten a visit", () => {
  const results = reviewedHoursExclusions(
    plan,
    [{ ...activity, duration: 180 }],
    ["2027-01-11"],
    [
      {
        ...fact,
        week: [
          {
            weekday: 1,
            intervals: [
              [720, 810],
              [900, 990],
            ],
          },
        ],
      },
    ],
    "2026-11-01",
  );
  expect(results).toHaveLength(3);
});
it("does not transfer hours across cities, names or addresses", () => {
  for (const candidate of [
    { ...activity, name: "Other museum" },
    {
      ...activity,
      location: { ...activity.location, address: "2 Museum Street" },
    },
  ])
    expect(
      reviewedHoursExclusions(
        plan,
        [candidate],
        ["2027-01-11"],
        [fact],
        "2026-11-01",
      ),
    ).toEqual([]);
  expect(
    reviewedHoursExclusions(
      { destination: "Other City" },
      [activity],
      ["2027-01-11"],
      [fact],
      "2026-11-01",
    ),
  ).toEqual([]);
});
it("withholds a matched venue when source evidence is stale, ambiguous or malformed", () => {
  for (const facts of [
    [fact, fact],
    [{ ...fact, reviewAfter: "2026-10-31" }],
    [{ ...fact, sourceSha256: "bad" }],
    [{ ...fact, week: [{ weekday: 1, intervals: [[1020, 600]] }] }],
  ] as ReviewedVenueHours[][]) {
    const result = reviewedHoursExclusions(
      plan,
      [activity],
      ["2027-01-11"],
      facts,
      "2026-11-01",
    );
    expect(result).toHaveLength(1);
    expect(result[0].slot).toBeUndefined();
    expect(result[0].reason).toBe("venue_hours_source_review_required");
  }
});

it("intersects venue hours with traveler availability rather than checking each separately", () => {
  const result = reviewedHoursExclusions(
    { ...plan, mobilityNeeds: "Arrive on the first day at 11:00" },
    [{ ...activity, duration: 60 }],
    ["2027-01-11"],
    [{ ...fact, week: [{ weekday: 1, intervals: [[480, 600]] }] }],
    "2026-11-01",
  );
  expect(result.map((r) => r.slot)).toEqual([
    "morning",
    "afternoon",
    "evening",
  ]);
});
