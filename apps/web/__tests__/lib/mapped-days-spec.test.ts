import { expect, it } from "vitest";
import { mappedDaysToSpec } from "@/lib/json-render/mapped-days";
import { buildItineraryBlocks } from "@/lib/json-render/build-spec";
const visit = {
  id: "visit",
  name: "Museum",
  duration: 150,
  proposedVisitType: "ordinary_entry",
  estimatedCost: { amount: 0, currency: "", status: "unknown" },
  location: { name: "Museum" },
};
const meal = {
  id: "meal",
  name: "Cafe",
  cuisineType: ["French"],
  priceLevel: 3,
  estimatedCost: { amount: 0, currency: "", status: "unknown" },
  reservationInfo: { url: "https://example.org/menu" },
};
const day = {
  dayNumber: 1,
  date: "2027-01-11",
  title: "Day",
  morning: {
    activities: [visit],
    meals: [meal, { ...meal, id: "second", name: "Second cafe" }],
  },
  afternoon: { activities: [], meals: [] },
  evening: {
    activities: [],
    meals: [{ ...meal, id: "dinner", name: "Dinner" }],
  },
};
it("shows saved verification notes before visits and replaces stale timing claims", () => {
  const warnings = [
    "Dietary suitability and allergen safety are unverified.",
    "Accessibility for your mobility needs is unverified.",
  ];
  const blocks = buildItineraryBlocks(
    mappedDaysToSpec([
      {
        ...day,
        timingProposal: { invalid: true },
        tips: ["Proposed local timing: 09:00", ...warnings, null, "  "],
      },
    ]),
  );
  const notes = blocks.filter((block) => block.type === "Text");
  expect(notes.map((block) => block.props.content)).toEqual([
    "Proposed times need a fresh review.",
    ...warnings,
  ]);
  expect(blocks.indexOf(notes.at(-1)!)).toBeLessThan(
    blocks.findIndex((block) => block.type === "RestaurantCard"),
  );
  expect(notes.every((block) => block.props.variant === "body")).toBe(true);
});
it("projects all saved meals and canonical activity fields without changing the source", () => {
  const original = structuredClone(day);
  const result = mappedDaysToSpec([day]);
  expect(day).toEqual(original);
  expect(result[0].morning?.activities?.[0]).toMatchObject({
    id: "visit",
    duration: 2.5,
    proposedVisitType: "ordinary_entry",
    priceStatus: "unknown",
  });
  expect(result[0].morning?.meals?.map((m) => m.id)).toEqual([
    "meal",
    "second",
  ]);
  const blocks = buildItineraryBlocks(result);
  expect(
    blocks.filter((b) => b.type === "RestaurantCard").map((b) => b.props.name),
  ).toEqual(["Cafe", "Second cafe", "Dinner"]);
  expect(
    blocks
      .filter((b) => b.type === "RestaurantCard")
      .every(
        (b) =>
          b.props.priceLevel === undefined && b.props.priceStatus === "unknown",
      ),
  ).toBe(true);
  expect(blocks.find((b) => b.type === "ActivityCard")?.props.duration).toBe(
    "2.5 hours",
  );
  expect(
    buildItineraryBlocks(mappedDaysToSpec(JSON.parse(JSON.stringify([day])))),
  ).toEqual(blocks);
});
it("does not duplicate plural meals with a legacy singular copy", () => {
  const projected = mappedDaysToSpec([day]);
  projected[0].morning!.meal = meal;
  expect(
    buildItineraryBlocks(projected).filter((b) => b.type === "RestaurantCard"),
  ).toHaveLength(3);
});
it.each([null, {}, { dayNumber: 0, date: "2027-01-11", title: "Day" }])(
  "rejects malformed saved day metadata: %s",
  (value) => {
    expect(() => mappedDaysToSpec([value])).toThrow(
      "Invalid saved itinerary day",
    );
  },
);
it("keeps missing optional data unknown and ignores malformed entries", () => {
  const result = mappedDaysToSpec([
    {
      dayNumber: 1,
      date: "2027-01-11",
      title: "Day",
      morning: {
        activities: [null, { name: "Visit" }],
        meals: [null, { name: "Cafe" }],
      },
    },
  ]);
  expect(result[0].morning?.activities).toHaveLength(1);
  expect(result[0].morning?.meals).toHaveLength(1);
  expect(result[0].morning?.activities?.[0].duration).toBeUndefined();
  expect(result[0].morning?.meals?.[0].priceLevel).toBeUndefined();
});
