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
