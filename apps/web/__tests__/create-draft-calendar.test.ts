import { expect, test } from "vitest";
import { parseCreateDraftDate } from "../lib/create-draft";

test("date-only draft keeps its local calendar day", () => {
  const date = parseCreateDraftDate("2026-11-01")!;
  expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
    2026, 10, 1,
  ]);
});
test.each(["2026-02-30", "not a date", "", 42, null])(
  "invalid draft date is ignored: %j",
  (value) => {
    expect(parseCreateDraftDate(value)).toBeUndefined();
  },
);
test("legacy ISO timestamp remains readable", () => {
  expect(parseCreateDraftDate("2026-11-01T07:00:00.000Z")?.toISOString()).toBe(
    "2026-11-01T07:00:00.000Z",
  );
});
