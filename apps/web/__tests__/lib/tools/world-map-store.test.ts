import { describe, it, expect, beforeEach, vi } from "vitest";

// Zustand persists to window.localStorage. The store checks
// `typeof window === "undefined"` and short-circuits when true, so by leaving
// `window` undefined here we exercise the non-persisted code path while still
// testing all the business logic.
vi.stubGlobal("window", undefined);

const { useWorldMapStore } = await import("@/lib/tools/world-map/store");

function resetStore() {
  useWorldMapStore.setState({
    schemaVersion: 2,
    profiles: [],
    activeProfileId: "",
    settings: {},
    hasHydrated: true,
  });
}

describe("useWorldMapStore", () => {
  beforeEach(resetStore);

  describe("toggleVisited", () => {
    it("first click on an empty country pins it as visited", () => {
      const pid = useWorldMapStore.getState().createProfile("Test", "🌍");
      expect(pid).toBeTruthy();
      useWorldMapStore.getState().toggleVisited("JPN");
      const profile = useWorldMapStore
        .getState()
        .profiles.find((p) => p.id === pid);
      expect(profile?.visits.JPN.status).toBe("visited");
    });

    it("second click clears the pin", () => {
      useWorldMapStore.getState().createProfile("Test");
      const store = useWorldMapStore.getState();
      store.toggleVisited("JPN");
      expect(useWorldMapStore.getState().profiles[0].visits.JPN.status).toBe(
        "visited",
      );
      store.toggleVisited("JPN");
      expect(
        useWorldMapStore.getState().profiles[0].visits.JPN,
      ).toBeUndefined();
    });

    it("bumps the profile's updatedAt on each toggle", async () => {
      useWorldMapStore.getState().createProfile("Test");
      const before = useWorldMapStore.getState().profiles[0].updatedAt;
      // Sleep a tick so ISO timestamps differ.
      await new Promise((r) => setTimeout(r, 2));
      useWorldMapStore.getState().toggleVisited("JPN");
      const after = useWorldMapStore.getState().profiles[0].updatedAt;
      expect(after).not.toBe(before);
    });
  });

  describe("upsertVisit", () => {
    it("preserves existing fields on partial patch", () => {
      useWorldMapStore.getState().createProfile("Test");
      const store = useWorldMapStore.getState();
      store.upsertVisit("JPN", {
        pinnedCity: "Kyoto",
        rating: 5,
      });
      store.upsertVisit("JPN", { notes: "Spring trip" });
      const visit = useWorldMapStore.getState().profiles[0].visits.JPN;
      expect(visit.status).toBe("visited");
      expect(visit.pinnedCity).toBe("Kyoto");
      expect(visit.rating).toBe(5);
      expect(visit.notes).toBe("Spring trip");
    });
  });

  describe("mergeProfile merge mode", () => {
    it("keeps existing visit data when overlapping, adds new visits", () => {
      useWorldMapStore.getState().createProfile("Test");
      const store = useWorldMapStore.getState();
      store.upsertVisit("JPN", { pinnedCity: "Kyoto" });

      const incoming = {
        id: "incoming",
        name: "Other",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        visits: {
          JPN: { iso: "JPN", status: "visited" as const, pinnedCity: "Tokyo" },
          FRA: { iso: "FRA", status: "visited" as const },
        },
      };
      store.mergeProfile(incoming, "merge");

      const visits = useWorldMapStore.getState().profiles[0].visits;
      // Existing JPN data wins on overlap.
      expect(visits.JPN.pinnedCity).toBe("Kyoto");
      // New FRA is added.
      expect(visits.FRA.status).toBe("visited");
    });
  });

  describe("mergeProfiles", () => {
    it("adds incoming profiles that don't already exist", () => {
      useWorldMapStore.getState().createProfile("Me");
      const store = useWorldMapStore.getState();
      store.mergeProfiles(
        [
          {
            id: "wife",
            name: "Wife",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            visits: { JPN: { iso: "JPN", status: "visited" } },
          },
        ],
        "merge",
      );
      const profiles = useWorldMapStore.getState().profiles;
      expect(profiles).toHaveLength(2);
      expect(profiles.some((p) => p.name === "Wife")).toBe(true);
    });
  });

  describe("replaceAll", () => {
    it("runs incoming state through migration", () => {
      const store = useWorldMapStore.getState();
      store.replaceAll({
        schemaVersion: 2,
        profiles: [
          {
            id: "imported",
            name: "Imported",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            visits: {},
          },
        ],
        activeProfileId: "imported",
        settings: {},
      });
      expect(useWorldMapStore.getState().profiles[0].name).toBe("Imported");
      expect(useWorldMapStore.getState().activeProfileId).toBe("imported");
    });
  });
});
