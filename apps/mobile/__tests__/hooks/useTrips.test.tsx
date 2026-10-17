jest.mock('../../constants/api', () => ({ API_BASE_URL: 'http://localhost:3000' }));
jest.mock('../../lib/planningConsent', () => ({
  withPlanningConsent: jest.fn(async (dispatch) =>
    dispatch({
      headers: async () => ({
        'Content-Type': 'application/json',
        Authorization: 'Bearer current-session',
      }),
      signal: new AbortController().signal,
    })
  ),
}));
jest.mock('../../lib/supabase', () => ({
  API_BASE_URL: 'http://localhost:3000',
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      })),
    },
  },
  getAuthHeaders: jest.fn(() => Promise.resolve({ Authorization: 'Bearer token' })),
}));

jest.mock('../../lib/offline', () => ({
  offlineStorage: {
    loadTrips: jest.fn(() => Promise.resolve([])),
    getPendingMutations: jest.fn(() => Promise.resolve([])),
    saveTrip: jest.fn(() => Promise.resolve()),
    saveTrips: jest.fn(() => Promise.resolve()),
    deleteTrip: jest.fn(() => Promise.resolve()),
    clearAll: jest.fn(() => Promise.resolve()),
  },
  networkMonitor: {
    isOnline: jest.fn(() => true),
  },
  syncService: {
    captureMutationRead: () => ({ settled: Promise.resolve(), isCurrent: () => true }),
    queueCreate: jest.fn(() => Promise.resolve()),
    queueUpdate: jest.fn(() => Promise.resolve()),
    queueDelete: jest.fn(() => Promise.resolve()),
  },
}));

import React from 'react';
import { useUserStore } from '../../stores/userStore';
import { useTrips, transformItineraryDays } from '../../hooks/useTrips';
import { useTripStore, type Trip } from '../../stores/tripStore';

const { renderToString } = require('react-dom/server') as {
  renderToString: (element: React.ReactElement) => string;
};
const { offlineStorage, networkMonitor, syncService } = require('../../lib/offline');

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function makeTrip(id: string, destination: string): Trip {
  return {
    id,
    destination,
    country: 'Japan',
    startDate: '2026-04-01',
    endDate: '2026-04-07',
    travelers: 2,
    travelerType: 'couple',
    vibes: ['food'],
    days: [],
    coverImage: '/cover.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'planned',
  };
}

function makeApiTrip(id: string, destination: string) {
  return {
    id,
    user_id: 'user-1',
    destination,
    country: 'Japan',
    start_date: '2026-04-01',
    end_date: '2026-04-07',
    travelers: 2,
    traveler_type: 'couple',
    vibes: ['food'],
    budget: 'mid-range',
    budget_tier: 'luxury',
    status: 'generated',
    cover_image: '/cover.jpg',
    itinerary: { days: [] },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function renderUseTrips() {
  let value: ReturnType<typeof useTrips> | undefined;

  function Harness() {
    value = useTrips();
    return null;
  }

  renderToString(React.createElement(Harness));
  if (!value) throw new Error('useTrips harness did not render');
  return value as ReturnType<typeof useTrips>;
}

beforeEach(() => {
  jest.clearAllMocks();
  useUserStore.getState().setUser({
    id: 'user-1',
    name: 'Fixture',
    email: 'fixture@example.invalid',
    preferences: { vibes: [] },
  });
  networkMonitor.isOnline.mockReturnValue(true);
  useTripStore.setState({
    trips: [],
    currentTrip: null,
    draftInput: {
      destination: '',
      startDate: '',
      endDate: '',
      travelers: 2,
      travelerType: 'couple',
      vibes: [],
    },
    isGenerating: false,
    generationProgress: 0,
    isHydrated: false,
  });
});

describe('useTrips', () => {
  it('replaces stale local trips with the backend trip list when fetching', async () => {
    useTripStore
      .getState()
      .setTrips([makeTrip('trip-stale', 'Kyoto'), makeTrip('trip-kept', 'Tokyo')]);
    jest.clearAllMocks();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ trips: [makeApiTrip('trip-kept', 'Tokyo')] }),
    });

    const tripsApi = renderUseTrips();
    const trips = await tripsApi.fetchTrips();

    expect(trips.map((trip: Trip) => trip.id)).toEqual(['trip-kept']);
    expect(useTripStore.getState().trips.map((trip) => trip.id)).toEqual(['trip-kept']);
    expect(trips[0].budget).toBe('luxury');
    expect(offlineStorage.saveTrips).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'trip-kept', status: 'planned', budget: 'luxury' })],
      'user-1'
    );
    expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
  });

  it('uses cached trips as the offline list in one store update', async () => {
    networkMonitor.isOnline.mockReturnValue(false);
    const cachedTrips = [makeTrip('trip-cached', 'Osaka')];
    offlineStorage.loadTrips.mockResolvedValueOnce(cachedTrips);

    const tripsApi = renderUseTrips();
    const trips = await tripsApi.fetchTrips();

    expect(trips).toEqual(cachedTrips);
    expect(useTripStore.getState().trips).toEqual(cachedTrips);
    expect(offlineStorage.saveTrips).not.toHaveBeenCalled();
    expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
  });

  it('does not expose old booking cards after a brief edit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trip: {
          ...makeApiTrip('trip-1', 'Paris'),
          preferences: { planNeedsRefresh: true },
        },
        itinerary: {
          topHotel: { name: 'Old hotel', bookingUrl: 'https://example.invalid/hotel' },
          days: [
            { activities: [{ title: 'Old tour', bookingUrl: 'https://example.invalid/tour' }] },
          ],
        },
      }),
    });
    const trip = await renderUseTrips().getTripById('trip-1');
    expect(trip.planNeedsRefresh).toBe(true);
    expect(trip.days).toEqual([]);
    expect(trip.hotel).toBeUndefined();
  });

  it('returns the updated trip when queueing an offline update', async () => {
    networkMonitor.isOnline.mockReturnValue(false);
    const originalTrip = makeTrip('trip-1', 'Tokyo');
    useTripStore.getState().setTrips([originalTrip]);
    jest.clearAllMocks();

    const tripsApi = renderUseTrips();
    const updated = await tripsApi.updateTrip('trip-1', { destination: 'Osaka' });

    expect(updated?.destination).toBe('Osaka');
    expect(useTripStore.getState().trips[0].destination).toBe('Osaka');
    expect(syncService.queueUpdate).toHaveBeenCalledWith('trip-1', { destination: 'Osaka' });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

it('does not restore an old account list after switching accounts', async () => {
  const response = deferred<unknown>();
  const started = deferred<void>();
  mockFetch.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  const api = renderUseTrips();
  const read = api.fetchTrips();
  await started.promise;
  useUserStore.getState().setUser({
    id: 'user-2',
    name: 'Other',
    email: 'other@example.invalid',
    preferences: { vibes: [] },
  });
  useTripStore.setState({ trips: [makeTrip('new-account', 'Rome')] });
  jest.clearAllMocks();
  response.resolve({
    ok: true,
    json: async () => ({ trips: [makeApiTrip('old-account', 'Tokyo')] }),
  });
  expect(await read).toEqual([]);
  expect(useTripStore.getState().trips.map((trip) => trip.id)).toEqual(['new-account']);
  expect(offlineStorage.saveTrips).not.toHaveBeenCalled();
  expect(offlineStorage.loadTrips).not.toHaveBeenCalled();
});

it('ignores an old offline cache read after the account changes', async () => {
  networkMonitor.isOnline.mockReturnValue(false);
  const cached = deferred<Trip[]>();
  offlineStorage.loadTrips.mockReturnValueOnce(cached.promise);
  const read = renderUseTrips().fetchTrips();
  useUserStore.getState().logout();
  cached.resolve([makeTrip('private-old', 'Tokyo')]);
  expect(await read).toEqual([]);
  expect(useTripStore.getState().trips).toEqual([]);
  expect(offlineStorage.saveTrips).not.toHaveBeenCalled();
});

it('invalidates a delayed read across logout and re-login to the same account', async () => {
  const response = deferred<unknown>();
  const started = deferred<void>();
  mockFetch.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  const read = renderUseTrips().fetchTrips();
  await started.promise;
  const previousUser = useUserStore.getState().user!;
  useUserStore.getState().logout();
  useUserStore.getState().setUser(previousUser);
  response.resolve({
    ok: true,
    json: async () => ({ trips: [makeApiTrip('stale-session', 'Tokyo')] }),
  });
  expect(await read).toEqual([]);
  expect(useTripStore.getState().trips).toEqual([]);
});

it('keeps the newer detail request when an older request finishes later', async () => {
  const response = deferred<unknown>();
  const started = deferred<void>();
  mockFetch.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ trip: makeApiTrip('new-trip', 'Paris'), itinerary: { days: [] } }),
  });
  const api = renderUseTrips();
  const old = api.getTripById('old-trip').catch((error) => error);
  await started.promise;
  await api.getTripById('new-trip');
  response.resolve({
    ok: true,
    json: async () => ({ trip: makeApiTrip('old-trip', 'Tokyo'), itinerary: { days: [] } }),
  });
  expect((await old).name).toBe('TripAccountChangedError');
  expect(useTripStore.getState().currentTrip?.id).toBe('new-trip');
});

it('does not save or publish a cancelled detail response after another screen reopens', async () => {
  const response = deferred<unknown>();
  const started = deferred<void>();
  mockFetch.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  const controller = new AbortController();
  const first = renderUseTrips()
    .getTripById('trip-1', controller.signal)
    .catch((error) => error);
  await started.promise;
  controller.abort();
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);

  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      trip: { ...makeApiTrip('trip-1', 'Latest Kyoto'), updated_at: '2026-01-03T00:00:00.000Z' },
      itinerary: { days: [] },
    }),
  });
  const latest = await renderUseTrips().getTripById('trip-1', new AbortController().signal);
  response.resolve({
    ok: true,
    json: async () => ({ trip: makeApiTrip('trip-1', 'Older Tokyo'), itinerary: { days: [] } }),
  });
  expect((await first).name).toBe('AbortError');
  expect(useTripStore.getState().currentTrip).toBe(latest);
  expect(offlineStorage.saveTrip).toHaveBeenCalledTimes(1);
  expect(offlineStorage.saveTrip).toHaveBeenCalledWith(latest, 'user-1');
});

it('does not dispatch a detail read cancelled before session resolution', async () => {
  const { supabase } = require('../../lib/supabase');
  const session = deferred<unknown>();
  supabase.auth.getSession.mockReturnValueOnce(session.promise);
  const controller = new AbortController();
  const read = renderUseTrips()
    .getTripById('trip-1', controller.signal)
    .catch((error) => error);
  controller.abort();
  session.resolve({
    data: { session: { user: { id: 'user-1' }, access_token: 'fixture' } },
    error: null,
  });
  expect((await read).name).toBe('AbortError');
  expect(mockFetch).not.toHaveBeenCalled();
  expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
});

it('does not publish detail cancelled during an already-started cache save', async () => {
  const saving = deferred<void>();
  const started = deferred<void>();
  offlineStorage.saveTrip.mockImplementationOnce(() => {
    started.resolve();
    return saving.promise;
  });
  const previous = makeTrip('trip-1', 'Previous detail');
  useTripStore.setState({ currentTrip: previous });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      trip: makeApiTrip('trip-1', 'Cancelled detail'),
      itinerary: { days: [] },
    }),
  });
  const controller = new AbortController();
  const read = renderUseTrips()
    .getTripById('trip-1', controller.signal)
    .catch((error) => error);
  await started.promise;
  controller.abort();
  saving.resolve();
  expect((await read).name).toBe('AbortError');
  expect(useTripStore.getState().currentTrip).toBe(previous);
});

it('refuses a session from a different account before dispatching a private read', async () => {
  const { supabase } = require('../../lib/supabase');
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: 'user-2' }, access_token: 'other-token' } },
    error: null,
  });
  expect(await renderUseTrips().fetchTrips()).toEqual([]);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(offlineStorage.loadTrips).not.toHaveBeenCalled();
});

it.each(['create', 'update', 'delete'] as const)(
  'fences a late online %s response after an account switch',
  async (operation) => {
    const response = deferred<unknown>();
    const started = deferred<void>();
    mockFetch.mockImplementationOnce(() => {
      started.resolve();
      return response.promise;
    });
    const api = renderUseTrips();
    const input = {
      destination: 'Tokyo',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      travelers: 2,
      travelerType: 'couple',
      vibes: [],
    };
    const work = (
      operation === 'create'
        ? api.createTrip(input)
        : operation === 'update'
          ? api.updateTrip('trip-old', { destination: 'Osaka' })
          : api.deleteTrip('trip-old')
    ).catch((error) => error);
    await started.promise;
    useUserStore.getState().setUser({
      id: 'user-2',
      name: 'Other',
      email: 'other@example.invalid',
      preferences: { vibes: [] },
    });
    useTripStore.setState({
      trips: [makeTrip('trip-old', 'New account trip')],
      currentTrip: makeTrip('new-current', 'Rome'),
    });
    jest.clearAllMocks();
    response.resolve({
      ok: true,
      json: async () => ({ trip: makeApiTrip('trip-old', 'Old account trip') }),
    });
    expect((await work).name).toBe('TripAccountChangedError');
    expect(useTripStore.getState().trips[0].destination).toBe('New account trip');
    expect(useTripStore.getState().currentTrip?.id).toBe('new-current');
    expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
    expect(offlineStorage.deleteTrip).not.toHaveBeenCalled();
  }
);

it.each(['headers', 'body'] as const)(
  'settles a stalled trip detail %s and ignores its late result',
  async (phase) => {
    jest.useFakeTimers();
    try {
      const late = deferred<unknown>();
      const started = deferred<void>();
      mockFetch.mockImplementationOnce(() => {
        started.resolve();
        return phase === 'headers'
          ? late.promise
          : Promise.resolve({ ok: true, status: 200, json: () => late.promise });
      });
      const result = renderUseTrips()
        .getTripById('late-trip')
        .catch((error) => error);
      await started.promise;
      await jest.advanceTimersByTimeAsync(25_001);
      expect((await result).name).toBe('TimeoutError');
      const data = { trip: makeApiTrip('late-trip', 'Tokyo'), itinerary: { days: [] } };
      late.resolve(phase === 'headers' ? { ok: true, json: async () => data } : data);
      await Promise.resolve();
      expect(useTripStore.getState().currentTrip).toBeNull();
      expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  }
);

it.each(['create', 'update', 'delete'] as const)(
  'keeps the visible trip unchanged when an offline %s queue write fails',
  async (operation) => {
    networkMonitor.isOnline.mockReturnValue(false);
    const existing = makeTrip('trip-existing', 'Tokyo');
    useTripStore.setState({ trips: [existing], currentTrip: existing });
    const failure = new Error('Your device could not save this change. Please try again.');
    const queue =
      operation === 'create'
        ? syncService.queueCreate
        : operation === 'update'
          ? syncService.queueUpdate
          : syncService.queueDelete;
    queue.mockRejectedValueOnce(failure);
    const api = renderUseTrips();
    const work =
      operation === 'create'
        ? api.createTrip({
            destination: 'Paris',
            startDate: '2026-11-01',
            endDate: '2026-11-03',
            travelers: 2,
            travelerType: 'couple',
            vibes: [],
          })
        : operation === 'update'
          ? api.updateTrip(existing.id, { destination: 'Paris' })
          : api.deleteTrip(existing.id);
    await expect(work).rejects.toBe(failure);
    expect(useTripStore.getState().trips).toEqual([existing]);
    expect(useTripStore.getState().currentTrip).toBe(existing);
    expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
    expect(offlineStorage.deleteTrip).not.toHaveBeenCalled();
  }
);

it.each(['create', 'update', 'delete'] as const)(
  'ignores an offline %s queue completion after an account switch',
  async (operation) => {
    networkMonitor.isOnline.mockReturnValue(false);
    const existing = makeTrip('trip-existing', 'Tokyo');
    useTripStore.setState({ trips: [existing], currentTrip: existing });
    const queued = deferred<void>();
    const queue =
      operation === 'create'
        ? syncService.queueCreate
        : operation === 'update'
          ? syncService.queueUpdate
          : syncService.queueDelete;
    queue.mockReturnValueOnce(queued.promise);
    const api = renderUseTrips();
    const work = (
      operation === 'create'
        ? api.createTrip({
            destination: 'Paris',
            startDate: '2026-11-01',
            endDate: '2026-11-03',
            travelers: 2,
            travelerType: 'couple',
            vibes: [],
          })
        : operation === 'update'
          ? api.updateTrip(existing.id, { destination: 'Paris' })
          : api.deleteTrip(existing.id)
    ).catch((error) => error);
    useUserStore.getState().setUser({
      id: 'user-2',
      name: 'Other',
      email: 'other@example.invalid',
      preferences: { vibes: [] },
    });
    const other = makeTrip('other-trip', 'Rome');
    useTripStore.setState({ trips: [other], currentTrip: other });
    queued.resolve();
    expect((await work).name).toBe('TripAccountChangedError');
    expect(useTripStore.getState().trips).toEqual([other]);
    expect(useTripStore.getState().currentTrip).toBe(other);
    expect(offlineStorage.saveTrip).not.toHaveBeenCalled();
    expect(offlineStorage.deleteTrip).not.toHaveBeenCalled();
  }
);

it('keeps durable pending edits visible without writing them over the saved server snapshot', async () => {
  const pending = makeTrip('trip-a', 'Osaka');
  offlineStorage.getPendingMutations.mockResolvedValueOnce([
    { ownerId: 'user-1', type: 'update', tripId: 'trip-a', localTrip: pending },
  ]);
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ trips: [makeApiTrip('trip-a', 'Tokyo')] }),
  });
  const visible = await renderUseTrips().fetchTrips();
  expect(visible).toEqual([pending]);
  expect(useTripStore.getState().trips).toEqual([pending]);
  expect(offlineStorage.saveTrips.mock.calls[0][0][0].destination).toBe('Tokyo');
  expect(offlineStorage.saveTrips).toHaveBeenCalledTimes(1);
});

it('settles a stalled SDK session before a private request and ignores its late response', async () => {
  jest.useFakeTimers();
  try {
    const { supabase } = require('../../lib/supabase');
    const response = deferred<unknown>();
    supabase.auth.getSession.mockReturnValueOnce(response.promise);
    const original = makeTrip('saved', 'Tokyo');
    useTripStore.setState({ currentTrip: original, trips: [original] });
    const work = renderUseTrips()
      .getTripById('new-trip')
      .catch((error) => error);
    await jest.advanceTimersByTimeAsync(20_001);
    expect((await work).name).toBe('TripAccessError');
    expect(mockFetch).not.toHaveBeenCalled();
    response.resolve({
      data: { session: { user: { id: 'user-1' }, access_token: 'late-token' } },
      error: null,
    });
    await Promise.resolve();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(useTripStore.getState().currentTrip).toBe(original);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('malformed top-level days do not prevent valid itinerary chapters from loading', () => {
  const valid = {
    date: '2026-11-01',
    dayNumber: 1,
    title: 'A valid chapter',
    morning: { activities: [{ id: 'stop-a', name: 'Museum' }] },
  };
  const days = transformItineraryDays([null, undefined, 'bad day', [], valid]);
  expect(days).toHaveLength(1);
  expect(days[0].theme).toBe('A valid chapter');
  expect(days[0].activities[0].title).toBe('Museum');
});

test('flat cached activities normalize malformed display fields while preserving usable stops', () => {
  const days = transformItineraryDays([
    {
      date: '2026-11-01',
      dayNumber: 1,
      theme: 'A good day',
      activities: [
        null,
        { title: {} },
        {
          id: 'a',
          title: 'Museum',
          description: {},
          location: {},
          duration: {},
          time: '09:00',
          type: 'nonsense',
          rating: 8,
        },
      ],
    },
  ]);
  expect(days[0].activities).toHaveLength(1);
  expect(days[0].activities[0]).toMatchObject({
    title: 'Museum',
    description: '',
    location: '',
    duration: '',
    time: '09:00',
    type: 'activity',
  });
  expect(days[0].activities[0].rating).toBeUndefined();
});

test('transport normalization preserves known currency and does not invent prices or display objects', () => {
  const days = transformItineraryDays([
    {
      dayNumber: 1,
      activities: [],
      transport: {
        type: 'train',
        provider: {},
        departure: { airport: {}, city: 'Paris', dateTime: {} },
        arrival: null,
        price: 'bad',
        currency: 'EUR',
      },
    },
  ]);
  expect(days[0].transport).toMatchObject({
    type: 'train',
    provider: 'Transport option',
    departure: { airport: '', city: 'Paris', dateTime: '' },
    arrival: { airport: '', city: '', dateTime: '' },
    currency: 'EUR',
  });
  expect(days[0].transport?.price).toBeUndefined();
  expect(
    transformItineraryDays([{ activities: [], transport: { type: 'invalid' } }])[0].transport
  ).toBeUndefined();
});

it('settles a failed network and cache read without erasing the displayed saved trips', async () => {
  const existing = makeTrip('trip-existing', 'Tokyo');
  useTripStore.setState({ trips: [existing] });
  mockFetch.mockRejectedValueOnce(new Error('Network unavailable'));
  offlineStorage.loadTrips.mockRejectedValueOnce(new Error('Cache unavailable'));
  await expect(renderUseTrips().fetchTrips()).resolves.toEqual([]);
  expect(useTripStore.getState().trips).toEqual([existing]);
});

it('keeps same-revision saved detail when the API list supplies only a summary', async () => {
  const cached = {
    ...makeTrip('trip-kept', 'Tokyo'),
    updatedAt: '2026-01-01T00:00:00.000Z',
    days: [{ dayNumber: 1, date: '2026-04-01', theme: 'Saved neighborhood day', activities: [] }],
  } as Trip;
  useTripStore.setState({ trips: [cached] });
  const summary = makeApiTrip('trip-kept', 'Tokyo');
  delete (summary as { itinerary?: unknown }).itinerary;
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ trips: [summary] }) });
  const result = await renderUseTrips().fetchTrips();
  expect(result[0].days).toEqual(cached.days);
  expect(offlineStorage.saveTrips).toHaveBeenCalledWith(
    [expect.objectContaining({ days: cached.days })],
    'user-1'
  );
});

it.each(['changed revision', 'stale plan'])(
  'does not retain cached detail for %s',
  async (scenario) => {
    useTripStore.setState({
      trips: [
        {
          ...makeTrip('trip-kept', 'Tokyo'),
          updatedAt: '2026-01-01T00:00:00.000Z',
          days: [{ date: '2026-04-01', dayNumber: 1, theme: 'Old day', activities: [] }],
        },
      ],
    });
    const summary = {
      ...makeApiTrip('trip-kept', 'Tokyo'),
      ...(scenario === 'changed revision'
        ? { updated_at: '2026-01-02T00:00:00.000Z' }
        : { preferences: { planNeedsRefresh: true } }),
    };
    delete (summary as { itinerary?: unknown }).itinerary;
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ trips: [summary] }) });
    expect((await renderUseTrips().fetchTrips())[0].days).toEqual([]);
  }
);

it('durably saves verified fetched trip detail before publishing it', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ trip: makeApiTrip('trip-detail', 'Paris'), itinerary: { days: [] } }),
  });
  const detail = await renderUseTrips().getTripById('trip-detail');
  expect(offlineStorage.saveTrip).toHaveBeenCalledWith(detail, 'user-1');
  expect(useTripStore.getState().currentTrip).toEqual(detail);
});

it('keeps the last loaded detail when durable saving fails', async () => {
  const previous = makeTrip('previous-detail', 'Kyoto');
  useTripStore.setState({ currentTrip: previous });
  offlineStorage.saveTrip.mockRejectedValueOnce(new Error('Device storage unavailable'));
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ trip: makeApiTrip('trip-detail', 'Paris'), itinerary: { days: [] } }),
  });
  await expect(renderUseTrips().getTripById('trip-detail')).rejects.toThrow(
    'Device storage unavailable'
  );
  expect(useTripStore.getState().currentTrip).toEqual(previous);
});

it('keeps all paginated journeys when replacing the saved list', async () => {
  const first = Array.from({ length: 100 }, (_, i) => makeApiTrip(`page-${i}`, 'Paris'));
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ trips: first, nextCursor: 'next-page' }),
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ trips: [makeApiTrip('page-100', 'Tokyo')], nextCursor: null }),
  });
  expect(await renderUseTrips().fetchTrips()).toHaveLength(101);
  expect(useTripStore.getState().trips).toHaveLength(101);
  expect(offlineStorage.saveTrips).toHaveBeenCalledTimes(1);
  expect(mockFetch.mock.calls[1][0]).toContain('?cursor=next-page');
});
it('keeps existing offline and visible trips if a later page fails', async () => {
  const kept = makeTrip('kept', 'Kyoto');
  useTripStore.getState().setTrips([kept]);
  jest.clearAllMocks();
  offlineStorage.loadTrips.mockResolvedValueOnce([kept]);
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ trips: [makeApiTrip('new', 'Paris')], nextCursor: 'next-page' }),
  });
  mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
  expect(await renderUseTrips().fetchTrips()).toEqual([kept]);
  expect(useTripStore.getState().trips).toEqual([kept]);
  expect(offlineStorage.saveTrips).not.toHaveBeenCalled();
});
