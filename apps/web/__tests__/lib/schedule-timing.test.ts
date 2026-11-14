import {
  readDayTiming,
  dayTimingTips,
  timingPresentation,
} from "@faroway/types";
import { expect, it } from "vitest";
import {
  proposeDayTiming,
  requestsMiddayRest,
  proposeRestDayTiming,
} from "@/lib/search/schedule-timing";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";
import type { SuggestedDay, ActivityResult } from "@/lib/search/types";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
const activity = (rome.trace.steps[2].output as unknown as ActivityResult[])[0];
const day: SuggestedDay = {
  dayNumber: 1,
  date: "2027-01-11",
  title: "Test",
  summary: "Test",
  tips: [],
  morning: { activities: [{ ...activity, id: "visit", duration: 180 }] },
  afternoon: { activities: [{ ...activity, id: "museum", duration: 90 }] },
  evening: { activities: [] },
};

it.each([
  "Short walks and a midday rest every day",
  "Include a daily midday rest",
  "Need a midday rest",
])("recognizes an explicit rest instruction: %s", (mobilityNeeds) => {
  expect(requestsMiddayRest({ mobilityNeeds })).toBe(true);
});
it.each([
  "No midday rest every day",
  "Do not schedule a midday rest",
  "Skip midday rest every day",
  "No need for a midday rest every day",
  "Midday rest is optional",
  "Frequent breaks",
  "Midday rest information",
])("does not infer a daily rest block from %s", (mobilityNeeds) => {
  expect(requestsMiddayRest({ mobilityNeeds })).toBe(false);
});
it("preserves visits and exposes a non-overlapping suggested rest with assumptions", () => {
  const before = JSON.stringify(day);
  const result = proposeRestDayTiming(day);
  expect(result.fitsPolicy).toBe(true);
  expect(result.verified).toBe(false);
  expect(result.events.filter((e) => e.kind === "rest")).toHaveLength(1);
  expect(
    result.events
      .filter((e) => e.kind === "activity")
      .map((e) => e.durationMinutes),
  ).toEqual([180, 90]);
  for (let i = 1; i < result.events.length; i++)
    expect(result.events[i].startMinute).toBeGreaterThanOrEqual(
      result.events[i - 1].endMinute + result.events[i].bufferBeforeMinutes,
    );
  expect(result.tips.join(" ")).toContain(
    "hotel return needs separate travel time",
  );
  expect(JSON.stringify(day)).toBe(before);
  const mapped = mapSearchResultsToItinerary(
    {
      searchId: "timing",
      hotels: [],
      activities: [],
      dining: [],
      transport: [],
      itinerary: [{ ...day, tips: result.tips }],
    },
    null,
  );
  expect(mapped.days[0].tips).toEqual(result.tips);
});
it("shows a conflict without a partial timetable or silently dropping visits", () => {
  const overloaded = {
    ...day,
    morning: { activities: [{ ...activity, id: "long", duration: 300 }] },
  };
  const before = JSON.stringify(overloaded);
  const result = proposeRestDayTiming(overloaded);
  expect(result.fitsPolicy).toBe(false);
  expect(result.events).toEqual([]);
  expect(result.tips.join(" ")).toContain("rest request remains unresolved");
  expect(JSON.stringify(overloaded)).toBe(before);
});

it("does not present a midday rest overlapping an explicit work block as feasible", () => {
  const result = proposeRestDayTiming(day, {
    earliestMinute: 0,
    latestMinute: 1440,
    unavailable: [[780, 900]],
  });
  expect(result.fitsPolicy).toBe(false);
  expect(result.events).toEqual([]);
  expect(result.conflict?.eventId).toBe("rest:midday");
});

const dinner = {
  ...(
    rome.trace.steps[3]
      .output as unknown as import("@/lib/search/types").DiningResult[]
  )[0],
  id: "dinner",
};
it.each([120, 180, 240])(
  "detects dinner conflicts after a %i-minute evening visit without shortening it",
  (duration) => {
    const input: SuggestedDay = {
      ...day,
      morning: { activities: [] },
      afternoon: { activities: [] },
      evening: {
        activities: [{ ...activity, id: "evening", duration }],
        meal: dinner,
      },
    };
    const before = JSON.stringify(input);
    const result = proposeDayTiming(input);
    expect(result.policy).toBe("day-timing-v1");
    expect(result.fitsPolicy).toBe(duration === 120);
    expect(result.verified).toBe(false);
    expect(JSON.stringify(input)).toBe(before);
    expect(readDayTiming({ ...input, timingProposal: result })).toBeDefined();
    if (duration > 120) {
      expect(result.events).toEqual([]);
      expect(result.conflict?.eventId).toBe("meal:evening:dinner");
      expect(timingPresentation(result, {}).description).not.toContain(
        "midday-rest",
      );
    } else {
      expect(result.events.map((e) => [e.startMinute, e.endMinute])).toEqual([
        [1080, 1200],
        [1230, 1290],
      ]);
    }
  },
);
it("keeps ordinary timing inside work and departure constraints and invalidates it after edits", () => {
  const input: SuggestedDay = {
    ...day,
    morning: { activities: [] },
    afternoon: { activities: [] },
    evening: {
      activities: [{ ...activity, id: "evening", duration: 60 }],
      meal: dinner,
    },
  };
  const result = proposeDayTiming(input, {
    earliestMinute: 0,
    latestMinute: 1320,
    unavailable: [[540, 1140]],
  });
  expect(result.fitsPolicy).toBe(true);
  expect(result.events.map((e) => e.startMinute)).toEqual([1140, 1230]);
  expect(result.events.some((e) => e.kind === "rest")).toBe(false);
  expect(timingPresentation(result, {}).assumptions).not.toContain(
    "One-hour rest",
  );
  expect(
    proposeDayTiming(input, {
      earliestMinute: 0,
      latestMinute: 1260,
      unavailable: [[540, 1140]],
    }).fitsPolicy,
  ).toBe(false);
  const edited = {
    ...input,
    date: "2027-01-12",
    timingProposal: result,
    tips: result.tips,
  };
  expect(readDayTiming(edited)).toBeUndefined();
  expect(dayTimingTips(edited)).toEqual([
    "Proposed times need a fresh review.",
  ]);
});
