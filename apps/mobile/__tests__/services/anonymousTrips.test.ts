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

jest.mock('../../lib/supabase', () => ({
  API_BASE_URL: 'http://localhost:3000',
}));

import {
  ANONYMOUS_TRIPS_KEY,
  claimAnonymousTrips,
  clearAnonymousTripIds,
  getAnonymousTripIds,
  rememberAnonymousTripId,
} from '../../services/anonymousTrips';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  storage.clear();
  jest.clearAllMocks();
});

describe('anonymous trip storage', () => {
  it('remembers anonymous trip IDs without duplicates', async () => {
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000001');
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000001');
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000002');

    await expect(getAnonymousTripIds()).resolves.toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ]);
  });

  it('ignores IDs that the backend claim route cannot accept', async () => {
    await rememberAnonymousTripId('local_123');
    storage.set(
      ANONYMOUS_TRIPS_KEY,
      JSON.stringify(['trip-1', '00000000-0000-4000-8000-000000000001'])
    );

    await expect(getAnonymousTripIds()).resolves.toEqual(['00000000-0000-4000-8000-000000000001']);
  });

  it('ignores malformed stored data', async () => {
    storage.set(ANONYMOUS_TRIPS_KEY, '{not-json');

    await expect(getAnonymousTripIds()).resolves.toEqual([]);
  });

  it('clears claimed anonymous trip IDs', async () => {
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000001');
    await clearAnonymousTripIds();

    await expect(getAnonymousTripIds()).resolves.toEqual([]);
  });

  it('claims stored anonymous trip IDs with bearer auth and clears them on success', async () => {
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000001');
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000002');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          claimed: 2,
          tripIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
        }),
    });

    await expect(claimAnonymousTrips('session-token')).resolves.toBe(true);

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/auth/claim-trips', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer session-token',
      },
      body: JSON.stringify({
        tripIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
      }),
    });
    await expect(getAnonymousTripIds()).resolves.toEqual([]);
  });

  it('keeps unclaimed anonymous trip IDs after a partial claim response', async () => {
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000001');
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000002');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          claimed: 1,
          tripIds: ['00000000-0000-4000-8000-000000000001'],
        }),
    });

    await expect(claimAnonymousTrips('session-token')).resolves.toBe(false);
    await expect(getAnonymousTripIds()).resolves.toEqual(['00000000-0000-4000-8000-000000000002']);
  });

  it('keeps anonymous trip IDs for a later retry when claim fails', async () => {
    await rememberAnonymousTripId('00000000-0000-4000-8000-000000000001');
    mockFetch.mockResolvedValueOnce({ ok: false });

    await expect(claimAnonymousTrips('session-token')).resolves.toBe(false);
    await expect(getAnonymousTripIds()).resolves.toEqual(['00000000-0000-4000-8000-000000000001']);
  });

  it('does not call the network when there are no anonymous trip IDs', async () => {
    await expect(claimAnonymousTrips('session-token')).resolves.toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
