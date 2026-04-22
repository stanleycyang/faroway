"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import { CURRENT_SCHEMA_VERSION, migrate } from "./migrations";
import type {
  AppState,
  AppSettings,
  CountryVisit,
  Profile,
  Theme,
} from "./types";

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

const DEFAULT_SETTINGS: AppSettings = {
  theme: "classic",
  showLegend: true,
  quickPin: false,
};

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
  cycleStatus: (iso: string) => void;
  deleteVisit: (iso: string) => void;

  // Settings
  setTheme: (t: Theme) => void;
  setShowLegend: (v: boolean) => void;
  setQuickPin: (v: boolean) => void;
  markBackupTaken: () => void;

  // Import
  mergeProfile: (profile: Profile, mode: "merge" | "replace") => void;
  replaceAll: (state: AppState) => void;
}

function activeProfile(state: AppState): Profile | undefined {
  return state.profiles.find((p) => p.id === state.activeProfileId);
}

const STATUS_CYCLE = [
  "lived",
  "visited",
  "day_trip",
  "transit",
  "wishlist",
  null,
] as const;

export const useWorldMapStore = create<WorldMapStore>()(
  persist(
    (set) => ({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profiles: [],
      activeProfileId: "",
      settings: { ...DEFAULT_SETTINGS },
      hasHydrated: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      createProfile: (name, emoji) => {
        const profile = createEmptyProfile(name, emoji);
        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfileId: profile.id,
        }));
        return profile.id;
      },

      renameProfile: (profileId, name, emoji) => {
        set((s) => ({
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
        set((s) =>
          s.profiles.some((p) => p.id === profileId)
            ? { activeProfileId: profileId }
            : {},
        );
      },

      deleteProfile: (profileId) => {
        set((s) => {
          const remaining = s.profiles.filter((p) => p.id !== profileId);
          if (remaining.length === 0) {
            const fresh = createEmptyProfile("Traveler", "🌍");
            return { profiles: [fresh], activeProfileId: fresh.id };
          }
          const activeId =
            s.activeProfileId === profileId
              ? remaining[0].id
              : s.activeProfileId;
          return { profiles: remaining, activeProfileId: activeId };
        });
      },

      upsertVisit: (iso, patch) => {
        set((s) => {
          const profile = activeProfile(s);
          if (!profile) return {};
          const existing = profile.visits[iso];
          const next: CountryVisit = {
            ...existing,
            ...patch,
            iso,
            status: patch.status ?? existing?.status ?? "visited",
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

      cycleStatus: (iso) => {
        set((s) => {
          const profile = activeProfile(s);
          if (!profile) return {};
          const current = profile.visits[iso]?.status;
          const idx = STATUS_CYCLE.indexOf(
            (current ?? null) as (typeof STATUS_CYCLE)[number],
          );
          const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
          const nextVisits = { ...profile.visits };
          if (nextStatus === null) {
            delete nextVisits[iso];
          } else {
            nextVisits[iso] = {
              ...(profile.visits[iso] ?? {}),
              iso,
              status: nextStatus,
            };
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
        set((s) => {
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

      setTheme: (t) =>
        set((s) => ({ settings: { ...s.settings, theme: t } })),

      setShowLegend: (v) =>
        set((s) => ({ settings: { ...s.settings, showLegend: v } })),

      setQuickPin: (v) =>
        set((s) => ({ settings: { ...s.settings, quickPin: v } })),

      markBackupTaken: () =>
        set((s) => ({
          settings: {
            ...s.settings,
            lastBackupAt: new Date().toISOString(),
          },
        })),

      mergeProfile: (incoming, mode) => {
        set((s) => {
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
          const mergedVisits = { ...profile.visits };
          for (const [iso, v] of Object.entries(incoming.visits)) {
            mergedVisits[iso] = {
              ...v,
              ...mergedVisits[iso],
              visitCount:
                (mergedVisits[iso]?.visitCount ?? 0) + (v.visitCount ?? 0) ||
                undefined,
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

      replaceAll: (state) => {
        set({
          schemaVersion: state.schemaVersion,
          profiles: state.profiles,
          activeProfileId: state.activeProfileId,
          settings: { ...DEFAULT_SETTINGS, ...state.settings },
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : window.localStorage,
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
    },
  ),
);

// Helper hook: the currently active profile.
export function useActiveProfile(): Profile | undefined {
  return useWorldMapStore((s) =>
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
