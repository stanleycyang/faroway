const mutations = [
  {
    id: 'queued',
    type: 'update',
    tripId: 'saved-trip',
    data: { destination: 'Paris' },
    timestamp: 1,
    retryCount: 3,
  },
];
const remove = jest.fn();
const block = jest.fn();
const success = jest.fn();
const failed = jest.fn();
jest.mock('../../../constants/api', () => ({ API_TIMEOUT: 90_000 }));
jest.mock('../../../lib/offline/storage', () => ({
  offlineStorage: {
    getPendingMutations: jest.fn(async () => mutations),
    removePendingMutation: remove,
    blockPendingMutation: block,
    getSyncMeta: jest.fn(async () => ({ pendingCount: 1 })),
    loadSavedTrips: jest.fn(async () => []),
    saveTrips: jest.fn(),
    recordSuccessfulSync: success,
    recordFailedSync: failed,
  },
}));
jest.mock('../../../lib/offline/network', () => ({ networkMonitor: { isOnline: () => true } }));
jest.mock('../../../lib/supabase', () => ({
  API_BASE_URL: 'http://fixture.test',
  getAuthHeaders: async () => ({ Authorization: 'Bearer fixture' }),
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'owner' }, access_token: 'fixture' } },
        error: null,
      }),
    },
  },
}));
import { syncService } from '../../../lib/offline/sync';
import { useUserStore } from '../../../stores/userStore';
it('retains exhausted edits for traveler review and reports a failed sync', async () => {
  useUserStore.getState().setUser({
    id: 'owner',
    name: 'Fixture',
    email: 'fixture@example.invalid',
    preferences: { vibes: [] },
  });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ trips: [] }),
  })) as unknown as typeof fetch;
  const result = await syncService.sync(true);
  expect(block).toHaveBeenCalledWith('queued', expect.stringContaining('Your changes are saved'));
  expect(remove).not.toHaveBeenCalled();
  expect(result).toMatchObject({ success: false, failed: 1, synced: 0 });
  expect(success).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalled();
});

it('preserves same-revision offline itinerary detail during background summary sync', async () => {
  const { offlineStorage } = require('../../../lib/offline/storage');
  offlineStorage.getPendingMutations.mockResolvedValueOnce([]);
  const detail = {
    id: 'saved-trip',
    destination: 'Paris',
    country: '',
    startDate: '2099-06-01',
    endDate: '2099-06-02',
    travelers: 2,
    travelerType: 'family',
    vibes: [],
    days: [{ date: '2099-06-01', dayNumber: 1, theme: 'Saved day', activities: [] }],
    coverImage: '',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
    status: 'planned',
  };
  offlineStorage.loadSavedTrips.mockResolvedValueOnce([detail]);
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      trips: [
        {
          id: 'saved-trip',
          user_id: 'owner',
          destination: 'Paris',
          start_date: '2099-06-01',
          end_date: '2099-06-02',
          travelers: 2,
          vibes: [],
          created_at: '2026-01-01',
          updated_at: '2026-01-02',
          status: 'planned',
        },
      ],
    }),
  })) as unknown as typeof fetch;
  await syncService.sync(true);
  expect(offlineStorage.saveTrips).toHaveBeenLastCalledWith(
    [expect.objectContaining({ days: detail.days })],
    'owner'
  );
});

it.each(['changed revision', 'stale plan', 'explicit empty itinerary'])(
  'discards cached detail during sync for %s',
  async (scenario) => {
    const { offlineStorage } = require('../../../lib/offline/storage');
    offlineStorage.getPendingMutations.mockResolvedValueOnce([]);
    const detail = {
      id: 'saved-trip',
      destination: 'Paris',
      country: '',
      startDate: '2099-06-01',
      endDate: '2099-06-02',
      travelers: 2,
      travelerType: 'family',
      vibes: [],
      days: [{ date: '2099-06-01', dayNumber: 1, theme: 'Saved day', activities: [] }],
      coverImage: '',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      status: 'planned',
    };
    offlineStorage.loadSavedTrips.mockResolvedValueOnce([detail]);
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        trips: [
          {
            id: 'saved-trip',
            user_id: 'owner',
            destination: 'Paris',
            start_date: '2099-06-01',
            end_date: '2099-06-02',
            travelers: 2,
            vibes: [],
            created_at: '2026-01-01',
            updated_at: '2026-01-02',
            status: 'planned',
            ...(scenario === 'changed revision' ? { updated_at: '2026-01-03' } : {}),
            ...(scenario === 'stale plan' ? { preferences: { planNeedsRefresh: true } } : {}),
            ...(scenario === 'explicit empty itinerary' ? { itinerary: { days: [] } } : {}),
          },
        ],
      }),
    })) as unknown as typeof fetch;
    await syncService.sync(true);
    expect(offlineStorage.saveTrips).toHaveBeenLastCalledWith(
      [expect.objectContaining({ days: [] })],
      'owner'
    );
  }
);
