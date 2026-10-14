import { expect, test } from "vitest";
import { tripDatePhase, localCalendarDate } from "../src/trip-dates";

test.each([
  ["2026-11-01", "2026-11-04", "upcoming"],
  ["2026-10-13", "2026-10-16", "in-progress"],
  ["2026-10-10", "2026-10-13", "in-progress"],
  ["2026-10-01", "2026-10-12", "past"],
  ["2026-02-30", "2026-11-04", "unknown"],
  ["2026-11-04", "2026-11-01", "unknown"],
  ["", "", "unknown"],
])(
  "calendar range %s–%s is %s independent of plan status",
  (start, end, phase) => {
    expect(tripDatePhase(start, end, "2026-10-13")).toBe(phase);
  },
);
test.each([0, 23])("device today follows its local calendar near midnight at hour %s", hour => {
  const now = new Date(2026, 9, 13, hour, hour === 0 ? 1 : 59);
  expect(localCalendarDate(now)).toBe("2026-10-13");
});
