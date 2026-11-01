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
  narrationContext(days).map((d) => ({
    date: d.date,
    title: "A day of discovery",
    summary: "Explore the selected stops at your own pace.",
    activityIds: d.slots.flatMap((slot) => slot.activities.map((a) => a.id)),
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
it("rejects unverified suitability labels in titles and summaries", () => {
  for (const label of [
    "accessible",
    "wheelchair-friendly",
    "step free",
    "allergy-safe",
    "gluten-free",
    "vegan",
    "halal",
  ]) {
    for (const field of ["title", "summary"] as const) {
      const draft = entries();
      draft[0][field] = `Explore this ${label} tour.`;
      expect(() => applyScheduleNarration(days, draft)).toThrow(/suitability/);
    }
  }
});
it("limits context to selected names and schedule fields, excluding generated descriptions", () => {
  const context = narrationContext(days);
  expect(JSON.stringify(context)).not.toContain('"description"');
  expect(context[0].slots[0].activities[0].id).toBe("d1s1v1");
  expect(JSON.stringify(context)).not.toContain(
    days[0].morning.activities[0].id,
  );
});
it("binds compact references to their date and preserves long inventory IDs", () => {
  const input = [structuredClone(days[0]), structuredClone(days[0])];
  input[1].date = "2026-12-08";
  input.forEach((day, dayIndex) => {
    let index = 0;
    for (const slot of ["morning", "afternoon", "evening"] as const)
      for (const activity of day[slot].activities)
        activity.id = `activity_1793425034104_${dayIndex}_${index++}`;
  });
  const context = narrationContext(input);
  const updates = context.map((day) => ({
    date: day.date,
    title: "Selected visits",
    summary: "Explore the selected stops.",
    activityIds: day.slots.flatMap((slot) => slot.activities.map((a) => a.id)),
  }));
  const result = applyScheduleNarration(input, [...updates].reverse());
  expect(result[0].morning).toEqual(input[0].morning);
  expect(result[1].afternoon).toEqual(input[1].afternoon);
  const swapped = structuredClone(updates);
  [swapped[0].activityIds, swapped[1].activityIds] = [
    swapped[1].activityIds,
    swapped[0].activityIds,
  ];
  expect(() => applyScheduleNarration(input, swapped)).toThrow(/selection/);
  updates[0].activityIds[0] = input[0].morning.activities[0].id;
  expect(() => applyScheduleNarration(input, updates)).toThrow(/selection/);
});

it("uses traveler hours for empty constrained days without inventing availability", () => {
  const input = structuredClone(days);
  for (const slot of ["morning", "afternoon", "evening"] as const)
    input.at(-1)![slot].activities = [];
  const updates = narrationContext(input).map((day) => ({
    date: day.date,
    title: "A day of dining",
    summary: "Activities are available until 9am.",
    activityIds: day.slots.flatMap((slot) => slot.activities.map((a) => a.id)),
  }));
  const result = applyScheduleNarration(input, updates, {
    mobilityNeeds: "Depart on the final day at 09:00",
  });
  expect(result.at(-1)!.title).toBe("Limited time today");
  expect(result.at(-1)!.summary).toBe(
    "You're available until 09:00 local time. No visits are planned; confirm transfer time before keeping any suggested meals.",
  );
  expect(result.at(-1)!.morning).toEqual(input.at(-1)!.morning);
  expect(result.at(-1)!.tips).toEqual(input.at(-1)!.tips);
  expect(applyScheduleNarration(input, updates).at(-1)!.title).toBe(
    "A day of dining",
  );
  // Conflicting instructions must not become apparently settled narration.
  const oneDay = [input.at(-1)!];
  expect(
    applyScheduleNarration(oneDay, [updates.at(-1)!], {
      mobilityNeeds:
        "Arrive on the first day at 18:00; depart on the final day at 09:00",
    })[0].title,
  ).toBe("A day of dining");
  const arrival = applyScheduleNarration(oneDay, [updates.at(-1)!], {
    mobilityNeeds: "Arrive on the first day at 23:00",
  });
  expect(arrival[0].summary).toContain("from 23:00 local time");
});
