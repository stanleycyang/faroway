import type { AppState, AppSettings, Profile, CountryVisit } from "./types";

export const CURRENT_SCHEMA_VERSION = 2;

type Migration = (state: unknown) => unknown;

interface V1Visit {
  iso: string;
  status: string;
  firstVisit?: string;
  lastVisit?: string;
  visitCount?: number;
  pinnedCity?: string;
  notes?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  photoDataUrl?: string;
}

interface V1Profile {
  id: string;
  name: string;
  emoji?: string;
  createdAt: string;
  updatedAt: string;
  visits: Record<string, V1Visit>;
}

// v1 → v2: collapse the multi-status model. Wishlist entries (places the
// user wanted to go, not actually visited) are dropped; everything else
// becomes a plain visited pin.
const migrateV1ToV2: Migration = (state) => {
  const s = state as { profiles?: V1Profile[] } & Record<string, unknown>;
  const profiles: Profile[] = (s.profiles ?? []).map((p) => {
    const visits: Record<string, CountryVisit> = {};
    for (const [iso, v] of Object.entries(p.visits ?? {})) {
      if (v.status === "wishlist") continue;
      visits[iso] = {
        iso,
        status: "visited",
        firstVisit: v.firstVisit,
        lastVisit: v.lastVisit,
        visitCount: v.visitCount,
        pinnedCity: v.pinnedCity,
        notes: v.notes,
        rating: v.rating,
        photoDataUrl: v.photoDataUrl,
      };
    }
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      visits,
    };
  });
  return { ...s, profiles };
};

const MIGRATIONS: Record<number, Migration> = {
  1: migrateV1ToV2,
};

const DEFAULT_SETTINGS: AppSettings = {};

function emptyState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles: [],
    activeProfileId: "",
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function migrate(state: unknown): AppState {
  if (!state || typeof state !== "object") {
    console.warn(
      "[world-map] Cannot migrate non-object state; resetting to empty.",
    );
    return emptyState();
  }
  let current: { schemaVersion?: number } = state as { schemaVersion?: number };
  let version = current.schemaVersion ?? 1;
  if (version > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[world-map] Persisted schema v${version} is newer than current; resetting to empty.`,
    );
    return emptyState();
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const fn = MIGRATIONS[version];
    if (!fn) {
      console.warn(
        `[world-map] No migration from schema v${version}; resetting to empty.`,
      );
      return emptyState();
    }
    current = fn(current) as typeof current;
    version += 1;
    current.schemaVersion = version;
  }
  return current as AppState;
}
