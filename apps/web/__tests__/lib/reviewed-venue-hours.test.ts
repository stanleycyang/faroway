import { expect, it } from "vitest";
import {
  reviewedHoursExclusions,
  type ReviewedVenueHours,
} from "@/lib/search/reviewed-venue-hours";
import type { ActivityResult } from "@/lib/search/types";
const plan = { destination: "City" };
const activity = {
  proposedVisitType: "ordinary_entry",
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
it("matches bounded title and reviewed-country address conventions without fuzzy branch matching", () => {
  const reviewed: ReviewedVenueHours = {
    ...fact,
    country: "France",
    aliases: ["Museum (ABC) International Evening Visit"],
    addresses: ["36 Avenue Dr Ménard, 06000 Nice, France"],
  };
  const candidate = {
    ...activity,
    name: "Museum (ABC International)",
    location: {
      ...activity.location,
      address: "36 Av. Docteur Ménard, 06000 Nice",
    },
  };
  const check = (a: ActivityResult, f = reviewed) =>
    reviewedHoursExclusions(plan, [a], ["2027-01-11"], [f], "2026-11-01");
  expect(check(candidate).map((r) => r.slot)).toEqual(["evening"]);
  expect(check(candidate, { ...reviewed, country: undefined })).toEqual([]);
  for (const name of [
    "Museum (ABC International) Exterior Walk",
    "Museum (ABC International) Friday Night Concert",
    "Museum (XYZ International)",
  ])
    expect(check({ ...candidate, name })).toEqual([
      expect.objectContaining({ reason: "venue_identity_requires_review" }),
    ]);
  for (const address of [
    "37 Av. Docteur Ménard, 06000 Nice",
    "36 Av. Docteur Ménard, 06001 Nice",
    "36 Av. Docteur Ménard, 06000 Nice, Canada",
    "36 Av. Docteur Ménard, Unit 2, 06000 Nice",
  ])
    expect(
      check({ ...candidate, location: { ...candidate.location, address } }),
    ).toEqual([]);
});
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
  expect(
    reviewedHoursExclusions(
      plan,
      [{ ...activity, name: "Other museum" }],
      ["2027-01-11"],
      [fact],
      "2026-11-01",
    ),
  ).toEqual([
    expect.objectContaining({ reason: "venue_identity_requires_review" }),
  ]);
  for (const candidate of [
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

it("intersects publisher opening intervals with work blocks rather than adding separate gaps", () => {
  const exclusions = reviewedHoursExclusions(
    { ...plan, mobilityNeeds: "Working 11:00–16:00 daily" },
    [activity],
    ["2027-01-11"],
    [fact],
    "2026-11-01",
  );
  expect(exclusions.map((e) => e.slot)).toEqual([
    "morning",
    "afternoon",
    "evening",
  ]);
});

it("excludes the observed library evening visit using the reviewed official record", async () => {
  const { default: records } =
    await import("../../../../scripts/fixtures/reviewed-venue-hours.json");
  const library = {
    ...activity,
    id: "saved-library",
    name: "State Library Victoria Night Visit",
    duration: 60,
    location: {
      ...activity.location,
      address: "328 Swanston St, Melbourne VIC 3000, Australia",
    },
  };
  const results = reviewedHoursExclusions(
    { destination: "Melbourne, Australia" },
    [library],
    ["2027-01-11"],
    records as ReviewedVenueHours[],
    "2026-11-02",
  );
  expect(results).toEqual([
    expect.objectContaining({
      activityId: "saved-library",
      date: "2027-01-11",
      slot: "evening",
      reason: "visit_does_not_fit_published_ordinary_hours",
      sourceUrl: "https://www.slv.vic.gov.au/visit/opening-hours",
    }),
  ]);
  for (const name of [
    "State Library Victoria Exterior Walk",
    "State Library Victoria Night Concert",
  ])
    expect(
      reviewedHoursExclusions(
        { destination: "Melbourne, Australia" },
        [{ ...library, name }],
        ["2027-01-11"],
        records as ReviewedVenueHours[],
        "2026-11-02",
      ),
    ).toEqual([
      expect.objectContaining({ reason: "venue_identity_requires_review" }),
    ]);
});

it("withholds renamed visits and co-located tenants for identity review without claiming their hours", () => {
  for (const name of [
    "Museum Night View",
    "Gallery Evening Exploration",
    "Museum Cafe",
    "Museum Exterior Walk",
    "Museum Night Concert",
  ]) {
    const results = reviewedHoursExclusions(
      plan,
      [{ ...activity, name }],
      ["2027-01-11"],
      [fact],
      "2026-11-01",
    );
    expect(results).toHaveLength(1);
    expect(results[0].reason).toBe("venue_identity_requires_review");
    expect(results[0].slot).toBeUndefined();
  }
  expect(
    reviewedHoursExclusions(
      plan,
      [{ ...activity, name: "Museum Night View" }],
      ["2027-01-11"],
      [{ ...fact, reviewAfter: "2026-10-31" }],
      "2026-11-01",
    ),
  ).toEqual([]);
});

it.each([
  undefined,
  "unknown",
  "exterior_walk",
  "guided_tour",
  "event",
] as const)(
  "keeps intent %s unresolved even when the exact venue identity matches",
  (proposedVisitType) => {
    const results = reviewedHoursExclusions(
      plan,
      [{ ...activity, proposedVisitType }],
      ["2027-01-11", "2027-01-12"],
      [fact],
      "2026-11-01",
    );
    expect(results).toEqual(
      ["2027-01-11", "2027-01-12"].map((date) => ({
        activityId: activity.id,
        date,
        reason: "venue_visit_scope_requires_review",
        sourceUrl: fact.sourceUrl,
        observedAt: fact.observedAt,
      })),
    );
  },
);
