import type { AppState } from "./types";

export const CURRENT_SCHEMA_VERSION = 1;

type Migration = (state: unknown) => unknown;

// Each migration upgrades from version N to N+1.
// Add entries here as the schema evolves.
const MIGRATIONS: Record<number, Migration> = {};

export function migrate(state: unknown): AppState {
  if (!state || typeof state !== "object") {
    throw new Error("Cannot migrate non-object state");
  }
  let current: { schemaVersion?: number } = state as {
    schemaVersion?: number;
  };
  let version = current.schemaVersion ?? 1;
  while (version < CURRENT_SCHEMA_VERSION) {
    const fn = MIGRATIONS[version];
    if (!fn) {
      throw new Error(`No migration from schema v${version}`);
    }
    current = fn(current) as typeof current;
    version += 1;
    current.schemaVersion = version;
  }
  return current as AppState;
}
