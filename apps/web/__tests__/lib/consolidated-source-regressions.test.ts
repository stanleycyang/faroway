import { expect, it } from "vitest";
import hours from "../../../../scripts/fixtures/reviewed-venue-hours.json";
import decisions from "../../../../scripts/fixtures/reviewed-activity-decisions.json";
import {
  reviewedHoursExclusions,
  type ReviewedVenueHours,
} from "@/lib/search/reviewed-venue-hours";
import {
  activityDecisionSchema,
  applyReviewedActivityDecisions,
} from "@/lib/search/reviewed-activity-decisions";
import type { ActivityResult } from "@/lib/search/types";

const visit = (
  name: string,
  address: string,
  duration: number,
): ActivityResult => ({
  id: name,
  name,
  description: "Generated suggestion",
  category: "culture",
  duration,
  proposedVisitType: "ordinary_entry",
  price: 0,
  currency: "",
  rating: 0,
  reviewCount: 0,
  location: { name, address, lat: 0, lng: 0 },
  images: [],
  bestTimeOfDay: "any",
  vibeScore: 80,
  vibeMatch: [],
  bookingRequired: false,
});

it.each([
  [
    "Copenhagen, Denmark",
    "Amalienborg Palace Museum",
    "Amalienborg Slotsplads 5, 1257 København K, Denmark",
    90,
  ],
  [
    "New York, USA",
    "Morgan Library & Museum",
    "225 Madison Ave, New York, NY 10016",
    120,
  ],
] as const)(
  "rejects Monday admission for %s / %s while retaining a fitting Tuesday",
  (destination, name, address, duration) => {
    const result = reviewedHoursExclusions(
      { destination },
      [visit(name, address, duration)],
      ["2027-01-11", "2027-01-12"],
      hours as ReviewedVenueHours[],
      "2026-11-03",
    );
    expect(
      result
        .filter((item) => item.date === "2027-01-11")
        .map((item) => item.slot),
    ).toEqual(["morning", "afternoon", "evening"]);
    expect(
      result
        .filter((item) => item.date === "2027-01-12")
        .map((item) => item.slot),
    ).toEqual(name.startsWith("Morgan") ? ["morning", "evening"] : ["evening"]);
  },
);

it("rejects Block Arcade after Tuesday closing but retains Friday evening admission", () => {
  const result = reviewedHoursExclusions(
    { destination: "Melbourne, Australia" },
    [visit("The Block Arcade", "282 Collins St, Melbourne VIC 3000", 30)],
    ["2027-01-12", "2027-01-15"],
    hours as ReviewedVenueHours[],
    "2026-11-03",
  );
  expect(result.map((item) => [item.date, item.slot])).toEqual([
    ["2027-01-12", "evening"],
  ]);
});

it("holds the observed glasshouse, garden, spa and sledging claims without rewriting them as certified alternatives", () => {
  const facts = activityDecisionSchema
    .array()
    .parse(decisions)
    .filter((record) => record.id.endsWith("-consolidated-review"));
  expect(facts).toHaveLength(4);
  for (const fact of facts) {
    const activity = {
      ...visit(fact.names[0], fact.addresses[0], 60),
      proposedVisitType: fact.visitTypes[0],
    };
    const result = applyReviewedActivityDecisions(
      { destination: fact.destination, mobilityNeeds: "step-free" },
      [activity],
      ["2027-01-11"],
      facts,
      "2026-11-03",
    );
    expect(result.exclusions).toHaveLength(1);
    expect(result.activities).toEqual([activity]);
    expect(result.notes[0]).toContain(fact.sourceUrl);
  }
});
