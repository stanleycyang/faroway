import { describe, expect, it } from "vitest";
import { isValidDateOnly, isValidDateRange } from "@/lib/api/date-range";

describe("date-range helpers", () => {
  it("accepts real YYYY-MM-DD dates", () => {
    expect(isValidDateOnly("2026-06-01")).toBe(true);
  });

  it("rejects malformed or nonexistent dates", () => {
    expect(isValidDateOnly("06/01/2026")).toBe(false);
    expect(isValidDateOnly("2026-02-31")).toBe(false);
  });

  it("requires end date to be on or after start date", () => {
    expect(isValidDateRange("2026-06-01", "2026-06-01")).toBe(true);
    expect(isValidDateRange("2026-06-01", "2026-06-05")).toBe(true);
    expect(isValidDateRange("2026-06-05", "2026-06-01")).toBe(false);
  });
});
