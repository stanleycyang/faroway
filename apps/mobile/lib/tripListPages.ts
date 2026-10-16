import { TripAccessError, TripAccountChangedError } from './tripAccountScope';

type TripRow = { id: string; user_id: string; itinerary?: unknown; [key: string]: unknown };
type PageResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

/** Do not publish a partial list or replace offline data before every page is read. */
export async function readOwnedTripPages<T = TripRow>(
  ownerId: string,
  readPage: (cursor: string | null) => Promise<PageResponse>,
  assertCurrent: () => void
): Promise<T[]> {
  const trips: T[] = [];
  const cursors = new Set<string>();
  const ids = new Set<string>();
  let cursor: string | null = null;
  do {
    assertCurrent();
    const response = await readPage(cursor);
    assertCurrent();
    if (!response.ok)
      throw new Error(
        response.status === 401 ? 'Please sign in to view your trips' : 'Failed to fetch trips'
      );
    const data = (await response.json().catch(() => null)) as {
      trips?: unknown;
      nextCursor?: unknown;
    } | null;
    assertCurrent();
    if (!Array.isArray(data?.trips))
      throw new TripAccessError('The saved trip list could not be read. Please try again.');
    for (const trip of data.trips) {
      if (!trip || trip.user_id !== ownerId) throw new TripAccountChangedError();
      if (typeof trip.id !== 'string' || !trip.id || ids.has(trip.id))
        throw new TripAccessError(
          'The saved trip list could not be verified. Your saved trips are kept.'
        );
      ids.add(trip.id);
      trips.push(trip as T);
    }
    const next = data.nextCursor;
    if (next === undefined || next === null) return trips;
    if (
      typeof next !== 'string' ||
      !/^[A-Za-z0-9_-]{1,256}$/.test(next) ||
      cursors.has(next) ||
      !data.trips.length
    )
      throw new TripAccessError(
        'The saved trip list could not be completed. Your saved trips are kept.'
      );
    cursors.add(next);
    cursor = next;
  } while (cursor);
  return trips;
}
