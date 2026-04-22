import type { AppState, AppSettings } from "./types";

export const CURRENT_SCHEMA_VERSION = 1;

type Migration = (state: unknown) => unknown;

// Each migration upgrades from version N to N+1.
// Add entries here as the schema evolves.
const MIGRATIONS: Record<number, Migration> = {};

const DEFAULT_SETTINGS: AppSettings = {
  theme: "classic",
  showLegend: true,
  quickPin: false,
};

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
    // Prefer returning a blank slate over throwing — a thrown error during
    // rehydrate leaves the store in an unrecoverable state that strands users.
    console.warn(
      "[world-map] Cannot migrate non-object state; resetting to empty.",
    );
    return emptyState();
  }
  let current: { schemaVersion?: number } = state as { schemaVersion?: number };
  let version = current.schemaVersion ?? 1;
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
