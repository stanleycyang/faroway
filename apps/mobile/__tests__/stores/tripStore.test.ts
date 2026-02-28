import { useTripStore } from '../../stores/tripStore';
import type { Trip } from '../../stores/tripStore';

// Mock offline storage
jest.mock('../../lib/offline', () => ({
  offlineStorage: {
    saveTrip: jest.fn(() => Promise.resolve()),
    saveTrips: jest.fn(() => Promise.resolve()),
    deleteTrip: jest.fn(() => Promise.resolve()),
    loadTrips: jest.fn(() => Promise.resolve([])),
    clearAll: jest.fn(() => Promise.resolve()),
  },
}));

const { offlineStorage } = require('../../lib/offline');

const makeMockTrip = (id: string, destination = 'Tokyo'): Trip => ({
  id,
  destination,
  country: 'Japan',
  startDate: '2026-04-01',
  endDate: '2026-04-07',
  travelers: 2,
  travelerType: 'couple',
  vibes: ['adventure'],
  days: [],
  coverImage: '/tokyo.jpg',
  createdAt: '2026-01-01T00:00:00Z',
  status: 'draft',
});

beforeEach(() => {
  jest.clearAllMocks();
  useTripStore.setState({
    trips: [],
    currentTrip: null,
    draftInput: {
      destination: '',
      startDate: '',
      endDate: '',
      travelers: 2,
      travelerType: 'couple',
      vibes: [],
    },
    isGenerating: false,
    generationProgress: 0,
    isHydrated: false,
  });
});

describe('useTripStore', () => {
  describe('initial state', () => {
    it('starts with empty trips and default draft', () => {
      const state = useTripStore.getState();
      expect(state.trips).toEqual([]);
      expect(state.currentTrip).toBeNull();
      expect(state.isGenerating).toBe(false);
      expect(state.generationProgress).toBe(0);
      expect(state.draftInput?.travelers).toBe(2);
    });
  });

  describe('setDraftInput', () => {
    it('merges partial input into existing draft', () => {
      useTripStore.getState().setDraftInput({ destination: 'Paris' });
      const state = useTripStore.getState();
      expect(state.draftInput?.destination).toBe('Paris');
      expect(state.draftInput?.travelers).toBe(2);
    });

    it('updates multiple fields', () => {
      useTripStore.getState().setDraftInput({
        destination: 'Tokyo',
        startDate: '2026-04-01',
        endDate: '2026-04-07',
        travelers: 4,
      });
      const state = useTripStore.getState();
      expect(state.draftInput?.destination).toBe('Tokyo');
      expect(state.draftInput?.travelers).toBe(4);
    });
  });

  describe('clearDraft', () => {
    it('resets draft to defaults', () => {
      useTripStore.getState().setDraftInput({ destination: 'Paris' });
      useTripStore.getState().clearDraft();
      const state = useTripStore.getState();
      expect(state.draftInput?.destination).toBe('');
      expect(state.draftInput?.travelers).toBe(2);
    });
  });

  describe('startGeneration', () => {
    it('sets isGenerating to true and progress to 0', () => {
      useTripStore.getState().startGeneration();
      const state = useTripStore.getState();
      expect(state.isGenerating).toBe(true);
      expect(state.generationProgress).toBe(0);
    });
  });

  describe('setGenerationProgress', () => {
    it('updates generation progress', () => {
      useTripStore.getState().setGenerationProgress(50);
      expect(useTripStore.getState().generationProgress).toBe(50);
    });
  });

  describe('finishGeneration', () => {
    it('adds trip, sets current, resets generation state, and saves offline', () => {
      useTripStore.getState().startGeneration();
      const trip = makeMockTrip('trip-1');
      useTripStore.getState().finishGeneration(trip);
      const state = useTripStore.getState();

      expect(state.isGenerating).toBe(false);
      expect(state.generationProgress).toBe(100);
      expect(state.currentTrip).toEqual(trip);
      expect(state.trips).toHaveLength(1);
      expect(state.trips[0].id).toBe('trip-1');
      expect(state.draftInput?.destination).toBe('');
      expect(offlineStorage.saveTrip).toHaveBeenCalledWith(trip);
    });
  });

  describe('saveTrip', () => {
    it('adds a new trip to the list', () => {
      const trip = makeMockTrip('trip-1');
      useTripStore.getState().saveTrip(trip);
      expect(useTripStore.getState().trips).toHaveLength(1);
      expect(offlineStorage.saveTrip).toHaveBeenCalledWith(trip);
    });

    it('updates an existing trip by ID', () => {
      const trip = makeMockTrip('trip-1');
      useTripStore.getState().saveTrip(trip);
      const updated = { ...trip, destination: 'Osaka' };
      useTripStore.getState().saveTrip(updated);
      const state = useTripStore.getState();
      expect(state.trips).toHaveLength(1);
      expect(state.trips[0].destination).toBe('Osaka');
    });
  });

  describe('deleteTrip', () => {
    it('removes trip from list and clears currentTrip if matching', () => {
      const trip = makeMockTrip('trip-1');
      useTripStore.getState().saveTrip(trip);
      useTripStore.getState().setCurrentTrip(trip);
      useTripStore.getState().deleteTrip('trip-1');
      const state = useTripStore.getState();
      expect(state.trips).toHaveLength(0);
      expect(state.currentTrip).toBeNull();
      expect(offlineStorage.deleteTrip).toHaveBeenCalledWith('trip-1');
    });

    it('does not clear currentTrip if different ID', () => {
      const trip1 = makeMockTrip('trip-1');
      const trip2 = makeMockTrip('trip-2', 'Paris');
      useTripStore.getState().saveTrip(trip1);
      useTripStore.getState().saveTrip(trip2);
      useTripStore.getState().setCurrentTrip(trip1);
      useTripStore.getState().deleteTrip('trip-2');
      const state = useTripStore.getState();
      expect(state.trips).toHaveLength(1);
      expect(state.currentTrip?.id).toBe('trip-1');
    });
  });

  describe('setCurrentTrip', () => {
    it('sets current trip', () => {
      const trip = makeMockTrip('trip-1');
      useTripStore.getState().setCurrentTrip(trip);
      expect(useTripStore.getState().currentTrip).toEqual(trip);
    });

    it('clears current trip with null', () => {
      const trip = makeMockTrip('trip-1');
      useTripStore.getState().setCurrentTrip(trip);
      useTripStore.getState().setCurrentTrip(null);
      expect(useTripStore.getState().currentTrip).toBeNull();
    });
  });

  describe('hydrateFromOffline', () => {
    it('loads trips from offline storage', async () => {
      const trips = [makeMockTrip('trip-1'), makeMockTrip('trip-2')];
      offlineStorage.loadTrips.mockResolvedValue(trips);

      await useTripStore.getState().hydrateFromOffline();
      const state = useTripStore.getState();
      expect(state.trips).toEqual(trips);
      expect(state.isHydrated).toBe(true);
    });

    it('sets isHydrated even on error', async () => {
      offlineStorage.loadTrips.mockRejectedValue(new Error('Storage failed'));

      await useTripStore.getState().hydrateFromOffline();
      expect(useTripStore.getState().isHydrated).toBe(true);
    });
  });

  describe('setTrips', () => {
    it('replaces all trips and saves to offline', () => {
      const trips = [makeMockTrip('trip-1'), makeMockTrip('trip-2')];
      useTripStore.getState().setTrips(trips);
      expect(useTripStore.getState().trips).toEqual(trips);
      expect(offlineStorage.saveTrips).toHaveBeenCalledWith(trips);
    });
  });

  describe('clearAll', () => {
    it('resets all state and clears offline storage', () => {
      useTripStore.getState().saveTrip(makeMockTrip('trip-1'));
      useTripStore.getState().setCurrentTrip(makeMockTrip('trip-1'));
      useTripStore.getState().clearAll();
      const state = useTripStore.getState();
      expect(state.trips).toEqual([]);
      expect(state.currentTrip).toBeNull();
      expect(state.isGenerating).toBe(false);
      expect(state.isHydrated).toBe(false);
      expect(offlineStorage.clearAll).toHaveBeenCalled();
    });
  });
});
