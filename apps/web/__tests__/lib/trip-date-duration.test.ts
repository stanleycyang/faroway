import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getTripDuration,
  parseTripDate,
  formatTripDate,
} from "@/lib/trips/date-duration";

describe("calendar trip duration", () => {
  beforeAll(() => vi.stubEnv("TZ", "America/Los_Angeles"));
  afterAll(() => vi.unstubAllEnvs());
  it("keeps saved date-only values on their chosen local calendar dates", () => {
    expect(formatTripDate("2026-11-01")).toBe("Nov 1, 2026");
    expect(formatTripDate("2026-11-04")).toBe("Nov 4, 2026");
    expect(
      getTripDuration(parseTripDate("2026-11-01"), parseTripDate("2026-11-04")),
    ).toBe(4);
  });
  it("does not add a day across the fall DST change", () => {
    expect(
      getTripDuration(
        new Date("2026-11-01T00:00:00-07:00"),
        new Date("2026-11-04T00:00:00-08:00"),
      ),
    ).toBe(4);
  });
  it("counts calendar days across the spring DST change", () => {
    expect(
      getTripDuration(
        new Date("2026-03-07T00:00:00-08:00"),
        new Date("2026-03-10T00:00:00-07:00"),
      ),
    ).toBe(4);
  });
  it("does not let time-of-day add an extra date", () => {
    expect(
      getTripDuration(
        new Date("2026-11-02T09:00:00-08:00"),
        new Date("2026-11-05T17:00:00-08:00"),
      ),
    ).toBe(4);
  });
  it("counts both endpoints and leap days", () => {
    expect(getTripDuration(new Date(2028, 1, 28), new Date(2028, 2, 1))).toBe(
      3,
    );
    expect(getTripDuration(new Date(2026, 10, 1), new Date(2026, 10, 1))).toBe(
      1,
    );
  });
  it("has no duration for missing, invalid or reversed dates", () => {
    expect(getTripDuration()).toBeNull();
    expect(getTripDuration(new Date("invalid"), new Date())).toBeNull();
    expect(
      getTripDuration(new Date(2026, 10, 4), new Date(2026, 10, 1)),
    ).toBeNull();
  });
});
