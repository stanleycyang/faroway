import { expect, it } from "vitest";
import {
  travelerAvailability,
  availableIntervals,
  availableSlotMinutes,
  availableMealMinutes,
  travelerVisitSlots,
} from "@/lib/search/traveler-availability";
it("interprets visit-only day parts without changing meal availability", () => {
  for (const slot of ["morning", "afternoon", "evening"]) {
    for (const text of [
      `Only ${slot} visits`,
      `${slot} activities only each day`,
    ]) {
      expect(travelerVisitSlots({ mobilityNeeds: text })).toEqual({
        allowed: [slot],
        restricted: true,
        needsReview: false,
      });
      expect(travelerAvailability({ mobilityNeeds: text }, 3).windows).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    }
  }
  const conflict = travelerVisitSlots({
    mobilityNeeds: "Only morning visits; only evening visits",
  });
  expect(conflict.allowed).toEqual([]);
  expect(conflict.needsReview).toBe(true);
});
it("does not infer visit restrictions from negated, partial-day or alternative wording", () => {
  for (const text of [
    "Not only evening visits",
    "Only evening visits on day 2",
    "Only morning or evening visits",
  ]) {
    const result = travelerVisitSlots({ mobilityNeeds: text });
    expect(result.allowed).toEqual(["morning", "afternoon", "evening"]);
    expect(result.needsReview).toBe(true);
  }
});
it.each([
  ["Arrive on the first day at 18:00", 0, 1080, 1440],
  ["First-day arrival at 7pm", 0, 1140, 1440],
  ["Depart on the final day at 09:00", 2, 0, 540],
  ["Depart at 8am on the last day", 2, 0, 480],
  ["No starts before 10am", 1, 600, 1440],
  ["No starts before 12pm", 1, 720, 1440],
])(
  "interprets explicit local clock wording: %s",
  (text, day, earliest, latest) => {
    const result = travelerAvailability({ mobilityNeeds: String(text) }, 3);
    expect(result.windows[Number(day)]).toEqual({
      earliestMinute: earliest,
      latestMinute: latest,
    });
    expect(result.needsReview).toBe(false);
  },
);
it.each([
  "Do not arrive on the first day at 18:00",
  "Arrive on the first day at 25:00",
  "Arrival time is unknown",
  "Arrive on the first day at 9",
  "Working 09:00–17:00 on day 2",
  "Not working 09:00–17:00 each day",
  "Working 22:00–06:00 each day",
  "Working 09:00–09:00 each day",
])("requires review without guessing: %s", (text) => {
  const result = travelerAvailability({ mobilityNeeds: text }, 3);
  expect(result.windows.every((w) => w === undefined)).toBe(true);
  expect(result.needsReview).toBe(true);
});
it("intersects constraints without silently resolving a contradiction", () => {
  const result = travelerAvailability(
    {
      mobilityNeeds:
        "Arrive on the first day at 18:00; depart on the final day at 09:00",
    },
    1,
  );
  expect(availableSlotMinutes(result.windows[0], 2)).toBe(0);
  expect(result.windows[0]!.earliestMinute).toBeGreaterThan(
    result.windows[0]!.latestMinute,
  );
});
it("does not constrain a trip with no explicit timing request", () => {
  const result = travelerAvailability({ mobilityNeeds: "Short walks" }, 3);
  expect(result.needsReview).toBe(false);
  expect(availableSlotMinutes(result.windows[0], 0)).toBe(Infinity);
});

it("recognizes a restatement of a parsed arrival constraint regardless of clause order", () => {
  for (const text of [
    "Arrive on the first day at 18:00; no activities before arrival",
    "No activities before arrival; arrive on the first day at 18:00",
  ])
    expect(travelerAvailability({ mobilityNeeds: text }, 3).needsReview).toBe(
      false,
    );
  expect(
    travelerAvailability({ mobilityNeeds: "No activities before arrival" }, 3)
      .needsReview,
  ).toBe(true);
});

import { travelerActivityBudget } from "@/lib/search/traveler-availability";
it.each([
  ["No more than two hours of activities daily", 120],
  ["At most 90 minutes of visits each day", 90],
  ["Maximum of 1.5 hours of sightseeing per day", 90],
  ["No more than 5 hours of scheduled activities per day", 300],
])("reads an explicit daily visit ceiling: %s", (text, expected) => {
  expect(travelerActivityBudget({ mobilityNeeds: text }).maxMinutes).toBe(
    expected,
  );
});
it("intersects ceilings and retains the unmet-count request without reading venue text", () => {
  const result = travelerActivityBudget({
    mobilityNeeds:
      "At least eight museums each day, no more than two hours of activities daily, and a midday rest every day",
    requirements: {
      allergies: [],
      dietaryPreferences: [],
      accessibility: [],
      mobilityNotes: "At most 90 minutes of visits each day",
    },
  });
  expect(result.maxMinutes).toBe(90);
  expect(result.minimum).toEqual({ count: 8, kind: "museums" });
});
it.each([
  "Do not impose at most two hours of activities daily",
  "At most two hours of activities on the first day",
  "At most zero minutes of visits daily",
  "At most 25 hours of visits daily",
  "No more than 5 hours of scheduled activities on the first day",
  "Do not impose at most 5 hours of scheduled activities daily",
])(
  "does not silently interpret a negated, partial-day or invalid ceiling: %s",
  (text) => {
    const result = travelerActivityBudget({ mobilityNeeds: text });
    expect(result.maxMinutes).toBeUndefined();
    expect(result.needsReview).toBe(true);
  },
);

it.each([
  "Working 09:00–17:00 each day",
  "Working 9am - 5pm daily",
  "Working 09:00–17:00 on each trip day",
])("preserves both free intervals around explicit daily work: %s", (text) => {
  const result = travelerAvailability({ mobilityNeeds: text }, 3);
  expect(result.needsReview).toBe(false);
  for (const window of result.windows) {
    expect(availableIntervals(window, 480, 1320)).toEqual([
      [480, 540],
      [1020, 1320],
    ]);
    expect([0, 1, 2].map((slot) => availableSlotMinutes(window, slot))).toEqual(
      [60, 60, 240],
    );
  }
});
it("intersects arrival, departure and overlapping work blocks without summing disconnected gaps", () => {
  const clauses = [
    "Working 10:00–12:00 daily",
    "Working 11:00–13:00 daily",
    "Arrive on the first day at 09:00",
    "Depart on the final day at 17:00",
  ];
  for (const list of [clauses, [...clauses].reverse()]) {
    const result = travelerAvailability({ mobilityNeeds: list.join("; ") }, 1);
    expect(availableIntervals(result.windows[0], 0, 1440)).toEqual([
      [540, 600],
      [780, 1020],
    ]);
    expect(availableSlotMinutes(result.windows[0], 0)).toBe(60);
    expect(result.needsReview).toBe(false);
  }
});

it("blocks meals during explicit daily business meetings with a CBD location", () => {
  const result = travelerAvailability(
    {
      mobilityNeeds:
        "Business meetings every trip day from 09:00 to 17:00 in Melbourne CBD.",
    },
    3,
  );
  expect(result.needsReview).toBe(false);
  for (const window of result.windows) {
    expect(window?.unavailable).toEqual([[540, 1020]]);
    expect(availableMealMinutes(window, 1)).toBe(0);
    expect(availableMealMinutes(window, 0)).toBe(60);
  }
});

it.each([
  "No business meetings every trip day from 09:00 to 17:00 in Melbourne CBD",
  "Business meetings on Tuesday from 09:00 to 17:00 in Melbourne CBD",
  "Business meetings every trip day from 17:00 to 09:00 in Melbourne CBD",
  "Business meetings every trip day from 09:00 to 17:00 or 10:00 to 16:00",
])("leaves ambiguous meeting instructions for review: %s", (mobilityNeeds) => {
  const result = travelerAvailability({ mobilityNeeds }, 3);
  expect(result.needsReview).toBe(true);
  expect(result.windows.every((window) => !window?.unavailable?.length)).toBe(
    true,
  );
});

it("keeps sightseeing after 18:00 in the evening without guessing other cutoffs", () => {
  expect(
    travelerVisitSlots({ mobilityNeeds: "Sightseeing only after 18:00." }),
  ).toEqual({ allowed: ["evening"], restricted: true, needsReview: false });
  for (const mobilityNeeds of [
    "Sightseeing only after 19:00",
    "No sightseeing only after 18:00",
    "Sightseeing only after 18:00 on Monday",
  ])
    expect(travelerVisitSlots({ mobilityNeeds }).needsReview).toBe(true);
});
