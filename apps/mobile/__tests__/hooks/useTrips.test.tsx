jest.mock('../../lib/supabase', () => ({
  API_BASE_URL: 'http://localhost:3000',
  getAuthHeaders: jest.fn(() => Promise.resolve({ Authorization: 'Bearer token' })),
}));

jest.mock('../../lib/offline', () => ({
  offlineStorage: {
    loadTrips: jest.fn(() => Promise.resolve([])),
    saveTrip: jest.fn(() => Promise.resolve()),
    saveTrips: jest.fn(() => Promise.resolve()),
    deleteTrip: jest.fn(() => Promise.resolve()),
    clearAll: jest.fn(() => Promise.resolve()),
  },
  networkMonitor: {
    isOnline: jest.fn(() => true),
  },
  syncService: {
    queueCreate: jest.fn(() => Promise.resolve()),
    queueUpdate: jest.fn(() => Promise.resolve()),
    queueDelete: jest.fn(() => Promise.resolve()),
  },
}));

import React from 'react';
import { useTrips } from '../../hooks/useTrips';
import { useTripStore, type Trip } from '../../stores/tripStore';

const { renderToString } = require('react-dom/server') as {
  renderToString: (element: React.ReactElement) => string;
};
const { offlineStorage, networkMonitor, syncService } = require('../../lib/offline');

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function makeTrip(id: string, destination: string): Trip {
  return {
    id,
    destination,
    country: 'Japan',
    startDate: '2026-04-01',
    endDate: '2026-04-07',
    travelers: 2,
    travelerType: 'couple',
    vibes: ['food'],
    days: [],
    coverImage: '/cover.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'planned',
  };
}

function makeApiTrip(id: string, destination: string) {
  return {
    id,
    user_id: 'user-1',
    destination,
    country: 'Japan',
    start_date: '2026-04-01',
    end_date: '2026-04-07',
    travelers: 2,
    traveler_type: 'couple',
    vibes: ['food'],
    budget: 'mid-range',
    budget_tier: 'luxury',
    status: 'generated',
    cover_image: '/cover.jpg',
    itinerary: { days: [] },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function renderUseTrips() {
  let value: ReturnType<typeof useTrips> | undefined;

  function Harness() {
    value = useTrips();
    return null;
  }

  renderToString(React.createElement(Harness));
  if (!value) throw new Error('useTrips harness did not render');
  return value as ReturnType<typeof useTrips>;
}

beforeEach(() => {
  jest.clearAllMocks();
  networkMonitor.isOnline.mockReturnValue(true);
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

describe('useTrips', () => {
  it('replaces stale local trips with the backend trip list when fetching', async () => {
    useTripStore
      .getState()
      .setTrips([makeTrip('trip-stale', 'Kyoto'), makeTrip('trip-kept', 'Tokyo')]);
    jest.clearAllMocks();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ trips: [makeApiTrip('trip-kept', 'Tokyo')] }),
    });

    const tripsApi = renderUseTrips();
    const trips = await tripsApi.fetchTrips();

    expect(trips.map((trip: Trip) => trip.id)).toEqual(['trip-kept']);
    expect(useTripStore.getState().trips.map((trip) => trip.id)).toEqual(['trip-kept']);
    expect(trips[0].budget).toBe('luxury');
    expect(offlineStorage.saveTrips).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'trip-kept', status: 'planned', budget: 'luxury' }),
    ]);
    expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
  });

  it('uses cached trips as the offline list in one store update', async () => {
    networkMonitor.isOnline.mockReturnValue(false);
    const cachedTrips = [makeTrip('trip-cached', 'Osaka')];
    offlineStorage.loadTrips.mockResolvedValueOnce(cachedTrips);

    const tripsApi = renderUseTrips();
    const trips = await tripsApi.fetchTrips();

    expect(trips).toEqual(cachedTrips);
    expect(useTripStore.getState().trips).toEqual(cachedTrips);
    expect(offlineStorage.saveTrips).toHaveBeenCalledWith(cachedTrips);
    expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
  });

  it('does not expose old booking cards after a brief edit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trip: {
          ...makeApiTrip('trip-1', 'Paris'),
          preferences: { planNeedsRefresh: true },
        },
        itinerary: {
          topHotel: { name: 'Old hotel', bookingUrl: 'https://example.invalid/hotel' },
          days: [
            { activities: [{ title: 'Old tour', bookingUrl: 'https://example.invalid/tour' }] },
          ],
        },
      }),
    });
    const trip = await renderUseTrips().getTripById('trip-1');
    expect(trip.planNeedsRefresh).toBe(true);
    expect(trip.days).toEqual([]);
    expect(trip.hotel).toBeUndefined();
  });

  it('returns the updated trip when queueing an offline update', async () => {
    networkMonitor.isOnline.mockReturnValue(false);
    const originalTrip = makeTrip('trip-1', 'Tokyo');
    useTripStore.getState().setTrips([originalTrip]);
    jest.clearAllMocks();

    const tripsApi = renderUseTrips();
    const updated = await tripsApi.updateTrip('trip-1', { destination: 'Osaka' });

    expect(updated?.destination).toBe('Osaka');
    expect(useTripStore.getState().trips[0].destination).toBe('Osaka');
    expect(syncService.queueUpdate).toHaveBeenCalledWith('trip-1', { destination: 'Osaka' });
  });
});
