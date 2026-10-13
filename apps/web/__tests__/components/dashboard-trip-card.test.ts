import { describe, expect, it } from "vitest";
import {
  normalizeDashboardTripStatus,
  toDashboardTripStatus,
} from "@/components/dashboard/TripCard";

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

it("keeps interrupted and canceled journeys distinct from ready plans", () => {
  expect(toDashboardTripStatus("failed")).toBe("failed");
  expect(toDashboardTripStatus("cancelled")).toBe("canceled");
  expect(toDashboardTripStatus("planned")).toBe("complete");
  expect(toDashboardTripStatus("pending")).toBe("generating");
  expect(toDashboardTripStatus("unknown-future-state")).toBe("draft");
});
