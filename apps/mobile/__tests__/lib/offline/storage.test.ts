const storage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    }),
  },
}));

import { offlineStorage } from '../../../lib/offline/storage';

beforeEach(async () => {
  storage.clear();
  await offlineStorage.clearAll();
});

describe('offlineStorage pending mutations', () => {
  it('deep-merges preference payloads for create followed by update', async () => {
    await offlineStorage.addPendingMutation({
      type: 'create',
      tripId: 'local_1',
      data: {
        destination: 'Tokyo',
        start_date: '2026-06-01',
        end_date: '2026-06-05',
        travelers: 2,
        budget: 'moderate',
        preferences: {
          travelerType: 'couple',
          originCity: 'Los Angeles',
          originAirport: 'LAX',
          vibes: ['food'],
          budget: 'moderate',
        },
      },
    });

    await offlineStorage.addPendingMutation({
      type: 'update',
      tripId: 'local_1',
      data: {
        budget_tier: 'luxury',
        preferences: {
          budget: 'luxury',
        },
      },
    });

    await expect(offlineStorage.getPendingMutations()).resolves.toEqual([
      expect.objectContaining({
        type: 'create',
        tripId: 'local_1',
        data: expect.objectContaining({
          destination: 'Tokyo',
          budget_tier: 'luxury',
          preferences: {
            travelerType: 'couple',
            originCity: 'Los Angeles',
            originAirport: 'LAX',
            vibes: ['food'],
            budget: 'luxury',
          },
        }),
      }),
    ]);
  });

  it('resets retries when the user makes a new edit', async () => {
    const mutation = await offlineStorage.addPendingMutation({
      type: 'update',
      tripId: 'trip-1',
      data: { destination: 'Tokyo' },
    });
    await offlineStorage.incrementMutationRetry(mutation.id);
    await offlineStorage.incrementMutationRetry(mutation.id);
    await offlineStorage.incrementMutationRetry(mutation.id);

    await offlineStorage.addPendingMutation({
      type: 'update',
      tripId: 'trip-1',
      data: { destination: 'Kyoto' },
    });

    await expect(offlineStorage.getPendingMutations()).resolves.toEqual([
      expect.objectContaining({
        tripId: 'trip-1',
        retryCount: 0,
        data: { destination: 'Kyoto' },
      }),
    ]);
  });
});
