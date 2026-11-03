import { expect, test } from "bun:test";
import {
  evaluateDayAvailability,
  validateDayAvailability,
} from "../uat/lib/day-availability";
const window = { date: "2027-01-11", earliestMinute: 1080, latestMinute: 1440 };
test("an evening arrival forbids earlier visits and meals", () => {
  const result = evaluateDayAvailability(
    {
      date: window.date,
      morning: { activities: [{ id: "museum" }] },
      afternoon: { meal: { id: "lunch" } },
      evening: { activities: [{ id: "walk" }] },
    },
    window,
  );
  expect(result.violations).toEqual([
    "day_part_outside_availability:morning",
    "day_part_outside_availability:afternoon",
  ]);
  expect(result.unknowns).toEqual([
    "availability_clock_times_unverified:evening",
  ]);
});
test("an overlapping day part does not establish exact clock feasibility", () => {
  expect(
    evaluateDayAvailability(
      { date: window.date, morning: { activities: [{ id: "walk" }] } },
      { ...window, earliestMinute: 600 },
    ).unknowns,
  ).toEqual(["availability_clock_times_unverified:morning"]);
});
test("reference windows reject invalid dates, duplicate dates and impossible bounds", () => {
  for (const windows of [
    [window, window],
    [{ ...window, date: "2027-01-12" }],
    [{ ...window, latestMinute: 1080 }],
    [{ ...window, earliestMinute: -1 }],
    [{ ...window, latestMinute: 1500 }],
  ])
    expect(() => validateDayAvailability(windows, [window.date])).toThrow();
  expect(() => validateDayAvailability([window], [window.date])).not.toThrow();
});

import { dayTimingBasis } from "../../packages/types/src/day-timing";
test("valid proposed clock times are checked against the reference window", () => {
  const day: Record<string, unknown> = {
    date: window.date,
    morning: {
      activities: [{ id: "walk", name: "Walk", duration: 60 }],
      meal: { id: "cafe", name: "Cafe" },
    },
    afternoon: { activities: [] },
    evening: { activities: [] },
  };
  day.timingProposal = {
    policy: "midday-rest-v1",
    basis: dayTimingBasis(day),
    fitsPolicy: true,
    verified: false,
    conflict: null,
    events: [
      {
        id: "meal:morning:cafe",
        kind: "meal",
        durationMinutes: 45,
        startMinute: 480,
        endMinute: 525,
        bufferBeforeMinutes: 0,
      },
      {
        id: "activity:walk",
        kind: "activity",
        durationMinutes: 60,
        startMinute: 555,
        endMinute: 615,
        bufferBeforeMinutes: 30,
      },
      {
        id: "rest:midday",
        kind: "rest",
        durationMinutes: 60,
        startMinute: 780,
        endMinute: 840,
        bufferBeforeMinutes: 0,
      },
    ],
  };
  expect(
    evaluateDayAvailability(day, { ...window, earliestMinute: 540 }).violations,
  ).toEqual(["event_outside_availability:meal:morning:cafe"]);
  expect(
    evaluateDayAvailability(day, { ...window, earliestMinute: 0 }).unknowns,
  ).toEqual([]);
  day.morning = { activities: [{ id: "walk", name: "Walk", duration: 90 }] };
  expect(
    evaluateDayAvailability(day, { ...window, earliestMinute: 540 }).unknowns,
  ).toEqual(["availability_clock_times_unverified:morning"]);
});
