import { expect, it } from "vitest";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import {
  applyScheduleNarration,
  narrationContext,
  type DayNarration,
} from "@/lib/search/schedule-narration";
import type { SuggestedDay } from "@/lib/search/types";
const days = (rome.trace.steps[4].output as unknown as { days: SuggestedDay[] })
  .days;
const entries = (): DayNarration[] =>
  days.map((d) => ({
    date: d.date,
    title: "A day of discovery",
    summary: "Explore the selected stops at your own pace.",
    activityIds: [
      ...d.morning.activities,
      ...d.afternoon.activities,
      ...d.evening.activities,
    ].map((a) => a.id),
  }));
it("changes only narration and preserves uncertainty tips and original objects", () => {
  const snapshot = structuredClone(days),
    result = applyScheduleNarration(days, entries());
  expect(days).toEqual(snapshot);
  expect(
    result.map((day) =>
      Object.fromEntries(
        Object.entries(day).filter(
          ([key]) => !["title", "summary"].includes(key),
        ),
      ),
    ),
  ).toEqual(
    days.map((day) =>
      Object.fromEntries(
        Object.entries(day).filter(
          ([key]) => !["title", "summary"].includes(key),
        ),
      ),
    ),
  );
  expect(result[0].title).toBe("A day of discovery");
  expect(result[0]).not.toBe(days[0]);
});
it("refuses invented, omitted and duplicated activity references", () => {
  for (const ids of [
    ["invented"],
    [],
    [...entries()[0].activityIds, entries()[0].activityIds[0]],
  ]) {
    const draft = entries();
    draft[0].activityIds = ids;
    expect(() => applyScheduleNarration(days, draft)).toThrow();
  }
});
it("refuses changed dates and incomplete or oversized narration", () => {
  for (const patch of [
    { date: "2099-01-01" },
    { title: " " },
    { summary: "" },
    { summary: "x".repeat(601) },
  ]) {
    const draft = entries();
    draft[0] = { ...draft[0], ...patch };
    expect(() => applyScheduleNarration(days, draft)).toThrow();
  }
  expect(() => applyScheduleNarration(days, [])).toThrow();
});
it("limits context to selected names and schedule fields, excluding generated descriptions", () => {
  const context = narrationContext(days);
  expect(JSON.stringify(context)).not.toContain('"description"');
  expect(context[0].slots[0].activities[0].id).toBe(
    days[0].morning.activities[0].id,
  );
});
