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
  ["The Jewish Museum", "1109 5th Ave, New York, NY 10128", "2027-01-12"],
  [
    "The Met Cloisters",
    "99 Margaret Corbin Dr, New York, NY 10040",
    "2027-01-13",
  ],
] as const)(
  "rejects the observed closed-day visit to %s",
  (name, address, date) => {
    const result = reviewedHoursExclusions(
      { destination: "New York, USA" },
      [visit(name, address, 120)],
      [date],
      hours as ReviewedVenueHours[],
      "2026-11-03",
    );
    expect(result.map((item) => item.slot)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  },
);

it("moves a long Whitney visit out of its short morning opening window", () => {
  const result = reviewedHoursExclusions(
    { destination: "New York, USA" },
    [
      visit(
        "Whitney Museum of American Art",
        "99 Gansevoort St, New York, NY 10014",
        150,
      ),
    ],
    ["2027-01-13"],
    hours as ReviewedVenueHours[],
    "2026-11-03",
  );
  expect(result.map((item) => item.slot)).toEqual(["morning", "evening"]);
});

it.each([
  [
    "Copenhagen, Denmark",
    "Bartholin Instituttet Botanical Garden",
    "Gothersgade 128, 1123 København K",
  ],
  [
    "Edinburgh, United Kingdom",
    "The Queen's Gallery, Palace of Holyroodhouse",
    "Palace of Holyroodhouse, Edinburgh EH8 8AS",
  ],
  [
    "Edinburgh, United Kingdom",
    "Edinburgh Press Club",
    "20-30 Cockburn St, Edinburgh EH1 1NY",
  ],
] as const)(
  "holds unresolved identity or admission for %s / %s",
  (destination, name, address) => {
    const result = applyReviewedActivityDecisions(
      { destination },
      [visit(name, address, 60)],
      ["2027-01-11"],
      activityDecisionSchema.array().parse(decisions),
      "2026-11-03",
    );
    expect(result.exclusions).toHaveLength(1);
    expect(result.activities[0].name).toBe(name);
  },
);

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

it.each([
  [
    "New York, USA",
    "The Metropolitan Museum of Art",
    "1000 5th Ave, New York, NY 10028",
    240,
    "2027-01-12",
  ],
  [
    "New York, USA",
    "Museum of Modern Art (MoMA)",
    "11 W 53rd St, New York, NY 10019",
    180,
    "2027-01-13",
  ],
  [
    "Copenhagen, Denmark",
    "Experimentarium",
    "Tuborg Havnevej 7, 2900 Hellerup, Denmark",
    180,
    "2027-01-11",
  ],
] as const)(
  "keeps a long visit to %s / %s out of a morning that starts before opening",
  (destination, name, address, duration, date) => {
    const result = reviewedHoursExclusions(
      { destination },
      [visit(name, address, duration)],
      [date],
      hours as ReviewedVenueHours[],
      "2026-11-03",
    );
    expect(result.map((item) => item.slot)).toEqual(["morning", "evening"]);
  },
);

it("blocks Tuesday MAAT admission without transferring museum hours to an exterior visit", () => {
  const activity = visit(
    "MAAT (Museum of Art, Architecture and Technology)",
    "Av. Brasília, 1300-598 Lisboa",
    90,
  );
  const result = reviewedHoursExclusions(
    { destination: "Lisbon, Portugal" },
    [activity],
    ["2027-01-12"],
    hours as ReviewedVenueHours[],
    "2026-11-03",
  );
  expect(result.map((item) => item.slot)).toEqual([
    "morning",
    "afternoon",
    "evening",
  ]);
  const exterior = reviewedHoursExclusions(
    { destination: "Lisbon, Portugal" },
    [{ ...activity, proposedVisitType: "exterior_walk" }],
    ["2027-01-12"],
    hours as ReviewedVenueHours[],
    "2026-11-03",
  );
  expect(exterior[0].reason).toBe("venue_visit_scope_requires_review");
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
