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
    loadTrips: jest.fn(async () => []),
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
it('retains exhausted edits for traveler review and reports a failed sync', async () => {
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
