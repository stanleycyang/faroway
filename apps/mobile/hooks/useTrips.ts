import { useState, useCallback } from 'react';
import { supabase, API_BASE_URL, getAuthHeaders } from '../lib/supabase';
import { useTripStore, Trip, TripInput } from '../stores/tripStore';
import { syncService, networkMonitor, offlineStorage } from '../lib/offline';

interface ApiTrip {
  id: string;
  user_id: string;
  destination: string;
  country?: string;
  start_date: string;
  end_date: string;
  travelers: number;
  traveler_type?: string;
  vibes?: string[];
  budget?: string;
  status: string;
  cover_image?: string;
  itinerary?: any;
  created_at: string;
  updated_at: string;
}

// Transform API trip to app Trip format
function transformApiTrip(apiTrip: ApiTrip): Trip {
  return {
    id: apiTrip.id,
    destination: apiTrip.destination,
    country: apiTrip.country || '',
    startDate: apiTrip.start_date,
    endDate: apiTrip.end_date,
    travelers: apiTrip.travelers,
    travelerType: apiTrip.traveler_type || 'solo',
    vibes: apiTrip.vibes || [],
    budget: apiTrip.budget,
    days: apiTrip.itinerary?.days || [],
    coverImage: apiTrip.cover_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828',
    createdAt: apiTrip.created_at,
    status: apiTrip.status as Trip['status'],
  };
}

export function useTrips() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trips, saveTrip, deleteTrip: removeFromStore, setCurrentTrip } = useTripStore();

  // Fetch all trips from backend (with offline fallback)
  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);

    // If offline, return cached trips
    if (!networkMonitor.isOnline()) {
      try {
        const cachedTrips = await offlineStorage.loadTrips();
        cachedTrips.forEach((trip: Trip) => saveTrip(trip));
        setLoading(false);
        return cachedTrips;
      } catch (err: any) {
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
      
      // Transform and save trips to store and offline storage
      const transformedTrips = (data.trips || []).map(transformApiTrip);
      transformedTrips.forEach((trip: Trip) => saveTrip(trip));
      
      // Save to offline storage for caching
      await offlineStorage.saveTrips(transformedTrips);
      
      return transformedTrips;
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching trips:', err);
      
      // Fallback to cached trips on error
      const cachedTrips = await offlineStorage.loadTrips();
      return cachedTrips.length > 0 ? cachedTrips : [];
    } finally {
      setLoading(false);
    }
  }, [saveTrip, trips]);

  // Create a new trip (with offline support)
  const createTrip = useCallback(async (input: TripInput) => {
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
        vibes: input.vibes,
        budget: input.budget,
        days: [],
        coverImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828',
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
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating trip:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveTrip, setCurrentTrip]);

  // Get trip by ID
  const getTripById = useCallback(async (id: string) => {
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
      const trip = transformApiTrip(data.trip);
      
      setCurrentTrip(trip);
      return trip;
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching trip:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setCurrentTrip]);

  // Update a trip (with offline support)
  const updateTrip = useCallback(async (id: string, updates: Partial<TripInput>) => {
    setLoading(true);
    setError(null);

    // If offline, update locally and queue for sync
    if (!networkMonitor.isOnline()) {
      const existingTrip = trips.find(t => t.id === id);
      if (existingTrip) {
        const updatedTrip = { ...existingTrip, ...updates } as Trip;
        saveTrip(updatedTrip);
        await syncService.queueUpdate(id, updates);
      }
      setLoading(false);
      return existingTrip;
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
      const trip = transformApiTrip(data.trip);
      
      saveTrip(trip);
      return trip;
    } catch (err: any) {
      setError(err.message);
      console.error('Error updating trip:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveTrip, trips]);

  // Delete a trip (with offline support)
  const deleteTrip = useCallback(async (id: string) => {
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
    } catch (err: any) {
      setError(err.message);
      console.error('Error deleting trip:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [removeFromStore]);

  // Generate itinerary for a trip
  const generateItinerary = useCallback(async (tripId: string) => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/itinerary/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tripId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate itinerary');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
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
