import { create } from 'zustand';
import { offlineStorage } from '../lib/offline';
import { logger } from '../lib/logger';
import { useUserStore } from './userStore';

import type { TripDay, Hotel } from '../lib/itineraryTypes';
export type { Activity, TripActivity, TripDay, Hotel } from '../lib/itineraryTypes';

export interface Trip {
  planNeedsRefresh?: boolean;
  id: string;
  destination: string;
  country: string;
  placeId?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType: string;
  originCity?: string;
  originAirport?: string;
  vibes: string[];
  budget?: string;
  days: TripDay[];
  hotel?: Hotel;
  coverImage: string;
  createdAt: string;
  updatedAt?: string;
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
  originCity?: string;
  originAirport?: string;
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
  applyQueuedTrip: (trip: Trip) => void;
  applyQueuedDeletion: (id: string) => void;
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

export const useTripStore = create<TripStore>((set, _get) => ({
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
    offlineStorage.saveTrip(trip).catch((error) => {
      logger.warn('[TripStore] Failed to save generated trip offline:', error);
    });

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
    offlineStorage.saveTrip(trip).catch((error) => {
      logger.warn('[TripStore] Failed to save trip offline:', error);
    });

    set((state) => ({
      trips: state.trips.some((t) => t.id === trip.id)
        ? state.trips.map((t) => (t.id === trip.id ? trip : t))
        : [trip, ...state.trips],
    }));
  },

  // The queue already durably owns these changes. Keep the canonical cache
  // intact so discarding a pending edit reveals the previous saved snapshot.
  applyQueuedTrip: (trip) =>
    set((state) => ({
      trips: state.trips.some((item) => item.id === trip.id)
        ? state.trips.map((item) => (item.id === trip.id ? trip : item))
        : [trip, ...state.trips],
      currentTrip: state.currentTrip?.id === trip.id ? trip : state.currentTrip,
    })),
  applyQueuedDeletion: (id) =>
    set((state) => ({
      trips: state.trips.filter((trip) => trip.id !== id),
      currentTrip: state.currentTrip?.id === id ? null : state.currentTrip,
    })),

  deleteTrip: (id) => {
    // Delete from offline storage
    offlineStorage.deleteTrip(id).catch((error) => {
      logger.warn('[TripStore] Failed to delete trip offline:', error);
    });

    set((state) => ({
      trips: state.trips.filter((t) => t.id !== id),
      currentTrip: state.currentTrip?.id === id ? null : state.currentTrip,
    }));
  },

  setCurrentTrip: (trip) => set({ currentTrip: trip }),

  // Hydrate store from offline storage
  hydrateFromOffline: async () => {
    const account = useUserStore.getState();
    const isCurrent = () => {
      const current = useUserStore.getState();
      return (
        current.user?.id === account.user?.id && current.accountRevision === account.accountRevision
      );
    };
    if (!account.user) {
      set({ trips: [], currentTrip: null, isHydrated: true });
      return;
    }
    try {
      const trips = await offlineStorage.loadTrips();
      if (!isCurrent()) return;
      set({ trips, isHydrated: true });
      logger.info(`[TripStore] Hydrated ${trips.length} trips from offline storage`);
    } catch (error) {
      if (!isCurrent()) return;
      logger.warn('[TripStore] Failed to hydrate from offline:', error);
      set({ isHydrated: true });
    }
  },

  // Set trips directly (used by sync)
  setTrips: (trips) => {
    // Also save to offline storage
    offlineStorage.saveTrips(trips).catch((error) => {
      logger.warn('[TripStore] Failed to save trips offline:', error);
    });
    set({ trips });
  },

  // Clear all data (for logout)
  clearAll: () => {
    offlineStorage.clearAll().catch((error) => {
      logger.warn('[TripStore] Failed to clear offline trips:', error);
    });
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
