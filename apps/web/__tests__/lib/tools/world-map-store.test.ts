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
    it("keeps existing visit data when overlapping, adds new visits, and does not double visitCount", () => {
      useWorldMapStore.getState().createProfile("Test");
      const store = useWorldMapStore.getState();
      store.upsertVisit("JPN", { pinnedCity: "Kyoto", visitCount: 3 });

      const incoming = {
        id: "incoming",
        name: "Other",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        visits: {
          JPN: {
            iso: "JPN",
            status: "visited" as const,
            pinnedCity: "Tokyo",
            visitCount: 3,
          },
          FRA: { iso: "FRA", status: "visited" as const, visitCount: 2 },
        },
      };
      store.mergeProfile(incoming, "merge");

      const visits = useWorldMapStore.getState().profiles[0].visits;
      // Existing JPN data wins on overlap without doubling visitCount.
      expect(visits.JPN.pinnedCity).toBe("Kyoto");
      expect(visits.JPN.visitCount).toBe(3);
      // New FRA keeps its incoming visitCount.
      expect(visits.FRA.status).toBe("visited");
      expect(visits.FRA.visitCount).toBe(2);
    });
  });

  describe("mergeProfiles", () => {
    it("adds incoming profiles that don't already exist and does not double visitCount on matching profile IDs", () => {
      const myId = useWorldMapStore.getState().createProfile("Me");
      const store = useWorldMapStore.getState();
      store.upsertVisit("JPN", { visitCount: 4 });
      store.mergeProfiles(
        [
          {
            id: myId,
            name: "Me",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            visits: {
              JPN: { iso: "JPN", status: "visited", visitCount: 4 },
              ITA: { iso: "ITA", status: "visited", visitCount: 2 },
            },
          },
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
      const me = profiles.find((p) => p.id === myId)!;
      expect(me.visits.JPN.visitCount).toBe(4);
      expect(me.visits.ITA.visitCount).toBe(2);
    });
  });

  describe("replaceAll", () => {
    it("runs incoming state through migration and sanitization", () => {
      const store = useWorldMapStore.getState();
      store.replaceAll({
        schemaVersion: 2,
        profiles: [
          {
            id: "imported",
            name: "Imported",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            visits: {
              FRA: null as unknown as { iso: string; status: "visited" },
              ZZZ: { iso: "ZZZ", status: "visited" },
              JPN: {
                iso: "JPN",
                status: "visited",
                photoDataUrl: "https://tracker.invalid/pixel.png",
              },
            },
          },
        ],
        activeProfileId: "imported",
        settings: {},
      });
      const state = useWorldMapStore.getState();
      expect(state.profiles[0].name).toBe("Imported");
      expect(state.activeProfileId).toBe("imported");
      expect(state.profiles[0].visits.FRA).toBeUndefined();
      expect(state.profiles[0].visits.ZZZ).toBeUndefined();
      expect(state.profiles[0].visits.JPN.photoDataUrl).toBeUndefined();
    });
  });

  describe("storage resilience & hydration", () => {
    it("hydrates cleanly when window.localStorage access throws", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const badWindow = {};
      Object.defineProperty(badWindow, "localStorage", {
        get() {
          throw new DOMException("SecurityError", "SecurityError");
        },
      });
      vi.stubGlobal("window", badWindow);
      try {
        useWorldMapStore.setState({ hasHydrated: false });
        await useWorldMapStore.persist.rehydrate();
        expect(useWorldMapStore.getState().hasHydrated).toBe(true);
      } finally {
        vi.stubGlobal("window", undefined);
        warn.mockRestore();
      }
    });

    it("hydrates cleanly when persisted JSON is corrupt", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("window", {
        localStorage: {
          getItem: () => "{not valid json",
          setItem: () => {},
          removeItem: () => {},
        },
      });
      try {
        useWorldMapStore.setState({ hasHydrated: false });
        await useWorldMapStore.persist.rehydrate();
        expect(useWorldMapStore.getState().hasHydrated).toBe(true);
      } finally {
        vi.stubGlobal("window", undefined);
        warn.mockRestore();
      }
    });

    it("catches QuotaExceededError on setItem, sets persistError, and clears it on next successful save", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      let shouldThrow = true;
      vi.stubGlobal("window", {
        localStorage: {
          getItem: () => null,
          setItem: () => {
            if (shouldThrow) {
              throw new DOMException("Quota exceeded", "QuotaExceededError");
            }
          },
          removeItem: () => {},
        },
      });
      try {
        useWorldMapStore.getState().createProfile("Test");
        expect(useWorldMapStore.getState().persistError).toContain("full");

        // Dismissing the banner should clear persistError without re-triggering storage.
        useWorldMapStore.getState().clearPersistError();
        expect(useWorldMapStore.getState().persistError).toBeNull();

        // Another failed write sets persistError again without throwing.
        expect(() =>
          useWorldMapStore.getState().toggleVisited("JPN"),
        ).not.toThrow();
        expect(useWorldMapStore.getState().persistError).toContain("full");

        // Once space is freed, the next write clears persistError automatically.
        shouldThrow = false;
        useWorldMapStore.getState().toggleVisited("FRA");
        expect(useWorldMapStore.getState().persistError).toBeNull();
      } finally {
        vi.stubGlobal("window", undefined);
        useWorldMapStore.getState().clearPersistError();
        warn.mockRestore();
      }
    });
  });
});
