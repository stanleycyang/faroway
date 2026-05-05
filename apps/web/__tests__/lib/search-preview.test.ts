import { describe, expect, it } from "vitest";
import { buildInstantPreview } from "@/lib/search/preview";

describe("buildInstantPreview", () => {
  it("creates one preview day per calendar day", () => {
    const preview = buildInstantPreview({
      destination: "Tokyo",
      startDate: "2026-05-10",
      endDate: "2026-05-14",
      travelers: 2,
      vibes: ["foodie", "cultural"],
    });

    expect(preview).toHaveLength(5);
    expect(preview[0].dayNumber).toBe(1);
    expect(preview[4].dayNumber).toBe(5);
    expect(preview[0].title.toLowerCase()).toContain("foodie");
  });

  it("returns stable core shape for loader rendering", () => {
    const preview = buildInstantPreview({
      destination: "Lisbon",
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      travelers: 1,
      vibes: [],
    });

    expect(preview).toHaveLength(1);
    expect(preview[0].morning.activities).toEqual([]);
    expect(preview[0].afternoon.activities).toEqual([]);
    expect(preview[0].evening.activities).toEqual([]);
    expect(preview[0].totalEstimatedCost?.currency).toBe("USD");
  });
});
