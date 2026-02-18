import { create } from 'zustand';
import { offlineStorage } from '../lib/offline';

export interface Activity {
  id: string;
  time: string;
  title: string;
  description: string;
  location: string;
  duration: string;
  type: 'activity' | 'restaurant' | 'transport' | 'accommodation' | 'attraction' | 'experience';
  price?: string;
  bookingUrl?: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  topReview?: string;
  freeCancellation?: boolean;
  isSaved?: boolean;
}

// Alias for backward compatibility
export type TripActivity = Activity;

export interface Hotel {
  id: string;
  name: string;
  description: string;
  pricePerNight: number;
  totalPrice: number;
  rating: number;
  reviewCount: number;
  amenities: string[];
  images: string[];
  bookingUrl: string;
  location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    neighborhood?: string;
  };
}

export interface TripDay {
  date: string;
  dayNumber: number;
  theme: string;
  activities: Activity[];
}

export interface Trip {
  id: string;
  destination: string;
  country: string;
  placeId?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType: string;
  vibes: string[];
  budget?: string;
  days: TripDay[];
  hotel?: Hotel;
  coverImage: string;
  createdAt: string;
  status: 'draft' | 'planned' | 'active' | 'completed';
}

export interface TripInput {
  destination: string;
  country?: string;
  placeId?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType: string;
  vibes: string[];
  budget?: string;
}

interface TripStore {
  trips: Trip[];
  currentTrip: Trip | null;
  draftInput: TripInput | null;
  isGenerating: boolean;
  generationProgress: number;
  isHydrated: boolean;
  
  // Actions
  setDraftInput: (input: Partial<TripInput>) => void;
  clearDraft: () => void;
  startGeneration: () => void;
  setGenerationProgress: (progress: number) => void;
  finishGeneration: (trip: Trip) => void;
  saveTrip: (trip: Trip) => void;
  deleteTrip: (id: string) => void;
  setCurrentTrip: (trip: Trip | null) => void;
  
  // Offline support
  hydrateFromOffline: () => Promise<void>;
  setTrips: (trips: Trip[]) => void;
  clearAll: () => void;
}

const defaultDraft: TripInput = {
  destination: '',
  startDate: '',
  endDate: '',
  travelers: 2,
  travelerType: 'couple',
  vibes: [],
};

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  currentTrip: null,
  draftInput: { ...defaultDraft },
  isGenerating: false,
  generationProgress: 0,
  isHydrated: false,

  setDraftInput: (input) =>
    set((state) => ({
      draftInput: state.draftInput
        ? { ...state.draftInput, ...input }
        : { ...defaultDraft, ...input },
    })),

  clearDraft: () => set({ draftInput: { ...defaultDraft } }),

  startGeneration: () => set({ isGenerating: true, generationProgress: 0 }),

  setGenerationProgress: (progress) => set({ generationProgress: progress }),

  finishGeneration: (trip) => {
    // Save to offline storage
    offlineStorage.saveTrip(trip).catch(console.error);
    
    set((state) => ({
      isGenerating: false,
      generationProgress: 100,
      currentTrip: trip,
      trips: [trip, ...state.trips],
      draftInput: { ...defaultDraft },
    }));
  },

  saveTrip: (trip) => {
    // Save to offline storage
    offlineStorage.saveTrip(trip).catch(console.error);
    
    set((state) => ({
      trips: state.trips.some((t) => t.id === trip.id)
        ? state.trips.map((t) => (t.id === trip.id ? trip : t))
        : [trip, ...state.trips],
    }));
  },

  deleteTrip: (id) => {
    // Delete from offline storage
    offlineStorage.deleteTrip(id).catch(console.error);
    
    set((state) => ({
      trips: state.trips.filter((t) => t.id !== id),
      currentTrip: state.currentTrip?.id === id ? null : state.currentTrip,
    }));
  },

  setCurrentTrip: (trip) => set({ currentTrip: trip }),

  // Hydrate store from offline storage
  hydrateFromOffline: async () => {
    try {
      const trips = await offlineStorage.loadTrips();
      set({ trips, isHydrated: true });
      console.log(`[TripStore] Hydrated ${trips.length} trips from offline storage`);
    } catch (error) {
      console.error('[TripStore] Failed to hydrate from offline:', error);
      set({ isHydrated: true });
    }
  },

  // Set trips directly (used by sync)
  setTrips: (trips) => {
    // Also save to offline storage
    offlineStorage.saveTrips(trips).catch(console.error);
    set({ trips });
  },

  // Clear all data (for logout)
  clearAll: () => {
    offlineStorage.clearAll().catch(console.error);
    set({
      trips: [],
      currentTrip: null,
      draftInput: { ...defaultDraft },
      isGenerating: false,
      generationProgress: 0,
      isHydrated: false,
    });
  },
}));
