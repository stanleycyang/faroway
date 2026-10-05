import { API_BASE_URL } from '../constants/api';

/** Use the configured web backend, never generated links or browser credentials. */
export function savedTripReviewUrl(tripId?: string): string | null {
  if (!tripId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId))
    return null;
  try {
    const base = new URL(API_BASE_URL);
    if (base.protocol !== 'https:' || base.username || base.password) return null;
    return `${base.origin}/trips/${encodeURIComponent(tripId)}`;
  } catch {
    return null;
  }
}
