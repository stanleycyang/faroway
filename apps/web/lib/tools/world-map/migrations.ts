import { CONTINENT_BY_ALPHA3 } from "./continents";
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
  const s = state as { profiles?: unknown } & Record<string, unknown>;
  const rawProfiles: unknown = s.profiles;
  const list = Array.isArray(rawProfiles)
    ? (rawProfiles.filter(isPlainObject) as unknown as V1Profile[])
    : [];
  const profiles: Profile[] = list.map((p) => {
    const visits: Record<string, CountryVisit> = {};
    const rawVisits = isPlainObject(p.visits) ? p.visits : {};
    for (const [iso, rawV] of Object.entries(rawVisits)) {
      if (iso === "__proto__" || iso === "constructor" || iso === "prototype") {
        continue;
      }
      // Corrupt entries (null, strings, arrays) are skipped rather than
      // crashing the whole migration.
      if (!isPlainObject(rawV)) continue;
      const v = rawV as unknown as V1Visit;
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

export function emptyState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles: [],
    activeProfileId: "",
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function migrate(state: unknown): AppState {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    console.warn(
      "[world-map] Cannot migrate non-object state; resetting to empty.",
    );
    return emptyState();
  }
  try {
    let current: { schemaVersion?: unknown } = {
      ...(state as Record<string, unknown>),
    };
    const rawVersion = current.schemaVersion;
    let version = rawVersion === undefined ? 1 : Number(rawVersion);
    if (!Number.isInteger(version) || version < 1) {
      console.warn(
        `[world-map] Invalid persisted schema version (${String(rawVersion)}); resetting to empty.`,
      );
      return emptyState();
    }
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
  } catch (err) {
    console.warn(
      "[world-map] Migration threw unexpectedly; resetting to empty.",
      err,
    );
    return emptyState();
  }
}

// ---------------------------------------------------------------------------
// Sanitization
//
// Anything that reaches the store from outside the app (an imported JSON
// backup, or whatever happens to be sitting in localStorage) is untrusted.
// These helpers coerce it into the exact shape the UI expects, dropping
// anything that cannot be rendered safely.
// ---------------------------------------------------------------------------

export const MAX_PROFILES = 50;
export const LIMITS = {
  id: 64,
  name: 80,
  emoji: 16,
  date: 40,
  city: 200,
  notes: 10_000,
  // Compressed cover photos are ~120KB; leave generous headroom.
  photo: 2_000_000,
  visitCount: 10_000,
} as const;

const PHOTO_DATA_URL_RE =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function optString(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.slice(0, max);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isValidPhotoDataUrl(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length <= LIMITS.photo &&
    PHOTO_DATA_URL_RE.test(v)
  );
}

export function isKnownIso(iso: unknown): iso is string {
  return typeof iso === "string" && Object.hasOwn(CONTINENT_BY_ALPHA3, iso);
}

function sanitizeVisit(iso: string, raw: unknown): CountryVisit | null {
  if (!isKnownIso(iso) || !isPlainObject(raw)) return null;
  const visit: CountryVisit = { iso, status: "visited" };
  const firstVisit = optString(raw.firstVisit, LIMITS.date);
  if (firstVisit) visit.firstVisit = firstVisit;
  const lastVisit = optString(raw.lastVisit, LIMITS.date);
  if (lastVisit) visit.lastVisit = lastVisit;
  if (
    typeof raw.visitCount === "number" &&
    Number.isFinite(raw.visitCount) &&
    raw.visitCount >= 1
  ) {
    visit.visitCount = Math.min(Math.floor(raw.visitCount), LIMITS.visitCount);
  }
  const pinnedCity = optString(raw.pinnedCity, LIMITS.city);
  if (pinnedCity) visit.pinnedCity = pinnedCity;
  const notes = optString(raw.notes, LIMITS.notes);
  if (notes) visit.notes = notes;
  if (
    typeof raw.rating === "number" &&
    Number.isInteger(raw.rating) &&
    raw.rating >= 1 &&
    raw.rating <= 5
  ) {
    visit.rating = raw.rating as CountryVisit["rating"];
  }
  if (isValidPhotoDataUrl(raw.photoDataUrl)) {
    visit.photoDataUrl = raw.photoDataUrl;
  }
  return visit;
}

export function sanitizeProfile(raw: unknown): Profile | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  if (raw.id.length > LIMITS.id) return null;
  const now = new Date().toISOString();
  const visits: Record<string, CountryVisit> = {};
  if (isPlainObject(raw.visits)) {
    for (const [iso, v] of Object.entries(raw.visits)) {
      const clean = sanitizeVisit(iso, v);
      if (clean) visits[iso] = clean;
    }
  }
  const profile: Profile = {
    id: raw.id,
    name: optString(raw.name, LIMITS.name) ?? "Traveler",
    createdAt: optString(raw.createdAt, LIMITS.date) ?? now,
    updatedAt: optString(raw.updatedAt, LIMITS.date) ?? now,
    visits,
  };
  const emoji = optString(raw.emoji, LIMITS.emoji);
  if (emoji) profile.emoji = emoji;
  return profile;
}

export function sanitizeAppState(raw: unknown): AppState {
  if (!isPlainObject(raw)) return emptyState();
  const seen = new Set<string>();
  const profiles: Profile[] = [];
  const rawProfiles = Array.isArray(raw.profiles) ? raw.profiles : [];
  for (const p of rawProfiles) {
    if (profiles.length >= MAX_PROFILES) break;
    const clean = sanitizeProfile(p);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    profiles.push(clean);
  }
  const activeProfileId =
    typeof raw.activeProfileId === "string" && seen.has(raw.activeProfileId)
      ? raw.activeProfileId
      : (profiles[0]?.id ?? "");
  const settings: AppSettings = {};
  if (isPlainObject(raw.settings)) {
    const lastBackupAt = optString(raw.settings.lastBackupAt, LIMITS.date);
    if (lastBackupAt) settings.lastBackupAt = lastBackupAt;
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles,
    activeProfileId,
    settings,
  };
}

/**
 * Migrate and sanitize untrusted state. Never throws: anything that cannot be
 * migrated resets to an empty state.
 */
export function migrateAndSanitize(raw: unknown): AppState {
  try {
    return sanitizeAppState(migrate(raw));
  } catch (err) {
    console.warn(
      "[world-map] Could not migrate state; resetting to empty.",
      err,
    );
    return emptyState();
  }
}

/**
 * Migrate and sanitize a single exported profile. Single-profile exports
 * carry no schema version, so they go through every migration (each step is
 * idempotent for already-current data).
 */
export function migrateAndSanitizeProfile(raw: unknown): Profile | null {
  if (!isPlainObject(raw)) return null;
  const state = migrateAndSanitize({
    schemaVersion:
      typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1,
    profiles: [raw],
    activeProfileId: typeof raw.id === "string" ? raw.id : "",
    settings: {},
  });
  return state.profiles[0] ?? null;
}
