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
