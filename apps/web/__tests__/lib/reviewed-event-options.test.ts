import { expect, it } from "vitest";
import {
  appendReviewedEventOptions,
  type ReviewedEventOption,
} from "@/lib/search/reviewed-event-options";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import optionsJson from "../../../../scripts/fixtures/reviewed-event-options.json";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import type { SearchPlan, ActivityResult } from "@/lib/search/types";
const plan = {
  ...rome.trace.steps[0].output,
  destination: "New York, USA",
  dates: { start: "2027-01-12", end: "2027-01-12", nights: 0 },
} as SearchPlan;
const generic = {
  ...(rome.trace.steps[2].output as unknown as ActivityResult[])[0],
  name: "Performance at Carnegie Hall",
  id: "generic",
};
const museum = { ...generic, name: "Museum", id: "museum", duration: 60 };
const days = compileSchedule(plan, [generic, museum], []).days;
const options = optionsJson as ReviewedEventOption[];
const append = (source = options, when = "2026-11-01") =>
  appendReviewedEventOptions(plan, days, [generic], source, when);
it("adds only the matching dated source lead without selecting an event or mutating input", () => {
  const original = structuredClone(days);
  const output = append();
  expect(
    output[0].tips.filter((t) => t.startsWith("Published event")),
  ).toHaveLength(1);
  expect(output[0].tips.join(" ")).toContain("2027-01-12, 19:00 local");
  expect(output[0].tips.join(" ")).toContain("not scheduled");
  expect(output[0].tips.join(" ")).toContain(
    "duration and ticket availability remain unverified",
  );
  const withoutTips = (value: typeof days) =>
    value.map((day) => ({ ...day, tips: [] }));
  expect(withoutTips(output)).toEqual(withoutTips(days));
  expect(days).toEqual(original);
  expect(
    appendReviewedEventOptions(plan, output, [generic], options, "2026-11-01"),
  ).toEqual(output);
});
it("does not suggest stale, future-reviewed, cancelled, postponed or unapproved-source leads", () => {
  for (const when of ["2026-10-31", "2026-12-02"])
    expect(append(options, when)).toEqual(days);
  for (const patch of [
    { status: "cancelled" },
    { status: "postponed" },
    { sourceUrl: "https://user:password@example.com" },
    { localDate: "2027-01-13" },
    { localTime: "25:00" },
    { startDate: "2027-01-12T19:00:00" },
  ]) {
    const changed = options.map((option) => ({
      ...option,
      event: { ...option.event, ...patch },
    })) as ReviewedEventOption[];
    expect(append(changed)).toEqual(days);
  }
});
it("requires matching destination and an explicitly deferred candidate", () => {
  expect(
    appendReviewedEventOptions(
      { ...plan, destination: "Tokyo, Japan" },
      days,
      [generic],
      options,
      "2026-11-01",
    ),
  ).toEqual(days);
  expect(
    appendReviewedEventOptions(plan, days, [], options, "2026-11-01"),
  ).toEqual(days);
  expect(
    appendReviewedEventOptions(
      plan,
      days,
      [{ ...generic, name: "Tour of Carnegie Hall" }],
      options,
      "2026-11-01",
    ),
  ).toEqual(days);
});

it("does not offer an event that starts before the declared arrival", () => {
  expect(
    appendReviewedEventOptions(
      { ...plan, mobilityNeeds: "Arrive on the first day at 20:00" },
      days,
      [generic],
      options,
      "2026-11-01",
    ),
  ).toEqual(days);
});
