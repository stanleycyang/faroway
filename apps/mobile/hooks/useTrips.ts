import { retainTripDetail } from '../lib/tripSummary';
import { readOwnedTripPages } from '../lib/tripListPages';
import { transformItineraryDays, transformApiHotel } from '../lib/itineraryNormalization';
export { transformItineraryDays } from '../lib/itineraryNormalization';
import { regenerateTrip } from '../services/planningService';
import { requestWithTimeout } from '../services/request';
import { applyPendingTripChanges } from '../lib/offline/storage';
import { buildTripUpdatePayload } from '../lib/offline/trip-payload';
import { useState, useCallback, useRef } from 'react';
import {
  captureTripAccount,
  TripAccountChangedError,
  TripAccessError,
} from '../lib/tripAccountScope';
import { API_BASE_URL } from '../lib/supabase';
import { useTripStore, Trip, TripInput } from '../stores/tripStore';
import { syncService, networkMonitor, offlineStorage } from '../lib/offline';
import { normalizeTripStatus } from '../lib/tripStatus';
import { IMAGE_PATHS, getImageUrl } from '@faroway/constants';

interface ApiItinerary {
  days?: unknown[];
  topHotel?: unknown;
  [key: string]: unknown;
}

interface ApiTrip {
  id: string;
  user_id: string;
  destination: string;
  country?: string;
  start_date: string;
  end_date: string;
  travelers: number;
  traveler_type?: string;
  preferences?: {
    planNeedsRefresh?: boolean;
    travelerType?: string;
    originCity?: string;
    originAirport?: string;
  };
  vibes?: string[];
  budget?: string;
  budget_tier?: string;
  status: string;
  cover_image?: string;
  itinerary?: ApiItinerary;
  created_at: string;
  updated_at: string;
}

/**
 * Transform API trip to app Trip format.
 * The single-trip endpoint returns { trip, itinerary } as separate top-level keys,
 * so itinerary must be passed explicitly.
 */
function transformApiTrip(apiTrip: ApiTrip, itinerary?: ApiItinerary): Trip {
  const itineraryData = itinerary || apiTrip.itinerary;
  const rawDays = itineraryData?.days || [];

  return {
    id: apiTrip.id,
    destination: apiTrip.destination,
    country: apiTrip.country || '',
    startDate: apiTrip.start_date,
    endDate: apiTrip.end_date,
    travelers: apiTrip.travelers,
    travelerType: apiTrip.traveler_type || apiTrip.preferences?.travelerType || 'solo',
    originCity: apiTrip.preferences?.originCity,
    originAirport: apiTrip.preferences?.originAirport,
    vibes: apiTrip.vibes || [],
    budget: apiTrip.budget_tier || apiTrip.budget,
    planNeedsRefresh: apiTrip.preferences?.planNeedsRefresh === true,
    days: apiTrip.preferences?.planNeedsRefresh ? [] : transformItineraryDays(rawDays),
    hotel: apiTrip.preferences?.planNeedsRefresh
      ? undefined
      : transformApiHotel(itineraryData?.topHotel),
    coverImage:
      apiTrip.cover_image || getImageUrl(IMAGE_PATHS.blog['ultimate-guide-planning-trip-with-ai']),
    createdAt: apiTrip.created_at,
    updatedAt: apiTrip.updated_at,
    status: normalizeTripStatus(apiTrip.status),
  };
}

/** Read the body inside the same deadline as the connection, before any state changes. */
async function tripResponse(url: string, init: RequestInit) {
  return requestWithTimeout(url, init, async (response) => {
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, json: async () => data };
  });
}

/** Leaving the screen must also cancel a read that is waiting for background sync. */
async function waitForMutationSync(settled: Promise<void>, signal?: AbortSignal) {
  if (!signal) return settled;
  let onAbort!: () => void;
  try {
    await Promise.race([
      settled,
      new Promise<void>((resolve) => {
        onAbort = resolve;
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) resolve();
      }),
    ]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export function useTrips() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const {
    trips,
    saveTrip,
    applyQueuedTrip,
    applyQueuedDeletion,
    deleteTrip: removeFromStore,
    setCurrentTrip,
  } = useTripStore();

  // Fetch all trips from backend (with offline fallback)
  const fetchTrips = useCallback(async () => {
    const account = captureTripAccount();
    const request = ++listRequestRef.current;
    const isCurrent = () => account.isCurrent() && request === listRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      account.assertCurrent();
      if (!networkMonitor.isOnline()) {
        const cachedTrips = await offlineStorage.loadTrips();
        if (!isCurrent()) return [];
        useTripStore.setState({ trips: cachedTrips });
        return cachedTrips;
      }
      const apiTrips = await readOwnedTripPages<ApiTrip>(
        account.ownerId!,
        async (cursor) => {
          const headers = await account.headers();
          account.assertCurrent();
          return tripResponse(
            `${API_BASE_URL}/api/trips${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
            { method: 'GET', headers }
          );
        },
        account.assertCurrent
      );
      if (!isCurrent()) return [];
      const saved = useTripStore.getState();
      const cachedById = new Map(saved.trips.map((trip) => [trip.id, trip]));
      const transformedTrips = apiTrips.map((apiTrip) => {
        const summary = transformApiTrip(apiTrip);
        const detail =
          saved.currentTrip?.id === summary.id && saved.currentTrip.updatedAt === summary.updatedAt
            ? saved.currentTrip
            : cachedById.get(summary.id);
        return retainTripDetail(summary, detail, !apiTrip.itinerary);
      });
      await offlineStorage.saveTrips(transformedTrips, account.ownerId);
      if (!isCurrent()) return [];
      const pending = await offlineStorage.getPendingMutations();
      if (!isCurrent()) return [];
      const visible = applyPendingTripChanges(transformedTrips, pending);
      useTripStore.setState({ trips: visible });
      return visible;
    } catch (err: unknown) {
      if (!isCurrent()) return [];
      setError(err instanceof Error ? err.message : String(err));
      if (!account.ownerId || err instanceof TripAccessError) return [];
      try {
        const cachedTrips = await offlineStorage.loadTrips();
        return isCurrent() ? cachedTrips : [];
      } catch {
        if (isCurrent())
          setError('Couldn’t read your saved trips. Check your connection and try again.');
        return [];
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  // Create a new trip (with offline support)
  const createTrip = useCallback(
    async (input: TripInput) => {
      const submittedInput = { ...input, vibes: [...input.vibes] };
      const account = captureTripAccount();
      setLoading(true);
      setError(null);

      try {
        account.assertCurrent();
        // Generate local ID for offline scenario
        const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // If offline, create locally and queue for sync
        if (!networkMonitor.isOnline()) {
          const localTrip: Trip = {
            id: localId,
            destination: submittedInput.destination,
            country: submittedInput.country || '',
            startDate: submittedInput.startDate,
            endDate: submittedInput.endDate,
            travelers: submittedInput.travelers,
            travelerType: submittedInput.travelerType,
            originCity: submittedInput.originCity,
            originAirport: submittedInput.originAirport,
            vibes: [...submittedInput.vibes],
            budget: submittedInput.budget,
            days: [],
            coverImage: getImageUrl(IMAGE_PATHS.blog['ultimate-guide-planning-trip-with-ai']),
            createdAt: new Date().toISOString(),
            status: 'draft',
          };

          // Only acknowledge the edit after its retry queue is persisted.
          await syncService.queueCreate(localTrip);
          account.assertCurrent();
          applyQueuedTrip(localTrip);
          setCurrentTrip(localTrip);
          return localTrip;
        }

        const headers = await account.headers();
        const response = await tripResponse(`${API_BASE_URL}/api/trips`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            destination: submittedInput.destination,
            start_date: submittedInput.startDate,
            end_date: submittedInput.endDate,
            travelers: submittedInput.travelers,
            preferences: {
              travelerType: submittedInput.travelerType,
              originCity: submittedInput.originCity,
              originAirport: submittedInput.originAirport,
              vibes: submittedInput.vibes,
              budget: submittedInput.budget,
            },
          }),
        });

        account.assertCurrent();
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to create a trip');
          }
          const errorData = await response.json();
          throw new Error(errorData?.error || 'Failed to create trip');
        }

        const data = await response.json();
        account.assertCurrent();
        if (data.trip?.user_id !== account.ownerId) throw new TripAccountChangedError();
        const trip = transformApiTrip(data.trip);

        saveTrip(trip);
        setCurrentTrip(trip);

        return trip;
      } catch (err: unknown) {
        if (account.isCurrent()) setError(err instanceof Error ? err.message : String(err));
        console.error('Error creating trip:', err);
        throw err;
      } finally {
        if (account.isCurrent()) setLoading(false);
      }
    },
    [saveTrip, applyQueuedTrip, setCurrentTrip]
  );

  // Get trip by ID
  const getTripById = useCallback(
    async (id: string, signal?: AbortSignal) => {
      const account = captureTripAccount();
      const request = ++detailRequestRef.current;
      const isCurrent = () =>
        !signal?.aborted && account.isCurrent() && request === detailRequestRef.current;
      const assertCurrent = () => {
        if (signal?.aborted) {
          const error = new Error('Trip request cancelled');
          error.name = 'AbortError';
          throw error;
        }
        if (!isCurrent()) throw new TripAccountChangedError();
      };
      setLoading(true);
      setError(null);
      try {
        while (true) {
          assertCurrent();
          const mutationRead = syncService.captureMutationRead();
          await waitForMutationSync(mutationRead.settled, signal);
          assertCurrent();
          if (!mutationRead.isCurrent()) continue;
          const headers = await account.headers();
          assertCurrent();
          const response = await tripResponse(`${API_BASE_URL}/api/trips/${id}`, {
            method: 'GET',
            headers,
            signal,
          });
          assertCurrent();
          // Sync may have acknowledged an edit while this GET was in flight.
          // Read again after it settles, including a fresh server response.
          if (!mutationRead.isCurrent()) continue;
          if (!response.ok) {
            throw new Error(
              response.status === 401
                ? 'Please sign in to view this trip'
                : response.status === 404
                  ? 'Trip not found'
                  : 'Failed to fetch trip'
            );
          }
          const data = await response.json().catch(() => null);
          assertCurrent();
          if (!data?.trip || data.trip.id !== id || data.trip.user_id !== account.ownerId)
            throw new TripAccessError(
              'This trip response could not be verified. Reopen your trips and try again.'
            );
          if (!mutationRead.isCurrent()) continue;
          const trip = transformApiTrip(data.trip, data.itinerary);
          await offlineStorage.saveTrip(trip, account.ownerId!);
          assertCurrent();
          // Keep canonical data separate from the owner's durable pending intent.
          // Never rebase the queued revision or publish a snapshot spanning sync.
          const pending = await offlineStorage.getPendingMutations();
          assertCurrent();
          if (!mutationRead.isCurrent()) continue;
          const visible = applyPendingTripChanges([trip], pending).find((item) => item.id === id);
          if (!visible) {
            setCurrentTrip(null);
            throw new TripAccessError('This trip has a pending deletion.');
          }
          setCurrentTrip(visible);
          return visible;
        }
      } catch (err: unknown) {
        if (isCurrent()) setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [setCurrentTrip]
  );

  // Update a trip (with offline support)
  const updateTrip = useCallback(
    async (id: string, updates: Partial<TripInput>) => {
      const submittedUpdates = {
        ...updates,
        ...(updates.vibes ? { vibes: [...updates.vibes] } : {}),
      };
      const account = captureTripAccount();
      setLoading(true);
      setError(null);

      try {
        account.assertCurrent();
        // If offline, update locally and queue for sync. Read fresh trips from
        // the store rather than the captured closure value so this works
        // immediately after a `setTrips` call without an intervening re-render.
        if (!networkMonitor.isOnline()) {
          const existingTrip = useTripStore.getState().trips.find((t) => t.id === id);
          if (!existingTrip) {
            setLoading(false);
            return undefined;
          }
          const updatedTrip = { ...existingTrip, ...submittedUpdates } as Trip;
          await syncService.queueUpdate(id, submittedUpdates);
          account.assertCurrent();
          applyQueuedTrip(updatedTrip);
          return updatedTrip;
        }

        const headers = await account.headers();
        const response = await tripResponse(`${API_BASE_URL}/api/trips/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(
            buildTripUpdatePayload(
              submittedUpdates,
              useTripStore.getState().trips.find((t) => t.id === id)?.updatedAt
            )
          ),
        });

        account.assertCurrent();
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to update this trip');
          }
          const failure = await response.json().catch(() => ({}));
          throw new Error(failure?.error || 'Failed to update trip');
        }

        const data = await response.json();
        account.assertCurrent();
        if (data.trip?.user_id !== account.ownerId) throw new TripAccountChangedError();
        const trip = transformApiTrip(data.trip, data.itinerary);

        saveTrip(trip);
        return trip;
      } catch (err: unknown) {
        if (account.isCurrent()) setError(err instanceof Error ? err.message : String(err));
        console.error('Error updating trip:', err);
        throw err;
      } finally {
        if (account.isCurrent()) setLoading(false);
      }
    },
    [saveTrip, applyQueuedTrip]
  );

  // Delete a trip (with offline support)
  const deleteTrip = useCallback(
    async (id: string) => {
      const account = captureTripAccount();
      setLoading(true);
      setError(null);

      try {
        account.assertCurrent();
        // If offline, delete locally and queue for sync
        if (!networkMonitor.isOnline()) {
          await syncService.queueDelete(id);
          account.assertCurrent();
          applyQueuedDeletion(id);
          return;
        }

        const headers = await account.headers();
        const response = await tripResponse(`${API_BASE_URL}/api/trips/${id}`, {
          method: 'DELETE',
          headers,
        });

        account.assertCurrent();
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to delete this trip');
          }
          throw new Error('Failed to delete trip');
        }

        removeFromStore(id);
      } catch (err: unknown) {
        if (account.isCurrent()) setError(err instanceof Error ? err.message : String(err));
        console.error('Error deleting trip:', err);
        throw err;
      } finally {
        if (account.isCurrent()) setLoading(false);
      }
    },
    [removeFromStore, applyQueuedDeletion]
  );

  // Generate itinerary for a trip
  const generateItinerary = useCallback(async (tripId: string) => {
    setLoading(true);
    setError(null);

    try {
      return await regenerateTrip(tripId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('Error generating itinerary:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    trips,
    loading,
    error,
    fetchTrips,
    createTrip,
    getTripById,
    updateTrip,
    deleteTrip,
    generateItinerary,
  };
}
