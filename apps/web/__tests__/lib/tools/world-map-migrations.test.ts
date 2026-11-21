import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  migrate,
  migrateAndSanitize,
  migrateAndSanitizeProfile,
  CURRENT_SCHEMA_VERSION,
  LIMITS,
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

  it("survives null or non-object v1 visits without throwing", () => {
    const result = migrate({
      schemaVersion: 1,
      activeProfileId: "p1",
      profiles: [
        {
          id: "p1",
          name: "Test",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          visits: {
            FRA: null,
            JPN: { iso: "JPN", status: "visited" },
          },
        },
      ],
    });
    expect(result.profiles[0].visits.FRA).toBeUndefined();
    expect(result.profiles[0].visits.JPN.status).toBe("visited");
  });
});

describe("migrateAndSanitize", () => {
  it("strips invalid ISOs, non-object visits, invalid photoDataUrls, and caps string lengths", () => {
    const validPhoto = "data:image/jpeg;base64,AAAA==";
    const rawJson = JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        activeProfileId: "a",
        profiles: [
          {
            id: "a",
            name: "x".repeat(LIMITS.name + 50),
            visits: {
              FRA: null,
              ZZZ: { iso: "ZZZ", status: "visited" },
              ARG: { iso: "ARG", status: "wishlist" },
              JPN: {
                iso: "JPN",
                status: "visited",
                pinnedCity: "c".repeat(LIMITS.city + 25),
                notes: "n".repeat(LIMITS.notes + 25),
                visitCount: 2.9,
                rating: 5,
                photoDataUrl: validPhoto,
              },
              ITA: {
                iso: "ITA",
                status: "visited",
                photoDataUrl: "https://evil.example/tracker.png",
              },
              DEU: {
                iso: "DEU",
                status: "visited",
                photoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
              },
            },
          },
          { id: 123, name: "Bad ID", visits: {} },
        ],
      }),
    );
    // Inject an own "__proto__" key the same way JSON.parse does for malicious input.
    Object.defineProperty(rawJson.profiles[0].visits, "__proto__", {
      value: { iso: "__proto__", status: "visited" },
      enumerable: true,
      configurable: true,
    });
    const state = migrateAndSanitize(rawJson);

    expect(state.profiles).toHaveLength(1);
    const p = state.profiles[0];
    expect(p.name.length).toBe(LIMITS.name);
    expect(p.visits.FRA).toBeUndefined();
    expect(p.visits.ZZZ).toBeUndefined();
    expect(Object.hasOwn(p.visits, "__proto__")).toBe(false);
    expect(p.visits.ARG).toBeUndefined();
    expect(p.visits.JPN.pinnedCity?.length).toBe(LIMITS.city);
    expect(p.visits.JPN.notes?.length).toBe(LIMITS.notes);
    expect(p.visits.JPN.visitCount).toBe(2);
    expect(p.visits.JPN.photoDataUrl).toBe(validPhoto);
    expect(p.visits.ITA.photoDataUrl).toBeUndefined();
    expect(p.visits.DEU.photoDataUrl).toBeUndefined();
  });

  it("migrates and sanitizes a single-profile backup including v1 wishlist removal", () => {
    const profile = migrateAndSanitizeProfile({
      id: "solo",
      name: "Solo",
      visits: {
        ARG: { iso: "ARG", status: "wishlist" },
        FRA: null,
        JPN: { iso: "JPN", status: "lived", pinnedCity: "Kyoto" },
      },
    });
    expect(profile).not.toBeNull();
    expect(profile?.visits.ARG).toBeUndefined();
    expect(profile?.visits.FRA).toBeUndefined();
    expect(profile?.visits.JPN.status).toBe("visited");
    expect(profile?.visits.JPN.pinnedCity).toBe("Kyoto");
  });
});
