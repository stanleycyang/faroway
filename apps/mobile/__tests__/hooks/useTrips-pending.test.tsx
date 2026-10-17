// Seed the offline update API directly: no current production UI creates these edits.
// Exercise the real hook, cache, hydration, owner checks and sync with local adapters.
const storage = new Map<string, string>();
let mockOwnerId = 'owner-a';
const mockFetch = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));
jest.mock('../../constants/api', () => ({ API_TIMEOUT: 90_000 }));
jest.mock('../../services/planningService', () => ({ regenerateTrip: jest.fn() }));
jest.mock('../../lib/offline/network', () => ({ networkMonitor: { isOnline: () => true } }));
jest.mock('../../lib/supabase', () => ({
  API_BASE_URL: 'https://fixture.invalid',
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: mockOwnerId }, access_token: 'fixture' } },
        error: null,
      }),
    },
  },
}));

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderToString } from 'react-dom/server';
import { useTrips } from '../../hooks/useTrips';
import { offlineStorage, syncService } from '../../lib/offline';
import { selectTripDetail } from '../../lib/tripSummary';
import { useTripStore, type Trip } from '../../stores/tripStore';
import { useUserStore } from '../../stores/userStore';

const revision = '2026-10-17T00:00:00.123455Z';
const newerRevision = '2026-10-17T00:00:00.123456Z';
const saved: Trip = {
  id: 'trip-1',
  destination: 'Tokyo',
  country: 'Japan',
  startDate: '2026-11-01',
  endDate: '2026-11-04',
  travelers: 2,
  travelerType: 'couple',
  vibes: [],
  days: [],
  coverImage: '',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: revision,
  status: 'planned',
};

function apiTrip(destination = saved.destination, updatedAt = revision) {
  return {
    id: saved.id,
    user_id: mockOwnerId,
    destination,
    country: 'Japan',
    start_date: saved.startDate,
    end_date: saved.endDate,
    travelers: 2,
    traveler_type: 'couple',
    vibes: [],
    status: 'planned',
    created_at: saved.createdAt,
    updated_at: updatedAt,
  };
}

function signIn(owner: string) {
  mockOwnerId = owner;
  useUserStore.getState().setUser({
    id: owner,
    name: 'Fixture',
    email: 'fixture@example.invalid',
    preferences: { vibes: [] },
  });
}

function tripsApi() {
  let value!: ReturnType<typeof useTrips>;
  function Harness() {
    value = useTrips();
    return null;
  }
  renderToString(<Harness />);
  return value;
}

function visibleTrip() {
  const state = useTripStore.getState();
  return selectTripDetail(saved.id, state.trips, state.currentTrip);
}

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

// Drain promise continuations to the next event-loop turn; no timed race or network.
const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

async function seedHydratedEdit() {
  await offlineStorage.saveTrip(saved);
  await syncService.queueUpdate(saved.id, { destination: 'Queued Kyoto' });
  await useTripStore.getState().hydrateFromOffline();
  expect(useTripStore.getState().isHydrated).toBe(true);
  expect(visibleTrip()?.destination).toBe('Queued Kyoto');
}

beforeEach(async () => {
  jest.restoreAllMocks();
  storage.clear();
  mockFetch.mockReset();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => storage.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    storage.set(key, value);
  });
  global.fetch = mockFetch as typeof fetch;
  signIn('owner-a');
  useTripStore.setState({ trips: [], currentTrip: null, isHydrated: false });
  await offlineStorage.clearAll();
});

it('keeps a seeded hydrated edit visible after a newer canonical detail GET', async () => {
  await seedHydratedEdit();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      trip: apiTrip('Server Osaka', newerRevision),
      itinerary: { days: [] },
    }),
  });
  const result = await tripsApi().getTripById(saved.id);
  expect(result.destination).toBe('Queued Kyoto');
  expect(visibleTrip()?.destination).toBe('Queued Kyoto');
  expect((await offlineStorage.loadSavedTrips())[0]).toMatchObject({
    destination: 'Server Osaka',
    updatedAt: newerRevision,
  });
  expect((await offlineStorage.getPendingMutations())[0]).toMatchObject({
    data: { destination: 'Queued Kyoto', expectedUpdatedAt: revision },
    localTrip: { destination: 'Queued Kyoto', updatedAt: revision },
  });
});

it.each([503, 409])(
  'keeps seeded edits visible through GET and failed sync (%s)',
  async (status) => {
    await seedHydratedEdit();
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.method === 'PATCH')
        return {
          ok: false,
          status,
          json: async () => ({ error: 'Fixture sync failure' }),
        };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          trip: apiTrip(),
          trips: [apiTrip()],
          itinerary: { days: [] },
        }),
      };
    });
    const api = tripsApi();
    await api.getTripById(saved.id);
    const result = await syncService.sync(true);
    expect(result).toMatchObject({ success: false, failed: 1, synced: 0 });
    await api.fetchTrips();
    expect(visibleTrip()?.destination).toBe('Queued Kyoto');
    expect((await offlineStorage.loadTrips())[0].destination).toBe('Queued Kyoto');
    const pending = (await offlineStorage.getPendingMutations())[0];
    expect(pending.data?.expectedUpdatedAt).toBe(revision);
    expect(pending.localTrip?.updatedAt).toBe(revision);
    const patch = mockFetch.mock.calls.find(([, init]) => init.method === 'PATCH')!;
    expect(JSON.parse(patch[1].body)).toMatchObject({ expectedUpdatedAt: revision });
  }
);

it('uses the authoritative microsecond-newer list after successful seeded edit sync', async () => {
  await seedHydratedEdit();
  useTripStore.getState().setCurrentTrip(useTripStore.getState().trips[0]);
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      trip: apiTrip('Canonical Kyoto', newerRevision),
      trips: [apiTrip('Canonical Kyoto', newerRevision)],
      itinerary: { days: [] },
    }),
  });
  expect(await syncService.sync(true)).toMatchObject({ success: true, synced: 1, failed: 0 });
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
  const api = tripsApi();
  await api.fetchTrips();
  expect(visibleTrip()?.destination).toBe('Canonical Kyoto');
  expect((await api.getTripById(saved.id)).destination).toBe('Canonical Kyoto');
  expect((await offlineStorage.loadSavedTrips())[0].updatedAt).toBe(newerRevision);
});

it('does not republish an acknowledged seeded edit while queue removal is unfinished', async () => {
  const oldDays = [{ date: saved.startDate, dayNumber: 1, theme: 'Old plan', activities: [] }];
  await offlineStorage.saveTrip({ ...saved, days: oldDays });
  await syncService.queueUpdate(saved.id, { destination: 'Queued Kyoto' });
  await useTripStore.getState().hydrateFromOffline();
  const patchStarted = gate();
  const acknowledge = gate();
  const releaseSnapshot = gate();
  const removalStarted = gate();
  const finishRemoval = gate();
  const events: string[] = [];
  let acknowledged = false;
  let detailFetched = false;
  const canonical = {
    ...apiTrip('Canonical Kyoto', newerRevision),
    status: 'draft',
    preferences: { planNeedsRefresh: true },
  };
  mockFetch.mockImplementation(async (url: string, init: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => {
      if (init.method === 'PATCH') {
        patchStarted.open();
        await acknowledge.promise;
        acknowledged = true;
        events.push('PATCH acknowledgement');
      } else if (url.endsWith(`/trips/${saved.id}`)) {
        detailFetched = true;
        events.push('canonical detail GET');
      }
      return { trip: canonical, trips: [canonical], itinerary: { days: [] } };
    },
  }));
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
    const snapshot = storage.get(key) ?? null;
    if (key === '@faroway/pending_mutations' && detailFetched && !acknowledged) {
      events.push('pending snapshot captured');
      await releaseSnapshot.promise;
    }
    return snapshot;
  });
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    if (key === '@faroway/pending_mutations' && value === '[]') {
      events.push('queue removal started');
      removalStarted.open();
      await finishRemoval.promise;
      events.push('queue removal finished');
    }
    storage.set(key, value);
  });
  const unsubscribe = useTripStore.subscribe((state, previous) => {
    if (state.currentTrip !== previous.currentTrip) events.push('detail published');
  });
  const syncing = syncService.sync(true);
  await patchStarted.promise;
  const reading = tripsApi().getTripById(saved.id);
  await nextTurn();
  acknowledge.open();
  await nextTurn();
  releaseSnapshot.open();
  await removalStarted.promise;
  await nextTurn();
  finishRemoval.open();
  const [result, syncResult] = await Promise.all([reading, syncing]);
  unsubscribe();
  expect(syncResult).toMatchObject({ success: true, synced: 1, failed: 0 });
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
  expect((await offlineStorage.loadSavedTrips())[0]).toMatchObject({
    updatedAt: newerRevision,
    status: 'draft',
    planNeedsRefresh: true,
    days: [],
  });
  console.info('Seeded acknowledgement interleaving:', events);
  expect(result).toMatchObject({
    updatedAt: newerRevision,
    status: 'draft',
    planNeedsRefresh: true,
    days: [],
  });
  expect(visibleTrip()).toMatchObject(result);
  const patch = mockFetch.mock.calls.find(([, init]) => init.method === 'PATCH')!;
  expect(JSON.parse(patch[1].body).expectedUpdatedAt).toBe(revision);
});

it.each(['GET response', 'pending snapshot'])(
  'restarts a detail read when seeded sync crosses its %s',
  async (stage) => {
    await seedHydratedEdit();
    const entered = gate();
    const release = gate();
    let detailReads = 0;
    let snapshotBlocked = false;
    const canonical = apiTrip('Canonical Kyoto', newerRevision);
    mockFetch.mockImplementation(async (url: string, init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (init.method === 'GET' && url.endsWith(`/trips/${saved.id}`)) {
          detailReads++;
          if (detailReads === 1) {
            if (stage === 'GET response') {
              entered.open();
              await release.promise;
            }
            return { trip: apiTrip('Before sync'), itinerary: { days: [] } };
          }
        }
        return { trip: canonical, trips: [canonical], itinerary: { days: [] } };
      },
    }));
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
      const snapshot = storage.get(key) ?? null;
      if (
        stage === 'pending snapshot' &&
        key === '@faroway/pending_mutations' &&
        !snapshotBlocked
      ) {
        snapshotBlocked = true;
        entered.open();
        await release.promise;
      }
      return snapshot;
    });
    const reading = tripsApi().getTripById(saved.id);
    await entered.promise;
    const syncing = syncService.sync(true);
    // The response case covers a complete sync between two GET continuations.
    // The storage case preserves the real serialized queue ordering.
    if (stage === 'GET response') await syncing;
    release.open();
    const [result, syncResult] = await Promise.all([reading, syncing]);
    expect(syncResult).toMatchObject({ success: true, synced: 1 });
    expect(detailReads).toBe(2);
    expect(result).toMatchObject({ destination: 'Canonical Kyoto', updatedAt: newerRevision });
    expect(visibleTrip()).toMatchObject(result);
    expect(await offlineStorage.getPendingMutations()).toEqual([]);
  }
);

it.each([503, 409, 'unverified receipt', 'failed removal'])(
  'retains seeded intent and its revision when a concurrent sync has %s',
  async (failure) => {
    await seedHydratedEdit();
    const started = gate();
    const release = gate();
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        started.open();
        await release.promise;
        return {
          ok: typeof failure !== 'number',
          status: typeof failure === 'number' ? failure : 200,
          json: async () => ({
            error: 'Fixture failed sync',
            trip: apiTrip(
              'Canonical Kyoto',
              failure === 'unverified receipt' ? revision : newerRevision
            ),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ trip: apiTrip(), trips: [apiTrip()], itinerary: { days: [] } }),
      };
    });
    if (failure === 'failed removal') {
      jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
        if (key === '@faroway/pending_mutations' && value === '[]')
          throw new Error('Fixture queue removal failed');
        storage.set(key, value);
      });
    }
    const syncing = syncService.sync(true);
    await started.promise;
    const reading = tripsApi().getTripById(saved.id);
    await nextTurn();
    release.open();
    const [result, syncResult] = await Promise.all([reading, syncing]);
    expect(syncResult).toMatchObject({ success: false, synced: 0, failed: 1 });
    expect(result.destination).toBe('Queued Kyoto');
    expect(visibleTrip()).toMatchObject(result);
    expect((await offlineStorage.getPendingMutations())[0]).toMatchObject({
      data: { destination: 'Queued Kyoto', expectedUpdatedAt: revision },
      localTrip: { destination: 'Queued Kyoto', updatedAt: revision },
    });
  }
);

it.each(['abort', 'owner change', 'same-owner reauthentication', 'newer request'])(
  'rejects a waiting detail read after %s during seeded sync',
  async (scenario) => {
    await seedHydratedEdit();
    const previous = useTripStore.getState().trips[0];
    useTripStore.getState().setCurrentTrip(previous);
    const started = gate();
    const release = gate();
    const canonical = apiTrip('Canonical Kyoto', newerRevision);
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        started.open();
        await release.promise;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ trip: canonical, trips: [canonical], itinerary: { days: [] } }),
      };
    });
    const syncing = syncService.sync(true);
    await started.promise;
    const api = tripsApi();
    const controller = new AbortController();
    const reading = api.getTripById(saved.id, controller.signal).catch((error) => error);
    await nextTurn();
    let newerRead: Promise<Trip> | undefined;
    if (scenario === 'abort') {
      controller.abort();
      // Cancellation settles without waiting for the outstanding PATCH to finish.
      expect(await reading).toMatchObject({ name: 'AbortError' });
    } else if (scenario === 'newer request') newerRead = api.getTripById(saved.id);
    else {
      if (scenario === 'same-owner reauthentication') useUserStore.getState().setUser(null);
      signIn(scenario === 'owner change' ? 'owner-b' : 'owner-a');
      useTripStore.setState({ currentTrip: null, trips: [] });
    }
    release.open();
    const [error] = await Promise.all([reading, syncing, newerRead]);
    expect(error).toBeInstanceOf(Error);
    if (scenario === 'abort') {
      expect(error.name).toBe('AbortError');
      expect(useTripStore.getState().currentTrip).toBe(previous);
    } else if (scenario === 'newer request') {
      expect(visibleTrip()).toMatchObject({
        destination: 'Canonical Kyoto',
        updatedAt: newerRevision,
      });
    } else {
      expect(useTripStore.getState().currentTrip).toBeNull();
      expect(JSON.parse(storage.get('@faroway/pending_mutations')!)[0]).toMatchObject({
        ownerId: 'owner-a',
        data: { destination: 'Queued Kyoto', expectedUpdatedAt: revision },
      });
    }
  }
);

it.each([true, false])(
  'coordinates detail reads with explicit conflict resolution (verified=%s)',
  async (verified) => {
    await seedHydratedEdit();
    const [queued] = await offlineStorage.getPendingMutations();
    await offlineStorage.blockPendingMutation(queued.id, 'Fixture needs review');
    const [blocked] = await offlineStorage.getPendingMutations();
    const started = gate();
    const release = gate();
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        started.open();
        await release.promise;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          trip: apiTrip('Canonical Kyoto', verified ? newerRevision : revision),
          itinerary: { days: [] },
        }),
      };
    });
    const resolving = syncService.resolveBlockedMutation(blocked, revision).catch((error) => error);
    await started.promise;
    const reading = tripsApi().getTripById(saved.id);
    await nextTurn();
    release.open();
    const [result, resolution] = await Promise.all([reading, resolving]);
    expect(result.destination).toBe(verified ? 'Canonical Kyoto' : 'Queued Kyoto');
    expect(visibleTrip()).toMatchObject(result);
    if (verified) expect(await offlineStorage.getPendingMutations()).toEqual([]);
    else {
      expect(resolution).toBeInstanceOf(Error);
      expect(await offlineStorage.getPendingMutations()).toEqual([blocked]);
    }
  }
);

it("never overlays another owner's seeded edit for the same trip id", async () => {
  await seedHydratedEdit();
  signIn('owner-b');
  useTripStore.setState({ trips: [], currentTrip: null, isHydrated: false });
  await offlineStorage.saveTrip({ ...saved, destination: 'Owner B trip' });
  await useTripStore.getState().hydrateFromOffline();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      trip: apiTrip('Owner B server'),
      itinerary: { days: [] },
    }),
  });
  expect((await tripsApi().getTripById(saved.id)).destination).toBe('Owner B server');
  expect(visibleTrip()?.destination).toBe('Owner B server');
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
  signIn('owner-a');
  expect((await offlineStorage.getPendingMutations())[0].localTrip?.destination).toBe(
    'Queued Kyoto'
  );
});

it.each(['abort', 'owner change', 'same-owner reauthentication'])(
  'does not publish after %s during the pending-intent read',
  async (scenario) => {
    await seedHydratedEdit();
    const previous = useTripStore.getState().trips[0];
    useTripStore.getState().setCurrentTrip(previous);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
      if (key === '@faroway/pending_mutations') {
        enter();
        await blocked;
      }
      return storage.get(key) ?? null;
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        trip: apiTrip('Server snapshot'),
        itinerary: { days: [] },
      }),
    });
    const controller = new AbortController();
    const read = tripsApi()
      .getTripById(saved.id, controller.signal)
      .catch((error) => error);
    await entered;
    if (scenario === 'abort') controller.abort();
    else {
      if (scenario === 'same-owner reauthentication') useUserStore.getState().setUser(null);
      signIn(scenario === 'owner change' ? 'owner-b' : 'owner-a');
      useTripStore.setState({ currentTrip: null, trips: [] });
    }
    release();
    const error = await read;
    expect(error).toBeInstanceOf(Error);
    if (scenario === 'abort') expect(error.name).toBe('AbortError');
    expect(useTripStore.getState().currentTrip).toBe(scenario === 'abort' ? previous : null);
    // No queued payload was acknowledged or rewritten by this cancelled read.
    const queue = JSON.parse(storage.get('@faroway/pending_mutations')!);
    expect(queue[0]).toMatchObject({
      ownerId: 'owner-a',
      data: { expectedUpdatedAt: revision, destination: 'Queued Kyoto' },
    });
  }
);

it('keeps seeded detail visible if the pending-intent read fails', async () => {
  await seedHydratedEdit();
  const previous = useTripStore.getState().trips[0];
  useTripStore.getState().setCurrentTrip(previous);
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
    if (key === '@faroway/pending_mutations') throw new Error('Fixture unreadable queue');
    return storage.get(key) ?? null;
  });
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      trip: apiTrip('Canonical server'),
      itinerary: { days: [] },
    }),
  });
  await expect(tripsApi().getTripById(saved.id)).rejects.toThrow('Fixture unreadable queue');
  expect(useTripStore.getState().currentTrip).toBe(previous);
});

it('does not revive a trip with a seeded pending deletion during detail GET', async () => {
  await seedHydratedEdit();
  await syncService.queueDelete(saved.id);
  useTripStore.getState().applyQueuedDeletion(saved.id);
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      trip: apiTrip(),
      itinerary: { days: [] },
    }),
  });
  await expect(tripsApi().getTripById(saved.id)).rejects.toThrow('pending deletion');
  expect(visibleTrip()).toBeUndefined();
  expect(await offlineStorage.loadTrips()).toEqual([]);
  expect((await offlineStorage.getPendingMutations())[0].type).toBe('delete');
});
