import type { TripInput } from '../stores/tripStore';

const OAUTH_TRIP_DRAFT_KEY = 'faroway-oauth-trip-draft';
const OAUTH_TRIP_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PendingOAuthTripDraft {
  version: 1;
  savedAt: number;
  draft: TripInput;
}

export function resolveWebOAuthRedirectUrl(
  origin: string,
  currentPath: string,
  requestedPath?: string
): string {
  const fallbackUrl = new URL(currentPath, origin);
  const requestedUrl = new URL(requestedPath ?? currentPath, origin);
  return requestedUrl.origin === origin ? requestedUrl.toString() : fallbackUrl.toString();
}

export function savePendingOAuthTripDraft(
  storage: SessionStorageLike,
  draft: TripInput,
  now = Date.now()
): void {
  const pending: PendingOAuthTripDraft = {
    version: 1,
    savedAt: now,
    draft,
  };
  storage.setItem(OAUTH_TRIP_DRAFT_KEY, JSON.stringify(pending));
}

export function takePendingOAuthTripDraft(
  storage: SessionStorageLike,
  now = Date.now()
): TripInput | null {
  const raw = storage.getItem(OAUTH_TRIP_DRAFT_KEY);
  if (!raw) return null;
  storage.removeItem(OAUTH_TRIP_DRAFT_KEY);

  try {
    const pending = JSON.parse(raw) as Partial<PendingOAuthTripDraft>;
    if (
      pending.version !== 1 ||
      typeof pending.savedAt !== 'number' ||
      pending.savedAt > now ||
      now - pending.savedAt > OAUTH_TRIP_DRAFT_TTL_MS ||
      !pending.draft ||
      typeof pending.draft.destination !== 'string' ||
      typeof pending.draft.startDate !== 'string' ||
      typeof pending.draft.endDate !== 'string'
    ) {
      return null;
    }
    return pending.draft;
  } catch {
    return null;
  }
}

export function discardPendingOAuthTripDraft(storage: SessionStorageLike): void {
  storage.removeItem(OAUTH_TRIP_DRAFT_KEY);
}
