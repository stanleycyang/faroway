import { describe, it, expect } from "vitest";
import {
  MILESTONES,
  MILESTONE_COPY,
  nextMilestoneCrossed,
} from "@/lib/tools/world-map/milestones";

describe("nextMilestoneCrossed", () => {
  it("returns the milestone exactly crossed", () => {
    expect(nextMilestoneCrossed(4, 5)).toBe(5);
    expect(nextMilestoneCrossed(9, 10)).toBe(10);
    expect(nextMilestoneCrossed(24, 25)).toBe(25);
    expect(nextMilestoneCrossed(49, 50)).toBe(50);
    expect(nextMilestoneCrossed(99, 100)).toBe(100);
  });

  it("returns null when no milestone was crossed", () => {
    expect(nextMilestoneCrossed(5, 6)).toBeNull();
    expect(nextMilestoneCrossed(10, 11)).toBeNull();
    expect(nextMilestoneCrossed(50, 99)).toBeNull();
  });

  it("returns null when count goes down (unpinning)", () => {
    expect(nextMilestoneCrossed(25, 24)).toBeNull();
    expect(nextMilestoneCrossed(10, 0)).toBeNull();
  });

  it("returns the highest milestone when jumping past several", () => {
    // Bulk import from 4 → 12 crosses both 5 and 10; we fire once at the top.
    expect(nextMilestoneCrossed(4, 12)).toBe(10);
    // 4 → 60 crosses 5, 10, 25, 50 → fire at 50.
    expect(nextMilestoneCrossed(4, 60)).toBe(50);
  });

  it("returns null for equal counts", () => {
    expect(nextMilestoneCrossed(5, 5)).toBeNull();
    expect(nextMilestoneCrossed(0, 0)).toBeNull();
  });
});

describe("milestone copy coverage", () => {
  it("has copy for every milestone", () => {
    for (const m of MILESTONES) {
      expect(MILESTONE_COPY[m]).toBeTruthy();
    }
  });
});
