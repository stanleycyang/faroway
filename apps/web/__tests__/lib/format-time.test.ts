import { describe, expect, it } from "vitest";
import {
  formatTravelTime,
  formatTripDate,
  getTripDuration,
} from "@/lib/trips/format-time";

describe("formatTravelTime", () => {
  it("preserves the provider-local clock from offset timestamps", () => {
    expect(formatTravelTime("2026-12-20T08:45:00-05:00")).toBe("08:45 AM");
    expect(formatTravelTime("2026-12-20T19:05:00+09:00")).toBe("07:05 PM");
  });

  it("formats UTC and timezone-less ISO timestamps deterministically", () => {
    expect(formatTravelTime("2026-12-20T00:15:00Z")).toBe("12:15 AM");
    expect(formatTravelTime("2026-12-20T12:30:00")).toBe("12:30 PM");
  });

  it("returns a safe placeholder for invalid input", () => {
    expect(formatTravelTime("not-a-date")).toBe("—");
  });
});

describe("date-only trip formatting", () => {
  it("does not shift dates across server or browser time zones", () => {
    expect(formatTripDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatTripDate("2026-01-03T23:30:00-10:00")).toBe("Jan 3, 2026");
    expect(getTripDuration("2026-01-01", "2026-01-03")).toBe(3);
  });

  it("handles malformed or reversed date ranges safely", () => {
    expect(formatTripDate("2026-02-30")).toBe("—");
    expect(getTripDuration("2026-01-03", "2026-01-01")).toBe(0);
  });
});
