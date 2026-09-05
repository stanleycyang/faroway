jest.mock('../../lib/offline/storage', () => ({
  offlineStorage: {},
}));

jest.mock('../../lib/offline/network', () => ({
  networkMonitor: {},
}));

jest.mock('../../lib/supabase', () => ({
  API_BASE_URL: 'http://localhost:3000',
  getAuthHeaders: jest.fn(),
}));

jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  API_TIMEOUT: 5000,
}));

import {
  buildTripCreatePayload,
  buildTripUpdatePayload,
  mergeTripsForSync,
} from '../../lib/offline/sync';
import type { PendingMutation } from '../../lib/offline/storage';
import type { Trip } from '../../stores/tripStore';

describe('offline sync payloads', () => {
  const trip: Trip = {
    id: 'local_1',
    destination: 'Tokyo',
    country: 'Japan',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    travelers: 2,
    travelerType: 'couple',
    originCity: 'Los Angeles',
    originAirport: 'LAX',
    vibes: ['food', 'design'],
    budget: 'moderate',
    days: [],
    coverImage: 'https://example.com/tokyo.jpg',
    createdAt: '2026-05-01T00:00:00.000Z',
    status: 'draft',
  };

  it('serializes offline creates with backend field names', () => {
    expect(buildTripCreatePayload(trip)).toEqual({
      destination: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-05',
      travelers: 2,
      budget: 'moderate',
      preferences: {
        travelerType: 'couple',
        originCity: 'Los Angeles',
        originAirport: 'LAX',
        vibes: ['food', 'design'],
        budget: 'moderate',
      },
    });
  });

  it('serializes offline updates with backend field names', () => {
    expect(
      buildTripUpdatePayload({
        destination: 'Kyoto',
        startDate: '2026-07-01',
        endDate: '2026-07-08',
        travelers: 3,
        travelerType: 'friends',
        vibes: ['nightlife'],
      })
    ).toEqual({
      destination: 'Kyoto',
      start_date: '2026-07-01',
      end_date: '2026-07-08',
      travelers: 3,
      vibes: ['nightlife'],
      preferences: {
        travelerType: 'friends',
      },
    });
  });

  it('does not overwrite pending local edits while pulling server trips', () => {
    const localEdit = { ...trip, id: 'trip-1', destination: 'Local Kyoto' };
    const serverVersion = { ...trip, id: 'trip-1', destination: 'Stale Tokyo' };
    const pending: PendingMutation[] = [
      {
        id: 'mutation-1',
        type: 'update',
        tripId: 'trip-1',
        data: { destination: 'Local Kyoto' },
        timestamp: 1,
        retryCount: 3,
      },
    ];

    expect(mergeTripsForSync([localEdit], [serverVersion], pending)).toEqual([localEdit]);
  });

  it('keeps pending deletes hidden while pulling server trips', () => {
    const serverVersion = { ...trip, id: 'trip-1' };
    const pending: PendingMutation[] = [
      {
        id: 'mutation-1',
        type: 'delete',
        tripId: 'trip-1',
        timestamp: 1,
        retryCount: 3,
      },
    ];

    expect(mergeTripsForSync([], [serverVersion], pending)).toEqual([]);
  });
});
