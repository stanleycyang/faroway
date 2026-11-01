import { expect, it } from "vitest";
import {
  dayTimingBasis,
  readDayTiming,
  dayTimingTips,
  type DayTimingProposal,
} from "@faroway/types";
function fixture() {
  const day = {
    date: "2027-01-11",
    morning: { activities: [{ id: "walk", name: "Walk", duration: 60 }] },
    afternoon: { activities: [] },
    evening: { activities: [] },
    tips: [
      "Proposed local timing: 09:00 Walk; 13:00 Rest",
      "Keep your water bottle.",
    ],
  };
  const timingProposal: DayTimingProposal = {
    policy: "midday-rest-v1",
    basis: dayTimingBasis(day),
    fitsPolicy: true,
    verified: false,
    conflict: null,
    events: [
      {
        id: "activity:walk",
        kind: "activity",
        durationMinutes: 60,
        startMinute: 540,
        endMinute: 600,
        bufferBeforeMinutes: 0,
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
  return { ...day, timingProposal };
}
it("keeps a valid proposed schedule and rejects changes to date, visit, duration or meal", () => {
  expect(readDayTiming(fixture())?.verified).toBe(false);
  for (const mutate of [
    (d: ReturnType<typeof fixture>) => {
      d.date = "2027-01-12";
    },
    (d: ReturnType<typeof fixture>) => {
      d.morning.activities[0].duration = 90;
    },
    (d: ReturnType<typeof fixture>) => {
      d.morning.activities[0].id = "other";
    },
    (d: ReturnType<typeof fixture>) => {
      Object.assign(d.morning, { meal: { id: "cafe", name: "Cafe" } });
    },
  ]) {
    const day = fixture();
    mutate(day);
    expect(readDayTiming(day)).toBeUndefined();
    expect(dayTimingTips(day)).toEqual([
      "Proposed times need a fresh review.",
      "Keep your water bottle.",
    ]);
  }
});
it("rejects overlapping, out-of-window, missing and falsely verified events", () => {
  for (const mutate of [
    (p: DayTimingProposal) => {
      p.events[1].startMinute = 570;
      p.events[1].endMinute = 630;
    },
    (p: DayTimingProposal) => {
      p.events[0].startMinute = 0;
      p.events[0].endMinute = 60;
    },
    (p: DayTimingProposal) => {
      p.events.pop();
    },
    (p: DayTimingProposal) => {
      Object.assign(p, { verified: true });
    },
  ]) {
    const day = fixture();
    mutate(day.timingProposal);
    expect(readDayTiming(day)).toBeUndefined();
  }
});
it("conflicts never carry partial timetables", () => {
  const day = fixture();
  Object.assign(day.timingProposal, {
    fitsPolicy: false,
    conflict: { eventId: "activity:walk", overrunMinutes: 15 },
  });
  expect(readDayTiming(day)).toBeUndefined();
  day.timingProposal.events = [];
  expect(readDayTiming(day)?.fitsPolicy).toBe(false);
});
it("normalizes agent and saved meal shapes to the same basis", () => {
  const meal = { id: "cafe", name: "Cafe" };
  const day = fixture();
  expect(dayTimingBasis({ ...day, morning: { ...day.morning, meal } })).toBe(
    dayTimingBasis({ ...day, morning: { ...day.morning, meals: [meal] } }),
  );
});
