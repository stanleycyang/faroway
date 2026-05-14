import { describe, expect, it } from "vitest";
import { normalizeDashboardTripStatus } from "@/components/dashboard/TripCard";

describe("normalizeDashboardTripStatus", () => {
  it("maps every trip lifecycle status to a dashboard display status", () => {
    const statuses = [
      "draft",
      "planning",
      "planned",
      "generating",
      "generated",
      "failed",
      "active",
      "in_progress",
      "booked",
      "paid",
      "completed",
      "canceled",
    ];

    for (const status of statuses) {
      expect(normalizeDashboardTripStatus(status)).toBeTruthy();
    }
  });

  it("keeps legacy complete and cancelled spellings from crashing the card", () => {
    expect(normalizeDashboardTripStatus("complete")).toBe("completed");
    expect(normalizeDashboardTripStatus("cancelled")).toBe("canceled");
  });
});
