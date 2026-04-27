import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  migrate,
  CURRENT_SCHEMA_VERSION,
} from "@/lib/tools/world-map/migrations";

describe("migrate", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("is a no-op when the persisted schema matches current", () => {
    const state = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profiles: [],
      activeProfileId: "",
      settings: {},
    };
    const result = migrate(state);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.profiles).toEqual([]);
  });

  it("v1 → v2: drops wishlist entries and normalizes everything else", () => {
    const v1 = {
      schemaVersion: 1,
      activeProfileId: "p1",
      settings: { theme: "classic", showLegend: true, quickPin: false },
      profiles: [
        {
          id: "p1",
          name: "Test",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          visits: {
            JPN: {
              iso: "JPN",
              status: "lived",
              pinnedCity: "Kyoto",
              visitCount: 3,
            },
            FRA: { iso: "FRA", status: "visited" },
            DEU: { iso: "DEU", status: "day_trip" },
            ARG: { iso: "ARG", status: "wishlist" },
          },
        },
      ],
    };
    const result = migrate(v1);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const visits = result.profiles[0].visits;
    expect(visits.JPN.status).toBe("visited");
    expect(visits.JPN.pinnedCity).toBe("Kyoto");
    expect(visits.JPN.visitCount).toBe(3);
    expect(visits.FRA.status).toBe("visited");
    expect(visits.DEU.status).toBe("visited");
    // Wishlist entry is dropped — wasn't actually a place we'd been.
    expect(visits.ARG).toBeUndefined();
  });

  it("resets to an empty state for non-object input", () => {
    const result = migrate(null);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.profiles).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("resets to an empty state when the persisted version is unknown", () => {
    const result = migrate({ schemaVersion: 99, profiles: [] });
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(warn).toHaveBeenCalled();
  });
});
