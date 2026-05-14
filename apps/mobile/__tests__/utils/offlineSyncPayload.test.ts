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

import { buildTripCreatePayload, buildTripUpdatePayload } from '../../lib/offline/sync';
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
        startDate: '2026-07-01',
        endDate: '2026-07-08',
        travelers: 3,
        travelerType: 'friends',
        vibes: ['nightlife'],
      })
    ).toEqual({
      start_date: '2026-07-01',
      end_date: '2026-07-08',
      travelers: 3,
      vibes: ['nightlife'],
      preferences: {
        travelerType: 'friends',
      },
    });
  });
});
