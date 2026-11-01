import { expect, it } from "vitest";
import {
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
