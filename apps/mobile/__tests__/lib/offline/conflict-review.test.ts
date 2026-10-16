let mockOwner = 'owner';
let mockSessionWait: Promise<unknown> | undefined;
let mockNetworkWait: Promise<void> | undefined;
jest.mock('../../../lib/supabase', () => ({
  API_BASE_URL: 'https://fixture.invalid',
  getAuthHeaders: jest.fn(async () => ({ Authorization: 'fixture' })),
  supabase: {
    auth: {
      getSession: async () =>
        mockSessionWait
          ? await mockSessionWait
          : {
              data: { session: { user: { id: mockOwner }, access_token: 'fixture' } },
              error: null,
            },
    },
  },
}));
jest.mock('../../../constants/api', () => ({ API_BASE_URL: 'https://staging.faroway.ai' }));
jest.mock('../../../lib/offline/network', () => ({
  networkMonitor: {
    isOnline: () => true,
    initialize: jest.fn(async () => {
      if (mockNetworkWait) await mockNetworkWait;
    }),
    subscribe: jest.fn(() => jest.fn()),
  },
}));
import { offlineStorage } from '../../../lib/offline/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '../../../stores/userStore';
function signIn(id: string) {
  mockOwner = id;
  useUserStore
    .getState()
    .setUser({ id, name: 'Fixture', email: 'fixture@example.invalid', preferences: { vibes: [] } });
}
import type { Trip } from '../../../stores/tripStore';
import { syncService } from '../../../lib/offline/sync';
import {
  conflictRows,
  supportsConflictReapply,
  tripWebUrl,
} from '../../../lib/offline/conflict-review';

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;
beforeEach(async () => {
  mockSessionWait = undefined;
  mockNetworkWait = undefined;
  signIn('owner');
  await syncService.clearAll();
  fetchMock.mockReset();
});
async function blocked() {
  const mutation = await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'trip-1',
    data: { destination: 'Rome', expectedUpdatedAt: 'old' },
  });
  await offlineStorage.blockPendingMutation(mutation.id, 'Another device changed this trip.');
  return (await offlineStorage.getPendingMutations())[0];
}

it('compares only pending edits and omits internal revision values', async () => {
  const mutation = await blocked();
  expect(conflictRows(mutation, { destination: 'Paris' })).toEqual([
    { label: 'Destination', yours: 'Rome', latest: 'Paris' },
  ]);
  expect(supportsConflictReapply(mutation)).toBe(true);
  expect(supportsConflictReapply({ ...mutation, data: { status: 'draft' } })).toBe(false);
  expect(tripWebUrl('11111111-1111-4111-8111-111111111111')).toBe(
    'https://staging.faroway.ai/trips/11111111-1111-4111-8111-111111111111'
  );
  expect(tripWebUrl('trip-1')).toBeNull();
});
it('saves only after explicit review with the observed server revision', async () => {
  const mutation = await blocked();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ trip: { id: 'trip-1', user_id: 'owner', updated_at: 'new-version' } }),
  });
  await syncService.resolveBlockedMutation(mutation, 'reviewed-version');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    destination: 'Rome',
    expectedUpdatedAt: 'reviewed-version',
  });
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
});
it('preserves edits when the reviewed server version changes again', async () => {
  const mutation = await blocked();
  fetchMock.mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ error: 'Trip changed again' }),
  });
  await expect(syncService.resolveBlockedMutation(mutation, 'reviewed-version')).rejects.toThrow(
    'Trip changed again'
  );
  expect(await offlineStorage.getPendingMutations()).toEqual([mutation]);
});
it('keeps pending edits when a save reply is interrupted', async () => {
  const mutation = await blocked();
  fetchMock.mockRejectedValue(new Error('Network interrupted'));
  await expect(syncService.resolveBlockedMutation(mutation, 'reviewed-version')).rejects.toThrow();
  expect(await offlineStorage.getPendingMutations()).toEqual([mutation]);
});
it('rejects an outdated local review without a network write', async () => {
  const mutation = await blocked();
  await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: mutation.tripId,
    data: { destination: 'Lisbon' },
  });
  await expect(syncService.resolveBlockedMutation(mutation, 'reviewed-version')).rejects.toThrow(
    'local changes changed'
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await offlineStorage.getPendingMutations())[0].data?.destination).toBe('Lisbon');
});
it('discards only the selected edits and leaves the server untouched', async () => {
  const mutation = await blocked();
  await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'trip-2',
    data: { destination: 'Kyoto' },
  });
  await syncService.resolveBlockedMutation(mutation);
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await offlineStorage.getPendingMutations()).map((m) => m.tripId)).toEqual(['trip-2']);
});

it('keeps the offline creation identity after a lost response and reuses it on sync', async () => {
  const trip: Trip = {
    id: 'local_pending',
    destination: 'Paris',
    country: 'France',
    startDate: '2099-06-01',
    endDate: '2099-06-03',
    travelers: 2,
    travelerType: 'couple',
    vibes: [],
    days: [],
    coverImage: '',
    createdAt: '2026-10-10T00:00:00Z',
    status: 'draft',
  };
  await syncService.queueCreate(trip);
  const queued = (await offlineStorage.getPendingMutations())[0];
  expect(queued.data?.requestId).toEqual(expect.any(String));
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await syncService.sync(true);
  expect((await offlineStorage.getPendingMutations())[0].data).toEqual(queued.data);
  fetchMock.mockImplementation(async (_url: string, options: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () =>
      options.method === 'POST'
        ? {
            trip: { id: queued.data?.requestId, ...queued.data, user_id: 'owner', status: 'draft' },
          }
        : { trips: [] },
  }));
  await syncService.sync(true);
  const posts = fetchMock.mock.calls.filter(([, options]) => options.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(JSON.parse(posts[0][1].body)).toEqual(JSON.parse(posts[1][1].body));
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
});

it('retains an old unkeyed create for review without automatically duplicating it', async () => {
  await offlineStorage.addPendingMutation({
    type: 'create',
    ownerId: 'owner',
    tripId: 'local_old',
    data: { destination: 'Paris' },
  });
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ trips: [] }) });
  await syncService.sync(true);
  expect((await offlineStorage.getPendingMutations())[0].blockedReason).toContain(
    'no safe retry identity'
  );
  expect(fetchMock.mock.calls.some(([, options]) => options.method === 'POST')).toBe(false);
});

it('does not send or display a queued creation under a different account', async () => {
  signIn('previous-account');
  await offlineStorage.addPendingMutation({
    type: 'create',
    ownerId: 'previous-account',
    tripId: 'local_old',
    data: { requestId: '11111111-1111-4111-8111-111111111111', destination: 'Paris' },
  });
  signIn('owner');
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ trips: [] }) });
  await syncService.sync(true);
  expect(fetchMock.mock.calls.some(([, options]) => options.method === 'POST')).toBe(false);
  expect(await offlineStorage.getPendingMutations()).toHaveLength(0);
  signIn('previous-account');
  expect(await offlineStorage.getPendingMutations()).toHaveLength(1);
});

it('does not publish a late trip list after the account changes', async () => {
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      mockOwner = 'new-account';
      return { trips: [{ id: 'private-old-trip' }] };
    },
  }));
  await syncService.sync(true);
  expect(await offlineStorage.loadTrips()).toEqual([]);
});

it('rejects a foreign server trip list without replacing the current cache', async () => {
  const original: Trip = {
    id: 'owned',
    destination: 'Rome',
    country: 'Italy',
    startDate: '2099-06-01',
    endDate: '2099-06-03',
    travelers: 2,
    travelerType: 'couple',
    vibes: [],
    days: [],
    coverImage: '',
    createdAt: '2026-10-13',
    status: 'draft',
  };
  await offlineStorage.saveTrips([original]);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ trips: [{ id: 'foreign', user_id: 'other-owner' }] }),
  });
  const result = await syncService.sync(true);
  expect(result.success).toBe(false);
  expect(await offlineStorage.loadTrips()).toEqual([original]);
});

it.each(['create', 'update', 'delete'] as const)(
  'does not apply a queued %s after the original SDK session resolves under a different account',
  async (operation) => {
    const original: Trip = {
      id: 'local_owner_a',
      destination: 'Paris',
      country: 'France',
      startDate: '2099-06-01',
      endDate: '2099-06-03',
      travelers: 2,
      travelerType: 'couple',
      vibes: [],
      days: [],
      coverImage: '',
      createdAt: '2026-10-10',
      status: 'draft',
    };
    await offlineStorage.saveTrips([original]);
    let release!: (value: unknown) => void;
    mockSessionWait = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const work = (
      operation === 'create'
        ? syncService.queueCreate(original)
        : operation === 'update'
          ? syncService.queueUpdate(original.id, { destination: 'Rome' })
          : syncService.queueDelete(original.id)
    ).catch((error) => error);
    signIn('new-owner');
    const next = { ...original, id: 'private-new-owner', destination: 'Tokyo' };
    await offlineStorage.saveTrips([next]);
    release({
      data: { session: { user: { id: 'owner' }, access_token: 'old-token' } },
      error: null,
    });
    expect((await work).name).toBe('TripAccountChangedError');
    mockSessionWait = undefined;
    expect(await offlineStorage.loadTrips()).toEqual([next]);
    expect(await offlineStorage.getPendingMutations()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  }
);

it.each(['create', 'update', 'delete'] as const)(
  'keeps cache and retry queue unchanged when the atomic %s queue write fails',
  async (operation) => {
    const original: Trip = {
      id: 'local_original',
      destination: 'Tokyo',
      country: 'Japan',
      startDate: '2099-06-01',
      endDate: '2099-06-03',
      travelers: 2,
      travelerType: 'couple',
      vibes: [],
      days: [],
      coverImage: '',
      createdAt: '2026-10-10',
      status: 'draft',
    };
    await offlineStorage.saveTrips([original]);
    const write = AsyncStorage.setItem as jest.Mock;
    const implementation = write.getMockImplementation()!;
    write.mockImplementation((key: string, value: string) =>
      key === '@faroway/pending_mutations'
        ? Promise.reject(new Error('Device storage unavailable'))
        : implementation(key, value)
    );
    try {
      const work =
        operation === 'create'
          ? syncService.queueCreate({ ...original, id: 'local_new', destination: 'Paris' })
          : operation === 'update'
            ? syncService.queueUpdate(original.id, { destination: 'Paris' })
            : syncService.queueDelete(original.id);
      await expect(work).rejects.toThrow('Device storage unavailable');
      expect(await offlineStorage.loadTrips()).toEqual([original]);
      expect(await offlineStorage.getPendingMutations()).toEqual([]);
    } finally {
      write.mockImplementation(implementation);
    }
  }
);

it.each(['create', 'update', 'delete'] as const)(
  'restores the saved snapshot when a durable queued %s is deliberately discarded',
  async (operation) => {
    const original: Trip = {
      id: 'local_original',
      destination: 'Tokyo',
      country: 'Japan',
      startDate: '2099-06-01',
      endDate: '2099-06-03',
      travelers: 2,
      travelerType: 'couple',
      vibes: [],
      days: [],
      coverImage: '',
      createdAt: '2026-10-10',
      status: 'draft',
    };
    await offlineStorage.saveTrips([original]);
    if (operation === 'create')
      await syncService.queueCreate({ ...original, id: 'local_new', destination: 'Paris' });
    else if (operation === 'update')
      await syncService.queueUpdate(original.id, { destination: 'Paris' });
    else await syncService.queueDelete(original.id);
    expect(await offlineStorage.loadSavedTrips()).toEqual([original]);
    const visible = await offlineStorage.loadTrips();
    expect(visible.map((trip) => trip.destination)).toEqual(
      operation === 'create' ? ['Paris', 'Tokyo'] : operation === 'update' ? ['Paris'] : []
    );
    const mutation = (await offlineStorage.getPendingMutations())[0];
    await offlineStorage.removePendingMutation(mutation.id);
    expect(await offlineStorage.loadTrips()).toEqual([original]);
  }
);

it('retains a committed offline create when optional sync metadata cannot be written', async () => {
  const trip: Trip = {
    id: 'local_committed',
    destination: 'Paris',
    country: 'France',
    startDate: '2099-06-01',
    endDate: '2099-06-03',
    travelers: 2,
    travelerType: 'couple',
    vibes: [],
    days: [],
    coverImage: '',
    createdAt: '2026-10-10',
    status: 'draft',
  };
  const write = AsyncStorage.setItem as jest.Mock;
  const implementation = write.getMockImplementation()!;
  write.mockImplementation((key: string, value: string) =>
    key === '@faroway/sync_meta'
      ? Promise.reject(new Error('Metadata unavailable'))
      : implementation(key, value)
  );
  try {
    await syncService.queueCreate(trip);
    expect(await offlineStorage.loadTrips()).toEqual([trip]);
    expect((await offlineStorage.getPendingMutations())[0]).toMatchObject({
      tripId: trip.id,
      localTrip: trip,
    });
    expect((await offlineStorage.getSyncMeta()).pendingCount).toBe(1);
  } finally {
    write.mockImplementation(implementation);
  }
});

it('keeps the original creation identity and brief while SDK verification is pending', async () => {
  const original: Trip = {
    id: 'local_submitted',
    destination: 'Paris',
    country: 'France',
    startDate: '2099-06-01',
    endDate: '2099-06-03',
    travelers: 2,
    travelerType: 'couple',
    vibes: ['art'],
    days: [],
    coverImage: '',
    createdAt: '2026-10-10',
    status: 'draft',
  };
  let release!: (value: unknown) => void;
  mockSessionWait = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  const queued = syncService.queueCreate(original);
  original.id = 'changed-id';
  original.destination = 'Changed after submission';
  original.vibes.push('nightlife');
  release({ data: { session: { user: { id: 'owner' }, access_token: 'token' } }, error: null });
  await queued;
  mockSessionWait = undefined;
  const mutation = (await offlineStorage.getPendingMutations())[0];
  expect(mutation.tripId).toBe('local_submitted');
  expect(mutation.localTrip).toMatchObject({
    id: 'local_submitted',
    destination: 'Paris',
    vibes: ['art'],
  });
  expect(mutation.data?.destination).toBe('Paris');
  expect((await offlineStorage.loadTrips())[0].id).toBe('local_submitted');
});

it.each(['create', 'update', 'delete'] as const)(
  'settles a stalled SDK session without queueing a late %s',
  async (operation) => {
    jest.useFakeTimers();
    try {
      const original: Trip = {
        id: 'local_original',
        destination: 'Tokyo',
        country: 'Japan',
        startDate: '2099-06-01',
        endDate: '2099-06-03',
        travelers: 2,
        travelerType: 'couple',
        vibes: [],
        days: [],
        coverImage: '',
        createdAt: '2026-10-10',
        status: 'draft',
      };
      await offlineStorage.saveTrips([original]);
      let release!: (value: unknown) => void;
      mockSessionWait = new Promise<unknown>((resolve) => {
        release = resolve;
      });
      const work = (
        operation === 'create'
          ? syncService.queueCreate({ ...original, id: 'local_new' })
          : operation === 'update'
            ? syncService.queueUpdate(original.id, { destination: 'Paris' })
            : syncService.queueDelete(original.id)
      ).catch((error) => error);
      await jest.advanceTimersByTimeAsync(20_001);
      expect((await work).name).toBe('TripAccessError');
      release({
        data: { session: { user: { id: 'owner' }, access_token: 'late-token' } },
        error: null,
      });
      await Promise.resolve();
      mockSessionWait = undefined;
      expect(await offlineStorage.loadTrips()).toEqual([original]);
      expect(await offlineStorage.getPendingMutations()).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  }
);

it('shares one initialization across simultaneous consumers and cleans both subscriptions', async () => {
  const { networkMonitor } = require('../../../lib/offline/network');
  networkMonitor.initialize.mockClear();
  networkMonitor.subscribe.mockClear();
  let release!: () => void;
  mockNetworkWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = syncService.initialize();
  const second = syncService.initialize();
  expect(first).toBe(second);
  expect(networkMonitor.initialize).toHaveBeenCalledTimes(1);
  release();
  await Promise.all([first, second]);
  expect(networkMonitor.subscribe).toHaveBeenCalledTimes(1);
  syncService.cleanup();
  expect(networkMonitor.subscribe.mock.results[0].value).toHaveBeenCalledTimes(1);
});

it.each(['different-owner', 'same-owner-new-session'] as const)(
  'does not publish a delayed old sync error after a %s change',
  async (change) => {
    await syncService.initialize();
    let release!: (response: unknown) => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    fetchMock.mockImplementationOnce(() => {
      started();
      return new Promise<unknown>((resolve) => {
        release = resolve;
      });
    });
    const work = syncService.sync(true);
    await entered;
    expect(syncService.getState().status).toBe('syncing');
    useUserStore.getState().logout();
    signIn(change === 'different-owner' ? 'new-owner' : 'owner');
    expect(syncService.getState()).toMatchObject({
      status: 'idle',
      pendingCount: 0,
      lastSyncTime: null,
      error: null,
    });
    release({ ok: false, status: 500, json: async () => ({ error: 'Old account-only failure' }) });
    await work;
    expect(syncService.getState()).toMatchObject({
      status: 'idle',
      pendingCount: 0,
      lastSyncTime: null,
      error: null,
    });
    syncService.cleanup();
  }
);

it('keeps guest startup quiet without checking an SDK session or calling the trip API', async () => {
  const { supabase } = require('../../../lib/supabase');
  const session = jest.spyOn(supabase.auth, 'getSession');
  try {
    useUserStore.getState().logout();
    const result = await syncService.sync(true);
    expect(result).toMatchObject({ success: false, errors: [] });
    expect(session).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(syncService.getState().error).toBeNull();
  } finally {
    session.mockRestore();
  }
});

it('an unreadable owned queue stops sync before any server request and keeps the edits', async () => {
  const raw = JSON.stringify([{ ownerId: 'owner', id: 'damaged-command' }]);
  await AsyncStorage.setItem('@faroway/pending_mutations', raw);
  const result = await syncService.sync(true);
  expect(result.success).toBe(false);
  expect(result.errors).toEqual([
    expect.objectContaining({ error: expect.stringContaining('saved changes on this device') }),
  ]);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@faroway/pending_mutations')).toBe(raw);
  expect(syncService.getState()).toMatchObject({
    status: 'error',
    error: expect.stringContaining('saved changes on this device'),
  });
});

describe.each(['automatic', 'reviewed'] as const)('%s queued save confirmation', (mode) => {
  it.each(['missing trip', 'wrong trip', 'wrong owner', 'unchanged revision'])(
    'retains the durable edits for a %s receipt',
    async (outcome) => {
      const mutation =
        mode === 'reviewed'
          ? await blocked()
          : await offlineStorage.addPendingMutation({
              type: 'update',
              tripId: 'trip-1',
              ownerId: 'owner',
              data: { destination: 'Rome', expectedUpdatedAt: 'old' },
            });
      const revision = mode === 'reviewed' ? 'reviewed-version' : 'old';
      fetchMock.mockImplementation(async (_url: string, options: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () =>
          options.method === 'PATCH'
            ? {
                trip:
                  outcome === 'missing trip'
                    ? undefined
                    : {
                        id: outcome === 'wrong trip' ? 'trip-other' : 'trip-1',
                        user_id: outcome === 'wrong owner' ? 'other-owner' : 'owner',
                        updated_at: outcome === 'unchanged revision' ? revision : 'new-version',
                      },
              }
            : { trips: [] },
      }));
      if (mode === 'reviewed') {
        await expect(syncService.resolveBlockedMutation(mutation, revision)).rejects.toThrow();
      } else {
        const result = await syncService.sync(true);
        expect(result.success).toBe(false);
        expect(result.synced).toBe(0);
      }
      expect((await offlineStorage.getPendingMutations()).map((entry) => entry.id)).toEqual([
        mutation.id,
      ]);
    }
  );
});

it.each(['wrong identity', 'wrong owner'])(
  'retains the queued creation UUID for a %s receipt',
  async (outcome) => {
    const requestId = '11111111-1111-4111-8111-111111111111';
    const mutation = await offlineStorage.addPendingMutation({
      type: 'create',
      ownerId: 'owner',
      tripId: 'local_pending',
      data: {
        requestId,
        destination: 'Paris',
        start_date: '2099-06-01',
        end_date: '2099-06-03',
        travelers: 2,
      },
    });
    fetchMock.mockImplementation(async (_url: string, options: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () =>
        options.method === 'POST'
          ? {
              trip: {
                ...mutation.data,
                id:
                  outcome === 'wrong identity' ? '22222222-2222-4222-8222-222222222222' : requestId,
                user_id: outcome === 'wrong owner' ? 'other-owner' : 'owner',
                status: 'draft',
              },
            }
          : { trips: [] },
    }));
    expect((await syncService.sync(true)).success).toBe(false);
    expect((await offlineStorage.getPendingMutations())[0].data?.requestId).toBe(requestId);
  }
);

it.each(['cached read', 'session recheck'])(
  'does not replace the new-session cache after reauthentication during %s',
  async (stage) => {
    const latest: Trip = {
      id: 'new-session-trip',
      destination: 'Kyoto',
      country: 'Japan',
      startDate: '2099-06-01',
      endDate: '2099-06-03',
      travelers: 2,
      travelerType: 'couple',
      vibes: [],
      days: [],
      coverImage: '',
      createdAt: '2026-10-14',
      status: 'planned',
    };
    let recheck = false;
    const replaceSession = async () => {
      useUserStore.getState().logout();
      signIn('owner');
      await AsyncStorage.setItem(
        '@faroway/trips',
        JSON.stringify({ version: 1, ownerId: 'owner', trips: [latest] })
      );
    };
    const prototype = Object.getPrototypeOf(offlineStorage);
    const read = prototype.loadSavedTrips;
    const readSpy = jest.spyOn(prototype, 'loadSavedTrips').mockImplementationOnce(async function (
      this: typeof offlineStorage
    ) {
      const previous = await read.call(this);
      if (stage === 'cached read') await replaceSession();
      else recheck = true;
      return previous;
    });
    const { supabase } = require('../../../lib/supabase');
    const sessionRead = supabase.auth.getSession;
    const sessionSpy = jest.spyOn(supabase.auth, 'getSession').mockImplementation(async () => {
      if (recheck) {
        recheck = false;
        await replaceSession();
      }
      return sessionRead();
    });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ trips: [] }) });
    try {
      expect((await syncService.sync(true)).success).toBe(false);
      expect(await offlineStorage.loadSavedTrips()).toEqual([latest]);
    } finally {
      readSpy.mockRestore();
      sessionSpy.mockRestore();
    }
  }
);
