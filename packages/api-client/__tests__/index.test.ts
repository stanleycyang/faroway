import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FarowayClient, calculateProgressPercent, getStatusMessage } from '../src/index';
import type { SearchProgress } from '@faroway/types';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FarowayClient', () => {
  let client: FarowayClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FarowayClient({
      baseUrl: 'https://api.faroway.ai',
      getAuthToken: () => 'test-token',
    });
  });

  describe('constructor', () => {
    it('uses default timeout of 90000ms', () => {
      const c = new FarowayClient({
        baseUrl: 'https://api.faroway.ai',
        getAuthToken: () => null,
      });
      expect(c).toBeDefined();
    });

    it('accepts custom timeout', () => {
      const c = new FarowayClient({
        baseUrl: 'https://api.faroway.ai',
        getAuthToken: () => null,
        timeout: 5000,
      });
      expect(c).toBeDefined();
    });
  });

  describe('getUserProfile', () => {
    it('fetches user profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'user-1', email: 'test@test.com' }),
      });

      const result = await client.getUserProfile();
      expect(result.data).toEqual({ id: 'user-1', email: 'test@test.com' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.faroway.ai/api/user/profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });
  });

  describe('updateUserProfile', () => {
    it('sends PATCH with updates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'user-1', subscriptionTier: 'pro' }),
      });

      const result = await client.updateUserProfile({ subscriptionTier: 'pro' });
      expect(result.data).toBeDefined();
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('PATCH');
    });
  });

  describe('getTrips', () => {
    it('fetches trips list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ trips: [{ id: 'trip-1' }] }),
      });

      const result = await client.getTrips();
      expect(result.data?.trips).toHaveLength(1);
    });
  });

  describe('getTrip', () => {
    it('fetches a single trip', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ trip: { id: 'trip-1', destination: 'Tokyo' } }),
      });

      const result = await client.getTrip('trip-1');
      expect(result.data?.trip.destination).toBe('Tokyo');
    });

    it('encodes trip ID in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ trip: { id: 'trip 1' } }),
      });

      await client.getTrip('trip 1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.faroway.ai/api/trips/trip%201',
        expect.anything(),
      );
    });
  });

  describe('createTrip', () => {
    it('sends POST with trip data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ trip: { id: 'new-trip' } }),
      });

      const result = await client.createTrip({
        destination: 'Paris',
        startDate: '2026-06-01',
        endDate: '2026-06-10',
      });

      expect(result.data?.trip.id).toBe('new-trip');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.destination).toBe('Paris');
      expect(body.travelers).toBe(2);
    });
  });

  describe('deleteTrip', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.deleteTrip('trip-1');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });
  });

  describe('startSearch', () => {
    it('sends POST to search/start', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            searchId: 's-1',
            workflowRunId: 'w-1',
            status: 'started',
            estimatedTime: 30,
          }),
      });

      const result = await client.startSearch({
        destination: 'Tokyo',
        startDate: '2026-04-01',
        endDate: '2026-04-07',
        travelers: 2,
        vibes: ['adventure'],
      });

      expect(result.data?.searchId).toBe('s-1');
    });
  });

  describe('getSearchStatus', () => {
    it('rejects invalid search IDs', async () => {
      const result = await client.getSearchStatus('invalid id!');
      expect(result.error).toBe('Invalid search ID');
      expect(result.code).toBe('INVALID_INPUT');
    });

    it('rejects empty search ID', async () => {
      const result = await client.getSearchStatus('');
      expect(result.error).toBe('Invalid search ID');
    });

    it('fetches status for valid search ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            searchId: 's-1',
            status: 'searching',
            progress: { orchestrator: 'searching', hotels: 'pending', activities: 'pending', dining: 'pending', aggregator: 'pending' },
          }),
      });

      const result = await client.getSearchStatus('valid-search-id');
      expect(result.data?.status).toBe('searching');
    });
  });

  describe('trackAffiliateClick', () => {
    it('sends click tracking data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clickId: 'c-1', redirectUrl: 'https://booking.com' }),
      });

      const result = await client.trackAffiliateClick({
        itemType: 'hotel',
        itemId: 'htl-1',
        itemName: 'Grand Hotel',
        affiliatePartner: 'booking.com',
        affiliateUrl: 'https://booking.com/htl-1',
      });

      expect(result.data?.clickId).toBe('c-1');
    });
  });

  describe('openAffiliateLink', () => {
    it('opens redirect URL from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clickId: 'c-1', redirectUrl: 'https://redirect.com' }),
      });

      const openUrl = vi.fn();
      await client.openAffiliateLink(
        {
          itemType: 'hotel',
          itemId: 'htl-1',
          itemName: 'Hotel',
          affiliatePartner: 'booking.com',
          affiliateUrl: 'https://booking.com/original',
        },
        openUrl,
      );

      expect(openUrl).toHaveBeenCalledWith('https://redirect.com');
    });

    it('falls back to original URL on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed' }),
      });

      const openUrl = vi.fn();
      await client.openAffiliateLink(
        {
          itemType: 'hotel',
          itemId: 'htl-1',
          itemName: 'Hotel',
          affiliatePartner: 'booking.com',
          affiliateUrl: 'https://booking.com/original',
        },
        openUrl,
      );

      expect(openUrl).toHaveBeenCalledWith('https://booking.com/original');
    });
  });

  describe('error handling', () => {
    it('returns error for non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found', code: 'NOT_FOUND' }),
      });

      const result = await client.getTrip('nonexistent');
      expect(result.error).toBe('Not found');
      expect(result.code).toBe('NOT_FOUND');
    });

    it('returns TIMEOUT error on abort', async () => {
      mockFetch.mockRejectedValueOnce(
        Object.assign(new Error('Aborted'), { name: 'AbortError' }),
      );

      const result = await client.getTrips();
      expect(result.error).toBe('Request timed out');
      expect(result.code).toBe('TIMEOUT');
    });

    it('returns NETWORK_ERROR for generic errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await client.getTrips();
      expect(result.error).toBe('Network failure');
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('returns UNKNOWN_ERROR for non-Error throws', async () => {
      mockFetch.mockRejectedValueOnce('something weird');

      const result = await client.getTrips();
      expect(result.error).toBe('Unknown error occurred');
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('returns default error message when API error has no error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await client.getTrips();
      expect(result.error).toBe('Request failed');
    });

    it('does not include auth header when token is null', async () => {
      const noAuthClient = new FarowayClient({
        baseUrl: 'https://api.faroway.ai',
        getAuthToken: () => null,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ trips: [] }),
      });

      await noAuthClient.getTrips();
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });
  });
});

describe('calculateProgressPercent', () => {
  it('returns 0 when all stages are pending', () => {
    const progress: SearchProgress = {
      orchestrator: 'pending',
      hotels: 'pending',
      activities: 'pending',
      dining: 'pending',
      aggregator: 'pending',
    };
    expect(calculateProgressPercent(progress)).toBe(0);
  });

  it('returns 100 when all stages are done', () => {
    const progress: SearchProgress = {
      orchestrator: 'done',
      hotels: 'done',
      activities: 'done',
      dining: 'done',
      aggregator: 'done',
    };
    expect(calculateProgressPercent(progress)).toBe(100);
  });

  it('returns 10 per searching stage', () => {
    expect(
      calculateProgressPercent({
        orchestrator: 'searching',
        hotels: 'pending',
        activities: 'pending',
        dining: 'pending',
        aggregator: 'pending',
      }),
    ).toBe(10);
  });

  it('returns 20 per done stage', () => {
    expect(
      calculateProgressPercent({
        orchestrator: 'done',
        hotels: 'pending',
        activities: 'pending',
        dining: 'pending',
        aggregator: 'pending',
      }),
    ).toBe(20);
  });

  it('handles mix of states', () => {
    expect(
      calculateProgressPercent({
        orchestrator: 'done',
        hotels: 'done',
        activities: 'searching',
        dining: 'pending',
        aggregator: 'pending',
      }),
    ).toBe(50);
  });
});

describe('getStatusMessage', () => {
  it('returns aggregator message when aggregator is active', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'done',
        aggregator: 'searching',
      }),
    ).toBe('Creating your perfect itinerary...');
  });

  it('returns dining message', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'searching',
        aggregator: 'pending',
      }),
    ).toBe('Finding the best restaurants...');
  });

  it('returns activities message', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'done',
        activities: 'searching',
        dining: 'pending',
        aggregator: 'pending',
      }),
    ).toBe('Discovering activities & attractions...');
  });

  it('returns hotels message', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'searching',
        activities: 'pending',
        dining: 'pending',
        aggregator: 'pending',
      }),
    ).toBe('Searching for hotels...');
  });

  it('returns orchestrator message', () => {
    expect(
      getStatusMessage({
        orchestrator: 'searching',
        hotels: 'pending',
        activities: 'pending',
        dining: 'pending',
        aggregator: 'pending',
      }),
    ).toBe('Understanding your preferences...');
  });

  it('returns default message when all pending', () => {
    expect(
      getStatusMessage({
        orchestrator: 'pending',
        hotels: 'pending',
        activities: 'pending',
        dining: 'pending',
        aggregator: 'pending',
      }),
    ).toBe('Starting your search...');
  });
});
