import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TripBriefEditor } from "@/components/trips/TripBriefEditor";

vi.mock("@/lib/trips/hotel-quotes", () => ({
  hotelSearchEnabled: () => false,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TripBriefEditor flight supplier ordering", () => {
  it("places Duffel before LiteAPI in the flight supplier select and defaults to duffel", async () => {
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripBriefEditor
            trip={{
              id: "trip-1",
              user_id: "user-1",
              destination: "Tokyo",
              start_date: "2026-11-01",
              end_date: "2026-11-05",
              travelers: 2,
              budget_tier: "moderate",
              status: "completed",
              vibes: ["culture"],
              preferences: {},
              created_at: "2026-10-01T00:00:00Z",
              updated_at: "2026-10-01T00:00:00Z",
              is_shared: false,
              share_token: null,
            }}
            onReload={vi.fn()}
            onSaved={vi.fn()}
          />,
        );
      });

      const supplierSelect = renderer.root
        .findAllByType("select")
        .find((node) =>
          node
            .findAllByType("option")
            .some((opt) => opt.props.value === "duffel"),
        );

      expect(supplierSelect).toBeDefined();
      expect(supplierSelect!.props.value).toBe("duffel");

      const optionValues = supplierSelect!
        .findAllByType("option")
        .map((opt) => opt.props.value);
      expect(optionValues.indexOf("duffel")).toBeGreaterThanOrEqual(0);
      expect(optionValues.indexOf("liteapi")).toBeGreaterThan(
        optionValues.indexOf("duffel"),
      );
    } finally {
      await act(async () => renderer?.unmount());
    }
  });
});
