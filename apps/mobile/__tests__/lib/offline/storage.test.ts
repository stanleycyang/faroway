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
});

it('preserves a conflicted edit for review instead of exhausting retry attempts', async () => {
  const mutation = await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'conflicted-trip',
    data: { expectedUpdatedAt: 'old-revision', destination: 'Vienna' },
  });
  await offlineStorage.blockPendingMutation(
    mutation.id,
    'Load the latest trip and review your changes'
  );
  const pending = await offlineStorage.getPendingMutations();
  expect(pending.find((item) => item.id === mutation.id)).toMatchObject({
    retryCount: 0,
    blockedReason: 'Load the latest trip and review your changes',
    data: { expectedUpdatedAt: 'old-revision', destination: 'Vienna' },
  });
});

it('does not silently rebase earlier queued edits onto a newly cached revision', async () => {
  await offlineStorage.clearAll();
  await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'versioned',
    data: { destination: 'Rome', expectedUpdatedAt: 'original' },
  });
  await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'versioned',
    data: { travelers: 3, expectedUpdatedAt: 'newer-device-version' },
  });
  expect((await offlineStorage.getPendingMutations())[0].data).toEqual({
    destination: 'Rome',
    travelers: 3,
    expectedUpdatedAt: 'original',
  });
});
