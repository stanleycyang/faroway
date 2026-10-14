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
import { useUserStore } from '../../../stores/userStore';
function signIn(id: string) {
  useUserStore
    .getState()
    .setUser({ id, name: 'Fixture', email: 'fixture@example.invalid', preferences: { vibes: [] } });
}

function cachedTrip(id: string): import('../../../stores/tripStore').Trip {
  return {
    id,
    destination: 'Kyoto',
    country: 'Japan',
    startDate: '2026-11-01',
    endDate: '2026-11-04',
    travelers: 2,
    travelerType: 'couple',
    vibes: [],
    days: [],
    coverImage: '',
    createdAt: '2026-10-13T00:00:00Z',
    status: 'draft',
  };
}

beforeEach(async () => {
  storage.clear();
  signIn('owner-a');
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

it('preserves B cache writes while account A cleanup awaits delayed removals', async () => {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const remove = AsyncStorage.removeItem as jest.Mock;
  let release!: () => void;
  let started!: () => void;
  const removing = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  remove.mockImplementationOnce(async (key: string) => {
    started();
    await gate;
    storage.delete(key);
  });
  let account = 'a';
  const cleanup = offlineStorage.clearAll(async () => {
    if (account !== 'a') throw new Error('account changed');
  });
  await removing;
  account = 'b';
  // B signs in and saves while the physical TRIPS deletion is still blocked.
  const bTrip = cachedTrip('b-trip');
  const saved = offlineStorage.saveTrips([bTrip]);
  release();
  await Promise.all([cleanup, saved]);
  expect(await offlineStorage.loadTrips()).toEqual([bTrip]);
});
it('refuses cleanup when identity changed while waiting for earlier storage work', async () => {
  storage.set(
    '@faroway/trips',
    JSON.stringify({ version: 1, ownerId: 'owner-a', trips: [cachedTrip('b-trip')] })
  );
  await expect(
    offlineStorage.clearAll(async () => {
      throw new Error('account changed');
    })
  ).rejects.toThrow('account changed');
  expect(await offlineStorage.loadTrips()).toEqual([cachedTrip('b-trip')]);
});

it('does not release queued B writes early when one removal fails and another is delayed', async () => {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const remove = AsyncStorage.removeItem as jest.Mock;
  let release!: () => void;
  let started!: () => void;
  const removing = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  remove
    .mockImplementationOnce(async (key: string) => {
      started();
      await gate;
      storage.delete(key);
    })
    .mockRejectedValueOnce(new Error('partial removal failed'));
  const cleanup = offlineStorage.clearAll().catch((error) => error.message);
  await removing;
  const bTrip = cachedTrip('b-trip');
  const saved = offlineStorage.saveTrips([bTrip]);
  release();
  expect(await cleanup).toBe('partial removal failed');
  await saved;
  expect(await offlineStorage.loadTrips()).toEqual([bTrip]);
});

it('does not assign a legacy unowned trip cache to the next traveler', async () => {
  storage.set('@faroway/trips', JSON.stringify([{ id: 'unowned-private-trip' }]));
  expect(await offlineStorage.loadTrips()).toEqual([]);
});

it('does not reveal another account cache even when logout removal fails', async () => {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await offlineStorage.saveTrips([
    { id: 'a-private' },
  ] as import('../../../stores/tripStore').Trip[]);
  (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('removal failed'));
  await expect(offlineStorage.clearAll()).rejects.toThrow('removal failed');
  signIn('owner-b');
  expect(await offlineStorage.loadTrips()).toEqual([]);
  useUserStore.getState().logout();
  expect(await offlineStorage.loadTrips()).toEqual([]);
});

it('fences a delayed private cache read across logout and re-login to the same owner', async () => {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const data = JSON.stringify({ version: 1, ownerId: 'owner-a', trips: [{ id: 'a-private' }] });
  let release!: (value: string) => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => {
    started();
    return new Promise<string>((resolve) => {
      release = resolve;
    });
  });
  const read = offlineStorage.loadTrips();
  await entered;
  useUserStore.getState().logout();
  signIn('owner-a');
  release(data);
  await expect(read).rejects.toThrow('Your account changed');
});

it('cannot stamp a foreign response with the new account owner', async () => {
  signIn('owner-b');
  await expect(
    offlineStorage.saveTrips(
      [{ id: 'a-response' }] as import('../../../stores/tripStore').Trip[],
      'owner-a'
    )
  ).rejects.toThrow('account changed');
  expect(await offlineStorage.loadTrips()).toEqual([]);
});

it('isolates pending changes and counts while preserving another owner queue', async () => {
  await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'private-a',
    data: { destination: 'Tokyo' },
  });
  signIn('owner-b');
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
  expect((await offlineStorage.getSyncMeta()).pendingCount).toBe(0);
  await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'private-b',
    data: { destination: 'Paris' },
  });
  expect((await offlineStorage.getPendingMutations()).map((item) => item.tripId)).toEqual([
    'private-b',
  ]);
  await offlineStorage.clearPendingMutations();
  signIn('owner-a');
  expect((await offlineStorage.getPendingMutations()).map((item) => item.tripId)).toEqual([
    'private-a',
  ]);
  expect((await offlineStorage.getSyncMeta()).pendingCount).toBe(1);
});

it('refuses a foreign mutation before persisting or merging its payload', async () => {
  await expect(
    offlineStorage.addPendingMutation({
      ownerId: 'owner-b',
      type: 'update',
      tripId: 'private-b',
      data: { destination: 'Paris' },
    })
  ).rejects.toThrow('account changed');
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
});

it('does not expose an unowned legacy mutation to a signed-in traveler', async () => {
  storage.set(
    '@faroway/pending_mutations',
    JSON.stringify([
      {
        id: 'legacy',
        type: 'update',
        tripId: 'unknown-owner',
        data: { destination: 'Private destination' },
      },
    ])
  );
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
});

it('exposes a cache read failure instead of claiming there are no saved trips', async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(offlineStorage.loadTrips()).rejects.toThrow('Storage unavailable');
});

it.each([
  null,
  { id: 'broken' },
  { ...cachedTrip('bad-vibes'), vibes: {} },
  { ...cachedTrip('bad-day'), days: [{ activities: null }] },
])('surfaces damaged owned cache without erasing it: %j', async (trip) => {
  const raw = JSON.stringify({ version: 1, ownerId: 'owner-a', trips: [trip] });
  storage.set('@faroway/trips', raw);
  await expect(offlineStorage.loadTrips()).rejects.toThrow('Your stored data is kept');
  expect(storage.get('@faroway/trips')).toBe(raw);
});

it('distinguishes an unreadable owned cache list from an empty list', async () => {
  const raw = JSON.stringify({ version: 1, ownerId: 'owner-a', trips: {} });
  storage.set('@faroway/trips', raw);
  await expect(offlineStorage.loadTrips()).rejects.toThrow('Your stored data is kept');
  expect(storage.get('@faroway/trips')).toBe(raw);
});

it.each([
  '{broken',
  JSON.stringify({}),
  JSON.stringify([{ ownerId: 'owner-a', id: 'bad' }]),
  JSON.stringify([
    {
      ownerId: 'owner-a',
      id: 'a',
      type: 'update',
      tripId: 'trip-a',
      timestamp: 1,
      retryCount: 0,
      localTrip: { id: 'trip-a' },
    },
  ]),
])('preserves unreadable pending changes and reports recovery: %s', async (raw) => {
  storage.set('@faroway/pending_mutations', raw);
  await expect(offlineStorage.getPendingMutations()).rejects.toThrow();
  await expect(offlineStorage.getSyncMeta()).rejects.toThrow();
  expect(storage.get('@faroway/pending_mutations')).toBe(raw);
});

it('round-trips a suggested hotel whose price is unavailable without inventing a quote', async () => {
  const { transformApiHotel } = await import('../../../lib/itineraryNormalization');
  const trip = {
    ...cachedTrip('suggested-stay'),
    hotel: transformApiHotel({ name: 'A suggested stay' }),
  };
  await offlineStorage.saveTrips([trip]);
  const restored = await offlineStorage.loadTrips();
  expect(restored[0].hotel?.name).toBe('A suggested stay');
  expect(Number.isNaN(restored[0].hotel?.pricePerNight)).toBe(true);
});
