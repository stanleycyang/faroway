import {
  HOTEL_SEARCH_CONSENT_VERSION,
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
}

interface StoredDraftEnvelope<T> {
  version: 1;
  savedAt: number;
  draft: T;
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
    return envelope.draft;
  } catch {
    return null;
  }
}

const EDITOR_DRAFT_KEY = "faroway-create-editor-draft";

/** A same-tab setup draft is independent of any submitted trip request. */
export function saveEditorDraft<T>(
  storage: StorageLike,
  draft: T,
  now = Date.now(),
): void {
  storage.setItem(
    EDITOR_DRAFT_KEY,
    JSON.stringify({ version: 1, savedAt: now, draft }),
  );
}

export function readEditorDraft<T>(
  storage: StorageLike,
  now = Date.now(),
): T | null {
  try {
    const raw = storage.getItem(EDITOR_DRAFT_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Partial<StoredDraftEnvelope<T>>;
    if (
      envelope.version !== 1 ||
      typeof envelope.savedAt !== "number" ||
      envelope.savedAt > now ||
      now - envelope.savedAt > CREATE_DRAFT_TTL_MS ||
      envelope.draft === undefined
    )
      return null;
    return envelope.draft;
  } catch {
    return null;
  }
}

export function clearEditorDraft(storage: StorageLike): void {
  storage.removeItem(EDITOR_DRAFT_KEY);
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
