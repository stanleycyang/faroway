import { useState, useCallback } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../lib/supabase';
import { useTripStore, Trip, TripInput, TripDay, Activity, Hotel } from '../stores/tripStore';
import { syncService, networkMonitor, offlineStorage } from '../lib/offline';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCostValue(cost: any): string | undefined {
  if (!cost) return undefined;
  if (typeof cost === 'string') return cost;
  if (typeof cost === 'number') return `$${cost}`;
  if (cost.amount != null) {
    const suffix = cost.perPerson ? '/pp' : '';
    return `$${cost.amount}${suffix}`;
  }
  return undefined;
}

/**
 * Transform an API activity (from morning/afternoon/evening blocks) into
 * the flat Activity type used by mobile UI.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformApiActivity(a: any, timeOfDay: string): Activity {
  return {
    id: a.id || `activity_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: a.timeOfDay || timeOfDay,
    title: a.name || a.title || '',
    description: a.description || '',
    location: a.location?.name || (typeof a.location === 'string' ? a.location : ''),
    duration: typeof a.duration === 'number' ? `${a.duration} min` : a.duration || '',
    type:
      a.category === 'sightseeing' || a.category === 'adventure' || a.category === 'cultural'
        ? 'attraction'
        : a.category === 'entertainment' || a.category === 'shopping'
          ? 'experience'
          : a.type || 'activity',
    price: formatCostValue(a.estimatedCost) || formatCostValue(a.price),
    bookingUrl: a.bookingInfo?.bookingUrl || a.bookingUrl || undefined,
    affiliatePartner: a.bookingInfo?.affiliateId || a.affiliatePartner || undefined,
    image: a.images?.[0] || a.image || undefined,
    rating: a.rating,
    reviewCount: a.reviewCount,
    freeCancellation: a.freeCancellation,
  };
}

/**
 * Transform an API restaurant/meal into the flat Activity type with type 'restaurant'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformApiRestaurant(r: any): Activity {
  return {
    id: r.id || `restaurant_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: r.mealType || 'dining',
    title: r.name || r.title || '',
    description: r.description || '',
    location: r.location?.name || (typeof r.location === 'string' ? r.location : ''),
    duration: '1-2 hours',
    type: 'restaurant',
    price: formatCostValue(r.estimatedCost) || formatCostValue(r.price),
    bookingUrl: r.reservationInfo?.url || r.bookingUrl || undefined,
    affiliatePartner: 'opentable',
    rating: r.rating,
    reviewCount: r.reviewCount,
  };
}

/**
 * Transform API itinerary days (morning/afternoon/evening blocks) into
 * a flat activities array per day that the mobile UI expects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformItineraryDays(apiDays: any[]): TripDay[] {
  if (!Array.isArray(apiDays)) return [];

  return apiDays.map((day) => {
    const activities: Activity[] = [];

    // If the day already has a flat activities array (pre-transformed or cached), use it directly
    if (Array.isArray(day.activities) && !day.morning && !day.afternoon && !day.evening) {
      return day as TripDay;
    }

    // Flatten morning/afternoon/evening time blocks into a single activities array
    for (const [timeOfDay] of [['morning'], ['afternoon'], ['evening']] as const) {
      const block = day[timeOfDay];
      if (!block) continue;

      // Map activities from this time block
      if (Array.isArray(block.activities)) {
        for (const a of block.activities) {
          if (a && typeof a === 'object' && (a.name || a.title)) {
            activities.push(transformApiActivity(a, timeOfDay));
          }
        }
      }

      // Map meals/restaurants into activities with type 'restaurant'
      const meals = Array.isArray(block.meals)
        ? block.meals
        : block.meal && typeof block.meal === 'object'
          ? [block.meal]
          : [];
      for (const m of meals) {
        if (m && typeof m === 'object' && (m.name || m.title)) {
          activities.push(transformApiRestaurant(m));
        }
      }
    }

    const transport = day.transport
      ? {
          type: day.transport.type || ('flight' as const),
          provider: day.transport.provider || '',
          departure: day.transport.departure || { airport: '', city: '', dateTime: '' },
          arrival: day.transport.arrival || { airport: '', city: '', dateTime: '' },
          duration: day.transport.duration || 0,
          stops: day.transport.stops || 0,
          price: day.transport.price || 0,
          currency: day.transport.currency || 'USD',
          bookingUrl: day.transport.affiliateUrl || day.transport.bookingUrl || undefined,
          affiliatePartner: day.transport.affiliatePartner || undefined,
        }
      : undefined;

    return {
      date: day.date || '',
      dayNumber: day.dayNumber || 1,
      theme: day.title || day.theme || `Day ${day.dayNumber || 1}`,
      activities,
      transport,
    };
  });
}

/**
 * Transform hotel data from the API response.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformApiHotel(h: any): Hotel | undefined {
  if (!h || typeof h !== 'object' || !h.name) return undefined;

  return {
    id: h.id || `hotel_${Date.now()}`,
    name: h.name,
    description: h.description || '',
    pricePerNight: h.pricePerNight || h.price || 0,
    totalPrice: h.totalPrice || h.pricePerNight || h.price || 0,
    rating: h.rating || h.starRating || 0,
    reviewCount: h.reviewCount || 0,
    amenities: h.amenities || [],
    images: h.images || (h.image ? [h.image] : []),
    bookingUrl: h.affiliateUrl || h.bookingUrl || '',
    location: {
      name: h.location?.name || h.neighborhood || '',
      address: h.location?.address || h.address || '',
      lat: h.location?.lat || h.location?.coordinates?.lat || 0,
      lng: h.location?.lng || h.location?.coordinates?.lng || 0,
      neighborhood: h.location?.neighborhood || h.neighborhood,
    },
  };
}

// Map backend trip statuses (which include generation lifecycle states like
// 'generated' and 'failed') onto the narrower mobile UI status enum.
function normalizeStatus(apiStatus: string | undefined): Trip['status'] {
  switch (apiStatus) {
    case 'draft':
    case 'pending':
    case 'generating':
      return 'draft';
    case 'generated':
    case 'planned':
    case 'failed':
      return 'planned';
    case 'active':
      return 'active';
    case 'completed':
      return 'completed';
    default:
      return 'planned';
  }
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
    days: transformItineraryDays(rawDays),
    hotel: transformApiHotel(itineraryData?.topHotel),
    coverImage:
      apiTrip.cover_image || getImageUrl(IMAGE_PATHS.blog['ultimate-guide-planning-trip-with-ai']),
    createdAt: apiTrip.created_at,
    status: normalizeStatus(apiTrip.status),
  };
}

export function useTrips() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trips, saveTrip, setTrips, deleteTrip: removeFromStore, setCurrentTrip } = useTripStore();

  // Fetch all trips from backend (with offline fallback)
  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);

    // If offline, return cached trips
    if (!networkMonitor.isOnline()) {
      try {
        const cachedTrips = await offlineStorage.loadTrips();
        setTrips(cachedTrips);
        await offlineStorage.saveTrips(cachedTrips);
        setLoading(false);
        return cachedTrips;
      } catch {
        setError('Offline - showing cached trips');
        setLoading(false);
        return trips;
      }
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/trips`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to view your trips');
        }
        throw new Error('Failed to fetch trips');
      }

      const data = await response.json();

      // Transform and replace trips in store + offline cache so stale local
      // trips don't linger.
      const transformedTrips = (data.trips || []).map((t: ApiTrip) => transformApiTrip(t));
      setTrips(transformedTrips);

      // Save to offline storage for caching
      await offlineStorage.saveTrips(transformedTrips);

      return transformedTrips;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('Error fetching trips:', err);

      // Fallback to cached trips on error
      const cachedTrips = await offlineStorage.loadTrips();
      return cachedTrips.length > 0 ? cachedTrips : [];
    } finally {
      setLoading(false);
    }
  }, [setTrips, trips]);

  // Create a new trip (with offline support)
  const createTrip = useCallback(
    async (input: TripInput) => {
      setLoading(true);
      setError(null);

      // Generate local ID for offline scenario
      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // If offline, create locally and queue for sync
      if (!networkMonitor.isOnline()) {
        const localTrip: Trip = {
          id: localId,
          destination: input.destination,
          country: input.country || '',
          startDate: input.startDate,
          endDate: input.endDate,
          travelers: input.travelers,
          travelerType: input.travelerType,
          originCity: input.originCity,
          originAirport: input.originAirport,
          vibes: input.vibes,
          budget: input.budget,
          days: [],
          coverImage: getImageUrl(IMAGE_PATHS.blog['ultimate-guide-planning-trip-with-ai']),
          createdAt: new Date().toISOString(),
          status: 'draft',
        };

        saveTrip(localTrip);
        setCurrentTrip(localTrip);

        // Queue for sync when online
        await syncService.queueCreate(localTrip);

        setLoading(false);
        return localTrip;
      }

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/api/trips`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            destination: input.destination,
            start_date: input.startDate,
            end_date: input.endDate,
            travelers: input.travelers,
            preferences: {
              travelerType: input.travelerType,
              originCity: input.originCity,
              originAirport: input.originAirport,
              vibes: input.vibes,
              budget: input.budget,
            },
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to create a trip');
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create trip');
        }

        const data = await response.json();
        const trip = transformApiTrip(data.trip);

        saveTrip(trip);
        setCurrentTrip(trip);

        return trip;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        console.error('Error creating trip:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [saveTrip, setCurrentTrip]
  );

  // Get trip by ID
  const getTripById = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/api/trips/${id}`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to view this trip');
          }
          if (response.status === 404) {
            throw new Error('Trip not found');
          }
          throw new Error('Failed to fetch trip');
        }

        const data = await response.json();
        // API returns { trip, itinerary } as separate top-level keys
        const trip = transformApiTrip(data.trip, data.itinerary);

        setCurrentTrip(trip);
        return trip;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        console.error('Error fetching trip:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setCurrentTrip]
  );

  // Update a trip (with offline support)
  const updateTrip = useCallback(
    async (id: string, updates: Partial<TripInput>) => {
      setLoading(true);
      setError(null);

      // If offline, update locally and queue for sync. Read fresh trips from
      // the store rather than the captured closure value so this works
      // immediately after a `setTrips` call without an intervening re-render.
      if (!networkMonitor.isOnline()) {
        const existingTrip = useTripStore.getState().trips.find((t) => t.id === id);
        if (!existingTrip) {
          setLoading(false);
          return undefined;
        }
        const updatedTrip = { ...existingTrip, ...updates } as Trip;
        saveTrip(updatedTrip);
        await syncService.queueUpdate(id, updates);
        setLoading(false);
        return updatedTrip;
      }

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/api/trips/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to update this trip');
          }
          throw new Error('Failed to update trip');
        }

        const data = await response.json();
        const trip = transformApiTrip(data.trip, data.itinerary);

        saveTrip(trip);
        return trip;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        console.error('Error updating trip:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [saveTrip]
  );

  // Delete a trip (with offline support)
  const deleteTrip = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      // If offline, delete locally and queue for sync
      if (!networkMonitor.isOnline()) {
        removeFromStore(id);
        await syncService.queueDelete(id);
        setLoading(false);
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/api/trips/${id}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to delete this trip');
          }
          throw new Error('Failed to delete trip');
        }

        removeFromStore(id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        console.error('Error deleting trip:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [removeFromStore]
  );

  // Generate itinerary for a trip
  const generateItinerary = useCallback(async (tripId: string) => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to generate itinerary');
      }

      const data = await response.json();
      return data;
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
