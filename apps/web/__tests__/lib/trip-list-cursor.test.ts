import { describe, expect, it } from "vitest";
import { readTripCursor, writeTripCursor } from "@/lib/trips/list-cursor";

describe("database timestamp pagination boundary", () => {
  it("preserves PostgreSQL microseconds so continuation does not skip older rows in the same millisecond", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const created_at = "2026-10-14T09:00:00.123456+00:00";
    expect(readTripCursor(writeTripCursor({ id, created_at }))).toEqual({
      id,
      createdAt: created_at,
    });
  });
});
