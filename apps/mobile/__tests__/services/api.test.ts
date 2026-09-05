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
  setAuthToken,
  getAuthToken,
  getUserProfile,
  getTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  shareTrip,
  getPopularDestinations,
  getTrendingDestinations,
  trackAffiliateClick,
  openAffiliateLink,
  isAllowedAffiliateUrl,
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
  it('preserves supported server-shaped fields on the wire', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ trip: {} }) });
    await updateTrip('trip-1', {
      start_date: '2026-12-01',
      end_date: '2026-12-07',
      status: 'draft',
    });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      start_date: '2026-12-01',
      end_date: '2026-12-07',
      status: 'draft',
    });
  });

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
    expect(JSON.parse(options.body)).toEqual({ destination: 'Osaka' });
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
      expect.objectContaining({ method: 'POST' })
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
      json: () => Promise.resolve({ clickId: 'click-1', redirectUrl: 'https://booking.com' }),
    });

    const result = await trackAffiliateClick({
      itemType: 'hotel',
      itemId: 'htl-1',
      itemName: 'Grand Hotel',
      affiliatePartner: 'booking.com',
      affiliateUrl: 'https://booking.com/hotel/1',
    });

    expect(result.data?.clickId).toBe('click-1');
  });
});

describe('isAllowedAffiliateUrl', () => {
  it('requires provider-issued attribution on Viator links before opening them', () => {
    expect(
      isAllowedAffiliateUrl(
        'https://www.viator.com/tours/123?pid=P12345678&mcid=42383&medium=api',
        'viator'
      )
    ).toBe(true);
    expect(
      isAllowedAffiliateUrl(
        'https://www.viator.com/tours/123?pid=faroway&mcid=click_old&medium=api',
        'viator'
      )
    ).toBe(false);
    expect(isAllowedAffiliateUrl('https://www.viator.com/tours/123', 'viator')).toBe(false);
  });
  it('accepts a URL only when its host matches the selected partner', () => {
    expect(isAllowedAffiliateUrl('https://www.booking.com/hotel/1', 'booking.com')).toBe(true);
    expect(isAllowedAffiliateUrl('https://www.booking.com/hotel/1', 'viator')).toBe(false);
    expect(isAllowedAffiliateUrl('https://www.opentable.com/r/bistro', 'opentable')).toBe(true);
  });

  it('rejects unknown partners and non-HTTPS URLs', () => {
    expect(isAllowedAffiliateUrl('https://www.booking.com/hotel/1', 'unknown')).toBe(false);
    expect(isAllowedAffiliateUrl('http://www.booking.com/hotel/1', 'booking')).toBe(false);
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
  it('opens redirect URL from tracking response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ clickId: 'c1', redirectUrl: 'https://redirect.com' }),
    });

    const openUrl = jest.fn();
    await openAffiliateLink(
      {
        itemType: 'hotel',
        itemId: 'htl-1',
        itemName: 'Hotel',
        affiliatePartner: 'booking.com',
        affiliateUrl: 'https://booking.com/hotel/1',
      },
      openUrl
    );

    expect(openUrl).toHaveBeenCalledWith('https://redirect.com');
  });

  it('falls back to original URL when tracking fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed' }),
    });

    const openUrl = jest.fn();
    await openAffiliateLink(
      {
        itemType: 'hotel',
        itemId: 'htl-1',
        itemName: 'Hotel',
        affiliatePartner: 'booking.com',
        affiliateUrl: 'https://booking.com/original',
      },
      openUrl
    );

    expect(openUrl).toHaveBeenCalledWith('https://booking.com/original');
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
