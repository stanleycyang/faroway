import {
  HOTEL_SEARCH_CONSENT_VERSION,
  hotelChildrenAgeText,
  type HotelSearchDetails,
} from "@faroway/constants";
import { parseTripDate } from "./trips/date-duration";

const CREATE_DRAFT_STORAGE_PREFIX = "faroway-create-draft:";
const CREATE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const DRAFT_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length?: number;
  key?(index: number): string | null;
}

interface StoredDraftEnvelope<T> {
  version: 1;
  savedAt: number;
  draft: T;
}

function isValidEnvelope<T>(
  raw: string | null,
  now: number,
): StoredDraftEnvelope<T> | null {
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as Partial<StoredDraftEnvelope<T>>;
    if (
      envelope.version !== 1 ||
      typeof envelope.savedAt !== "number" ||
      envelope.savedAt > now ||
      now - envelope.savedAt > CREATE_DRAFT_TTL_MS ||
      envelope.draft === undefined
    ) {
      return null;
    }
    return envelope as StoredDraftEnvelope<T>;
  } catch {
    return null;
  }
}

function listStorageKeys(storage: StorageLike): string[] {
  if (typeof storage.length !== "number" || typeof storage.key !== "function") {
    return [];
  }
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (typeof key === "string") keys.push(key);
  }
  return keys;
}

function createDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function storageKey(draftId: string): string | null {
  return DRAFT_ID_PATTERN.test(draftId)
    ? `${CREATE_DRAFT_STORAGE_PREFIX}${draftId}`
    : null;
}

export function saveCreateDraft<T>(
  storage: StorageLike,
  draft: T,
  now = Date.now(),
): string {
  const draftId = createDraftId();
  const envelope: StoredDraftEnvelope<T> = {
    version: 1,
    savedAt: now,
    draft,
  };
  storage.setItem(
    `${CREATE_DRAFT_STORAGE_PREFIX}${draftId}`,
    JSON.stringify(envelope),
  );
  return draftId;
}

/** Reads and removes a one-time create draft shared across tabs on this origin. */
export function takeCreateDraft<T>(
  storage: StorageLike,
  draftId: string,
  now = Date.now(),
): T | null {
  const key = storageKey(draftId);
  if (!key) return null;

  const raw = storage.getItem(key);
  if (!raw) return null;
  storage.removeItem(key);

  const envelope = isValidEnvelope<T>(raw, now);
  return envelope ? envelope.draft : null;
}

/** Purges expired or malformed one-time create drafts from storage. */
export function purgeExpiredCreateDrafts(
  storage: StorageLike,
  now = Date.now(),
): void {
  const keys = listStorageKeys(storage);
  for (const key of keys) {
    if (!key.startsWith(CREATE_DRAFT_STORAGE_PREFIX)) continue;
    try {
      const raw = storage.getItem(key);
      if (!isValidEnvelope(raw, now)) {
        storage.removeItem(key);
      }
    } catch {
      try {
        storage.removeItem(key);
      } catch {
        /* Ignore storage errors while purging stale drafts. */
      }
    }
  }
}

const LEGACY_EDITOR_DRAFT_KEY = "faroway-create-editor-draft";
const EDITOR_DRAFT_KEY_PREFIX = "faroway-create-editor-draft:";

export function editorDraftStorageKey(scopeId = "guest"): string {
  const normalized = scopeId.trim() || "guest";
  return `${EDITOR_DRAFT_KEY_PREFIX}${normalized}`;
}

/** A same-tab setup draft is independent of any submitted trip request and scoped per user. */
export function saveEditorDraft<T>(
  storage: StorageLike,
  draft: T,
  now = Date.now(),
  scopeId = "guest",
): void {
  storage.setItem(
    editorDraftStorageKey(scopeId),
    JSON.stringify({ version: 1, savedAt: now, draft }),
  );
}

export function readEditorDraft<T>(
  storage: StorageLike,
  now = Date.now(),
  scopeId = "guest",
): T | null {
  try {
    const raw = storage.getItem(editorDraftStorageKey(scopeId));
    const envelope = isValidEnvelope<T>(raw, now);
    return envelope ? envelope.draft : null;
  } catch {
    return null;
  }
}

export function clearEditorDraft(
  storage: StorageLike,
  scopeId = "guest",
): void {
  storage.removeItem(editorDraftStorageKey(scopeId));
}

/** Clears every scoped editor draft (plus legacy unscoped key), e.g. on sign-out. */
export function clearAllEditorDrafts(storage: StorageLike): void {
  storage.removeItem(LEGACY_EDITOR_DRAFT_KEY);
  const keys = listStorageKeys(storage);
  for (const key of keys) {
    if (key.startsWith(EDITOR_DRAFT_KEY_PREFIX)) {
      storage.removeItem(key);
    }
  }
}

/** Restore calendar dates locally and reject malformed legacy timestamp values. */
export function parseCreateDraftDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = parseTripDate(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Restore editing state, not search eligibility. Submission still uses the
 * strict hotel validator. JSON nulls preserve invalid numeric input as NaN. */
export function restoreHotelSearchDraft(
  value: unknown,
): HotelSearchDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  if (
    draft.consentVersion !== HOTEL_SEARCH_CONSENT_VERSION ||
    typeof draft.countryCode !== "string" ||
    draft.countryCode.length > 2 ||
    typeof draft.guestNationality !== "string" ||
    draft.guestNationality.length > 2 ||
    !Array.isArray(draft.rooms) ||
    draft.rooms.length < 1 ||
    draft.rooms.length > 4
  )
    return null;
  const numeric = (item: unknown): item is number | null =>
    item === null || (typeof item === "number" && Number.isFinite(item));
  // The free-text age input can exceed submission limits while being edited.
  const rooms: HotelSearchDetails["rooms"] = [];
  for (const item of draft.rooms) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const room = item as Record<string, unknown>;
    if (
      !numeric(room.adults) ||
      !Array.isArray(room.children) ||
      !room.children.every(numeric)
    )
      return null;
    rooms.push({
      adults: room.adults ?? NaN,
      children: room.children.map((age) => age ?? NaN),
    });
  }
  return {
    countryCode: draft.countryCode,
    guestNationality: draft.guestNationality,
    consentVersion: draft.consentVersion,
    rooms,
  };
}

/** Restore only text that still describes the numeric room draft. Legacy or
 * malformed text falls back to the room data; it never changes eligibility. */
export function restoreHotelAgeTextDraft(
  value: unknown,
  details: HotelSearchDetails | null,
): string[] {
  return (
    details?.rooms.map((room, index) =>
      hotelChildrenAgeText(
        room.children,
        Array.isArray(value) && typeof value[index] === "string"
          ? value[index]
          : undefined,
      ),
    ) ?? []
  );
}
