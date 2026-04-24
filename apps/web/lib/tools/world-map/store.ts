"use client";

import { create, type StateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import { CURRENT_SCHEMA_VERSION, migrate } from "./migrations";
import type { AppState, AppSettings, CountryVisit, Profile } from "./types";

const STORAGE_KEY = "wm:app-state";

function createEmptyProfile(name: string, emoji?: string): Profile {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    name: name || "Traveler",
    emoji: emoji || "🌍",
    createdAt: now,
    updatedAt: now,
    visits: {},
  };
}

const DEFAULT_SETTINGS: AppSettings = {};

export interface WorldMapStore extends AppState {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // Profile ops
  createProfile: (name: string, emoji?: string) => string;
  renameProfile: (profileId: string, name: string, emoji?: string) => void;
  switchProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;

  // Visit ops (operate on active profile)
  upsertVisit: (iso: string, patch: Partial<CountryVisit>) => void;
  toggleVisited: (iso: string) => void;
  deleteVisit: (iso: string) => void;

  // Settings
  markBackupTaken: () => void;

  // Import
  mergeProfile: (profile: Profile, mode: "merge" | "replace") => void;
  mergeProfiles: (profiles: Profile[], mode: "merge" | "replace") => void;
  replaceAll: (state: AppState) => void;
}

function activeProfile(state: AppState): Profile | undefined {
  return state.profiles.find((p) => p.id === state.activeProfileId);
}

const creator: StateCreator<
  WorldMapStore,
  [["zustand/persist", unknown]],
  []
> = (set): WorldMapStore => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  profiles: [],
  activeProfileId: "",
  settings: { ...DEFAULT_SETTINGS },
  hasHydrated: false,

  setHasHydrated: (v) => set({ hasHydrated: v }),

  createProfile: (name, emoji) => {
    const profile = createEmptyProfile(name, emoji);
    set((s: WorldMapStore) => ({
      profiles: [...s.profiles, profile],
      activeProfileId: profile.id,
    }));
    return profile.id;
  },

  renameProfile: (profileId, name, emoji) => {
    set((s: WorldMapStore) => ({
      profiles: s.profiles.map((p) =>
        p.id === profileId
          ? {
              ...p,
              name: name || p.name,
              emoji: emoji ?? p.emoji,
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    }));
  },

  switchProfile: (profileId) => {
    set((s: WorldMapStore) =>
      s.profiles.some((p) => p.id === profileId)
        ? { activeProfileId: profileId }
        : {},
    );
  },

  deleteProfile: (profileId) => {
    set((s: WorldMapStore) => {
      const remaining = s.profiles.filter((p) => p.id !== profileId);
      if (remaining.length === 0) {
        const fresh = createEmptyProfile("Traveler", "🌍");
        return { profiles: [fresh], activeProfileId: fresh.id };
      }
      const activeId =
        s.activeProfileId === profileId ? remaining[0].id : s.activeProfileId;
      return { profiles: remaining, activeProfileId: activeId };
    });
  },

  upsertVisit: (iso, patch) => {
    set((s: WorldMapStore) => {
      const profile = activeProfile(s);
      if (!profile) return {};
      const existing = profile.visits[iso];
      const next: CountryVisit = {
        ...existing,
        ...patch,
        iso,
        status: "visited",
      };
      const nextProfile: Profile = {
        ...profile,
        updatedAt: new Date().toISOString(),
        visits: { ...profile.visits, [iso]: next },
      };
      return {
        profiles: s.profiles.map((p) =>
          p.id === profile.id ? nextProfile : p,
        ),
      };
    });
  },

  toggleVisited: (iso) => {
    set((s: WorldMapStore) => {
      const profile = activeProfile(s);
      if (!profile) return {};
      const nextVisits = { ...profile.visits };
      if (nextVisits[iso]) {
        delete nextVisits[iso];
      } else {
        nextVisits[iso] = { iso, status: "visited" };
      }
      return {
        profiles: s.profiles.map((p) =>
          p.id === profile.id
            ? {
                ...p,
                visits: nextVisits,
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      };
    });
  },

  deleteVisit: (iso) => {
    set((s: WorldMapStore) => {
      const profile = activeProfile(s);
      if (!profile) return {};
      const nextVisits = { ...profile.visits };
      delete nextVisits[iso];
      return {
        profiles: s.profiles.map((p) =>
          p.id === profile.id
            ? {
                ...p,
                visits: nextVisits,
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      };
    });
  },

  markBackupTaken: () =>
    set((s: WorldMapStore) => ({
      settings: { ...s.settings, lastBackupAt: new Date().toISOString() },
    })),

  mergeProfile: (incoming, mode) => {
    set((s: WorldMapStore) => {
      const profile = activeProfile(s);
      if (!profile) {
        return {
          profiles: [incoming],
          activeProfileId: incoming.id,
        };
      }
      if (mode === "replace") {
        const nextProfile: Profile = {
          ...profile,
          visits: incoming.visits,
          updatedAt: new Date().toISOString(),
        };
        return {
          profiles: s.profiles.map((p) =>
            p.id === profile.id ? nextProfile : p,
          ),
        };
      }
      const mergedVisits: Record<string, CountryVisit> = { ...profile.visits };
      for (const [iso, v] of Object.entries(incoming.visits)) {
        const existing = mergedVisits[iso];
        mergedVisits[iso] = {
          ...v,
          ...existing,
          visitCount:
            (existing?.visitCount ?? 0) + (v.visitCount ?? 0) || undefined,
        };
      }
      const nextProfile: Profile = {
        ...profile,
        visits: mergedVisits,
        updatedAt: new Date().toISOString(),
      };
      return {
        profiles: s.profiles.map((p) =>
          p.id === profile.id ? nextProfile : p,
        ),
      };
    });
  },

  mergeProfiles: (incoming, mode) => {
    if (incoming.length === 0) return;
    if (mode === "replace") {
      set({
        profiles: incoming,
        activeProfileId: incoming[0].id,
      });
      return;
    }
    set((s: WorldMapStore) => {
      const existingIds = new Set(s.profiles.map((p) => p.id));
      const toAdd = incoming.filter((p) => !existingIds.has(p.id));
      // For already-existing profile IDs, merge visits into them.
      const merged = s.profiles.map((p) => {
        const match = incoming.find((q) => q.id === p.id);
        if (!match) return p;
        const mergedVisits: Record<string, CountryVisit> = { ...p.visits };
        for (const [iso, v] of Object.entries(match.visits)) {
          const existing = mergedVisits[iso];
          mergedVisits[iso] = {
            ...v,
            ...existing,
            visitCount:
              (existing?.visitCount ?? 0) + (v.visitCount ?? 0) || undefined,
          };
        }
        return {
          ...p,
          visits: mergedVisits,
          updatedAt: new Date().toISOString(),
        };
      });
      return {
        profiles: [...merged, ...toAdd],
      };
    });
  },

  replaceAll: (state) => {
    // Run incoming state through the migration pipeline so older backups
    // don't strand users on stale schemas.
    const migrated = migrate(state);
    set({
      schemaVersion: migrated.schemaVersion,
      profiles: migrated.profiles,
      activeProfileId:
        migrated.activeProfileId &&
        migrated.profiles.some((p) => p.id === migrated.activeProfileId)
          ? migrated.activeProfileId
          : (migrated.profiles[0]?.id ?? ""),
      settings: { ...DEFAULT_SETTINGS, ...migrated.settings },
    });
  },
});

// In non-browser environments (SSR build, vitest node env) there is no
// window.localStorage — fall back to an in-memory shim so zustand's persist
// middleware doesn't crash on setItem.
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, String(v));
    },
  };
}

export const useWorldMapStore = create<WorldMapStore>()(
  persist(creator, {
    name: STORAGE_KEY,
    storage: createJSONStorage(() =>
      typeof window === "undefined" ? memoryStorage() : window.localStorage,
    ),
    version: CURRENT_SCHEMA_VERSION,
    migrate: (persisted) => migrate(persisted) as WorldMapStore,
    partialize: (state) => ({
      schemaVersion: state.schemaVersion,
      profiles: state.profiles,
      activeProfileId: state.activeProfileId,
      settings: state.settings,
    }),
    onRehydrateStorage: () => (state) => {
      state?.setHasHydrated(true);
    },
  }),
);

// Helper hook: the currently active profile.
export function useActiveProfile(): Profile | undefined {
  return useWorldMapStore((s: WorldMapStore) =>
    s.profiles.find((p) => p.id === s.activeProfileId),
  );
}

// Helper: snapshot AppState (without methods) for export.
export function getAppStateSnapshot(): AppState {
  const s = useWorldMapStore.getState();
  return {
    schemaVersion: s.schemaVersion,
    profiles: s.profiles,
    activeProfileId: s.activeProfileId,
    settings: s.settings,
  };
}
