jest.mock('../../lib/tripAccountScope', () => ({
  captureTripAccount: () => {
    throw new Error('Search account scope is outside this API-wrapper suite');
  },
}));
jest.mock('../../lib/planningConsent', () => ({ withPlanningConsent: jest.fn() }));
// Mock expo-constants before importing api module
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '192.168.1.5:8081' } },
}));

// Mock the constants/api module
jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  API_TIMEOUT: 5000,
}));

import {
  isAllowedAffiliateUrl,
  setAuthToken,
  getAuthToken,
  getUserProfile,
  getTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  shareTrip,
  revokeTripShare,
  getPopularDestinations,
  getTrendingDestinations,
  trackAffiliateClick,
  openAffiliateLink,
  registerPushToken,
  removePushToken,
} from '../../services/api';

// Mock global fetch
const mockFetch = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  setAuthToken(null);
});

describe('auth token management', () => {
  it('getAuthToken returns null initially', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('setAuthToken stores and getAuthToken retrieves', () => {
    setAuthToken('test-token-123');
    expect(getAuthToken()).toBe('test-token-123');
  });

  it('setAuthToken can clear the token', () => {
    setAuthToken('test-token-123');
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });
});

describe('getUserProfile', () => {
  it('calls the correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'user-1', email: 'test@example.com' }),
    });

    const result = await getUserProfile();
    expect(result.data).toEqual({ id: 'user-1', email: 'test@example.com' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/user/profile',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('sends auth token when set', async () => {
    setAuthToken('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'user-1' }),
    });

    await getUserProfile();
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['Authorization']).toBe('Bearer my-token');
  });
});

describe('getTrips', () => {
  it('returns trips array on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ trips: [{ id: 'trip-1' }] }),
    });

    const result = await getTrips();
    expect(result.data?.trips).toHaveLength(1);
  });
});

describe('getTrip', () => {
  it('fetches a single trip by ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ trip: { id: 'trip-1', destination: 'Tokyo' } }),
    });

    const result = await getTrip('trip-1');
    expect(result.data?.trip.destination).toBe('Tokyo');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/trips/trip-1',
      expect.anything()
    );
  });
});

describe('createTrip', () => {
  it('sends POST with trip data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ trip: { id: 'trip-new', destination: 'Paris' } }),
    });

    const result = await createTrip({
      destination: 'Paris',
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      preferences: {
        travelerType: 'couple',
        originCity: 'Los Angeles',
        originAirport: 'LAX',
      },
    });

    expect(result.data?.trip.destination).toBe('Paris');
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.destination).toBe('Paris');
    expect(body.travelers).toBe(2);
    expect(body.preferences).toEqual({
      travelerType: 'couple',
      originCity: 'Los Angeles',
      originAirport: 'LAX',
    });
  });
});

describe('updateTrip', () => {
  it('sends PATCH with updates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ trip: { id: 'trip-1', destination: 'Osaka' } }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTrip('trip-1', { destination: 'Osaka' } as any);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/trips/trip-1');
    expect(options.method).toBe('PATCH');
  });
});

describe('deleteTrip', () => {
  it('sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await deleteTrip('trip-1');
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
  });
});

describe('shareTrip', () => {
  it('sends POST to share endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareUrl: 'https://faroway.ai/s/abc', shareToken: 'abc' }),
    });

    const result = await shareTrip('trip-1');
    expect(result.data?.shareToken).toBe('abc');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/trips/trip-1/share',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ publicConsent: true }) })
    );
  });
  it('revokes the public link through the authenticated API', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
    await revokeTripShare('trip-1');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/trips/trip-1/share',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

describe('getPopularDestinations', () => {
  it('builds query string from params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ destinations: [] }),
    });

    await getPopularDestinations({ limit: 5, offset: 10, tags: 'beach' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('limit=5');
    expect(url).toContain('offset=10');
    expect(url).toContain('tags=beach');
  });

  it('sends no query string with empty params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ destinations: [] }),
    });

    await getPopularDestinations();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/destinations/popular');
  });
});

describe('getTrendingDestinations', () => {
  it('fetches trending destinations', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ destinations: [{ name: 'Bali' }] }),
    });

    const result = await getTrendingDestinations({ limit: 3 });
    expect(result.data?.destinations).toHaveLength(1);
  });
});

describe('trackAffiliateClick', () => {
  it('sends POST with click params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ clickId: 'click-1', redirectUrl: 'https://retired-supplier.example' }),
    });

    const result = await trackAffiliateClick({
      itemType: 'hotel',
      itemId: 'htl-1',
      itemName: 'Grand Hotel',
      affiliatePartner: 'retired-supplier.example',
      affiliateUrl: 'https://retired-supplier.example/hotel/1',
    });

    expect(result.data?.clickId).toBe('click-1');
  });
});

describe('push token APIs', () => {
  it('registers the current device push token through the backend', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          token: 'ExpoPushToken[abc123]',
          platform: 'ios',
          deviceName: 'iPhone',
          updatedAt: '2026-06-01T00:00:00Z',
          lastSeenAt: '2026-06-01T00:00:00Z',
        }),
    });

    const result = await registerPushToken({
      token: 'ExpoPushToken[abc123]',
      platform: 'ios',
      deviceName: 'iPhone',
    });

    expect(result.data?.token).toBe('ExpoPushToken[abc123]');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/user/push-token');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      token: 'ExpoPushToken[abc123]',
      platform: 'ios',
      deviceName: 'iPhone',
    });
  });

  it('removes a registered push token through the backend', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ deleted: true }),
    });

    const result = await removePushToken('ExpoPushToken[abc123]');

    expect(result.data?.deleted).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/user/push-token');
    expect(options.method).toBe('DELETE');
    expect(JSON.parse(options.body)).toEqual({ token: 'ExpoPushToken[abc123]' });
  });
});

describe('openAffiliateLink', () => {
  it('rejects legacy tracking-based checkout without fetching or opening a URL', async () => {
    const openUrl = jest.fn();
    await expect(
      openAffiliateLink(
        {
          itemType: 'hotel',
          itemId: 'hotel-1',
          itemName: 'Hotel',
          affiliatePartner: 'retired-provider',
          affiliateUrl: 'https://retired-supplier.example/hotel/1',
        },
        openUrl
      )
    ).rejects.toThrow('saved trip');
    expect(openUrl).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('returns error object on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found', code: 'NOT_FOUND' }),
    });

    const result = await getTrip('nonexistent');
    expect(result.error).toBe('Not found');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns TIMEOUT error on abort', async () => {
    mockFetch.mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

    const result = await getTrips();
    expect(result.error).toBe('Request timed out');
    expect(result.code).toBe('TIMEOUT');
  });

  it('returns NETWORK_ERROR for generic errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const result = await getTrips();
    expect(result.error).toBe('Network failure');
    expect(result.code).toBe('NETWORK_ERROR');
  });

  it('returns UNKNOWN_ERROR for non-Error throws', async () => {
    mockFetch.mockRejectedValueOnce('something weird');

    const result = await getTrips();
    expect(result.error).toBe('Unknown error occurred');
    expect(result.code).toBe('UNKNOWN_ERROR');
  });

  it('handles an empty success response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
    });

    const result = await getTrips();
    expect(result.data).toBeNull();
  });

  it('returns INVALID_RESPONSE for malformed server JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('{not-json'),
    });

    const result = await getTrips();
    expect(result.error).toBe('Invalid server response');
    expect(result.code).toBe('INVALID_RESPONSE');
  });
});

describe('retired affiliate suppliers', () => {
  it.each([
    'https://retired-supplier.example/hotel/1',
    'https://www.retired-supplier.example/hotel/1',
    'https://retired-air.example/offer/1',
  ])('does not authorize retired outbound links: %s', (url) => {
    expect(isAllowedAffiliateUrl(url)).toBe(false);
  });
  it('retains Duffel outbound links', () => {
    expect(isAllowedAffiliateUrl('https://links.duffel.com/session/1')).toBe(true);
  });
});
