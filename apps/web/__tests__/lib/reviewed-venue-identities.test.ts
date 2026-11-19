import { expect, it } from "vitest";
import records from "../../../../scripts/fixtures/reviewed-venue-identities.json";
import observed from "../../../../scripts/fixtures/agentic-melbourne-supply-ranking.json";
import {
  reviewedIdentityExclusions,
  type ReviewedIdentityEvidence,
} from "@/lib/search/reviewed-venue-identities";
import type { ActivityResult } from "@/lib/search/types";

const evidence = records as ReviewedIdentityEvidence[];
const candidate = observed.activities.find(
  (a) => a.name === "Eureka Skydeck 88 Cultural View",
) as ActivityResult;
const dates = ["2027-01-11", "2027-01-12", "2027-01-13"];
const run = (
  activity = candidate,
  facts = evidence,
  destination = "Melbourne, Australia",
) =>
  reviewedIdentityExclusions(
    { destination },
    [activity],
    dates,
    facts,
    "2026-11-02",
  );

it("withholds the saved renamed Skydeck candidate without transferring facts", () => {
  const before = structuredClone(candidate);
  expect(run()).toEqual(
    dates.map((date) => ({
      activityId: candidate.id,
      date,
      reason: "venue_identity_requires_review",
      sourceUrl: evidence[0].sourceUrl,
      observedAt: "2026-11-02",
    })),
  );
  expect(candidate).toEqual(before);
  expect(
    run({ ...candidate, name: "Melbourne Skydeck Evening Visit" }),
  ).toEqual([]);
});

it("does not transfer address evidence across cities, buildings, or stale sources", () => {
  expect(run(candidate, evidence, "Melbourne, USA")).toEqual([]);
  expect(
    run({
      ...candidate,
      location: {
        ...candidate.location,
        address: "8 Riverside Quay, Southbank VIC 3006, Australia",
      },
    }),
  ).toEqual([]);
  for (const patch of [
    { reviewAfter: "2026-11-01" },
    { observedAt: "2026-11-03" },
    { sourceSha256: "bad" },
    { sourceUrl: "javascript:alert(1)" },
    { reviewNotes: "" },
  ])
    expect(run(candidate, [{ ...evidence[0], ...patch }])).toEqual([]);
});

it("leaves co-located experiences and ambiguous identities for separate review", () => {
  for (const name of [
    "Eureka 89 Dining",
    "Melbourne Skydeck Night Concert",
    "Melbourne Skydeck Exterior Walk",
  ])
    expect(run({ ...candidate, name })).toHaveLength(3);
  expect(
    run({ ...candidate, name: "Melbourne Skydeck" }, [
      evidence[0],
      { ...evidence[0], id: "ambiguous" },
    ]),
  ).toHaveLength(3);
  expect(() =>
    reviewedIdentityExclusions(
      { destination: "Melbourne, Australia" },
      [candidate],
      ["2027-02-30"],
      evidence,
      "2026-11-02",
    ),
  ).toThrow();
});
