let mockAccountCurrent = true;
jest.mock('../../lib/tripAccountScope', () => ({
  captureTripAccount: () => ({
    assertCurrent: () => {
      if (!mockAccountCurrent) throw new Error('Your account changed');
    },
    headers: async () => ({ Authorization: 'Bearer current-account' }),
  }),
}));
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
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {} },
}));

jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  API_TIMEOUT: 5000,
}));

import {
  startSearch,
  getSearchStatus,
  pollSearchStatus,
  calculateProgressPercent,
  getStatusMessage,
} from '../../services/searchService';

import type { SearchProgress } from '@faroway/types';

const mockFetch = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountCurrent = true;
});

describe('startSearch', () => {
  it('sends POST with search input', async () => {
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

    const result = await startSearch({
      destination: 'Tokyo',
      startDate: '2026-04-01',
      endDate: '2026-04-07',
      travelers: 2,
      vibes: ['adventure'],
    });

    expect(result.searchId).toBe('s-1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/search/start');
    expect(options.method).toBe('POST');
  });

  it('uses consent-bound session auth instead of a caller-supplied token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ searchId: 's-1', status: 'started' }),
    });

    await startSearch(
      {
        destination: 'Tokyo',
        startDate: '2026-04-01',
        endDate: '2026-04-07',
        travelers: 2,
        vibes: [],
      },
      'my-token'
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer current-session');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid input' }),
    });

    await expect(
      startSearch({
        destination: '',
        startDate: '',
        endDate: '',
        travelers: 0,
        vibes: [],
      })
    ).rejects.toThrow('Invalid input');
  });

  it('handles json parse failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.reject(new Error('parse error')),
    });

    await expect(
      startSearch({
        destination: '',
        startDate: '',
        endDate: '',
        travelers: 0,
        vibes: [],
      })
    ).rejects.toThrow('Unknown error');
  });
});

describe('getSearchStatus', () => {
  it('fetches search status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          searchId: 's-1',
          status: 'searching',
          progress: {
            orchestrator: 'done',
            hotels: 'searching',
            activities: 'pending',
            dining: 'pending',
            aggregator: 'pending',
          },
        }),
    });

    const result = await getSearchStatus('s-1');
    expect(result.status).toBe('searching');
  });

  it('rejects invalid search ID with special chars', async () => {
    await expect(getSearchStatus('invalid id!')).rejects.toThrow('Invalid search ID');
  });

  it('rejects empty search ID', async () => {
    await expect(getSearchStatus('')).rejects.toThrow('Invalid search ID');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    await expect(getSearchStatus('valid-id')).rejects.toThrow('Not found');
  });
});

describe('pollSearchStatus', () => {
  it('returns results when status is completed', async () => {
    const mockResults = {
      hotels: [],
      activities: [],
      dining: [],
      suggestedDays: [],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          searchId: 's-1',
          status: 'completed',
          results: mockResults,
          progress: {
            orchestrator: 'done',
            hotels: 'done',
            activities: 'done',
            dining: 'done',
            transport: 'done',
            enrichment: 'done',
            aggregator: 'done',
          },
        }),
    });

    const result = await pollSearchStatus('s-1', undefined, 10, 5);
    expect(result).toEqual(mockResults);
  });

  it('calls onProgress callback', async () => {
    const onProgress = jest.fn();
    const mockResults = {
      hotels: [],
      activities: [],
      dining: [],
      suggestedDays: [],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          searchId: 's-1',
          status: 'completed',
          results: mockResults,
          progress: {
            orchestrator: 'done',
            hotels: 'done',
            activities: 'done',
            dining: 'done',
            transport: 'done',
            enrichment: 'done',
            aggregator: 'done',
          },
        }),
    });

    await pollSearchStatus('s-1', onProgress, 10, 5);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('throws on error status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          searchId: 's-1',
          status: 'error',
          error: 'Search failed',
          progress: {
            orchestrator: 'done',
            hotels: 'done',
            activities: 'done',
            dining: 'done',
            transport: 'done',
            enrichment: 'done',
            aggregator: 'done',
          },
        }),
    });

    await expect(pollSearchStatus('s-1', undefined, 10, 5)).rejects.toThrow('Search failed');
  });

  it('throws on timeout (max attempts reached)', async () => {
    // Always return "searching"
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          searchId: 's-1',
          status: 'searching',
          progress: {
            orchestrator: 'searching',
            hotels: 'pending',
            activities: 'pending',
            dining: 'pending',
            transport: 'pending',
            enrichment: 'pending',
            aggregator: 'pending',
          },
        }),
    });

    await expect(pollSearchStatus('s-1', undefined, 10, 2)).rejects.toThrow('Search timed out');
  }, 10000);
});

describe('calculateProgressPercent', () => {
  it('returns 0 when all stages are pending', () => {
    const progress: SearchProgress = {
      orchestrator: 'pending',
      hotels: 'pending',
      activities: 'pending',
      dining: 'pending',
      transport: 'pending',
      enrichment: 'pending',
      aggregator: 'pending',
    };
    expect(calculateProgressPercent(progress)).toBe(0);
  });

  it('returns 10 per searching stage', () => {
    const progress: SearchProgress = {
      orchestrator: 'searching',
      hotels: 'pending',
      activities: 'pending',
      dining: 'pending',
      transport: 'pending',
      enrichment: 'pending',
      aggregator: 'pending',
    };
    expect(calculateProgressPercent(progress)).toBe(7);
  });

  it('returns 20 per done stage', () => {
    const progress: SearchProgress = {
      orchestrator: 'done',
      hotels: 'pending',
      activities: 'pending',
      dining: 'pending',
      transport: 'pending',
      enrichment: 'pending',
      aggregator: 'pending',
    };
    expect(calculateProgressPercent(progress)).toBe(14);
  });

  it('returns 100 when all stages are done', () => {
    const progress: SearchProgress = {
      orchestrator: 'done',
      hotels: 'done',
      activities: 'done',
      dining: 'done',
      transport: 'done',
      enrichment: 'done',
      aggregator: 'done',
    };
    expect(calculateProgressPercent(progress)).toBe(100);
  });

  it('handles mixed searching and done states', () => {
    const progress: SearchProgress = {
      orchestrator: 'done',
      hotels: 'searching',
      activities: 'done',
      dining: 'pending',
      transport: 'pending',
      enrichment: 'pending',
      aggregator: 'pending',
    };
    // Two done stages plus one searching stage in a 7-stage workflow.
    expect(calculateProgressPercent(progress)).toBe(36);
  });
});

describe('getStatusMessage', () => {
  it('returns aggregator message when aggregator is searching', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'done',
        transport: 'done',
        enrichment: 'done',
        aggregator: 'searching',
      })
    ).toBe('Creating your perfect itinerary...');
  });

  it('returns aggregator message when aggregator is done', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'done',
        transport: 'done',
        enrichment: 'done',
        aggregator: 'done',
      })
    ).toBe('Creating your perfect itinerary...');
  });

  it('returns dining message when dining is searching', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'searching',
        transport: 'done',
        enrichment: 'pending',
        aggregator: 'pending',
      })
    ).toBe('Finding the best restaurants...');
  });

  it('returns activities message when activities is searching', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'done',
        activities: 'searching',
        dining: 'pending',
        transport: 'pending',
        enrichment: 'pending',
        aggregator: 'pending',
      })
    ).toBe('Discovering activities & attractions...');
  });

  it('returns hotels message when hotels is searching', () => {
    expect(
      getStatusMessage({
        orchestrator: 'done',
        hotels: 'searching',
        activities: 'pending',
        dining: 'pending',
        transport: 'pending',
        enrichment: 'pending',
        aggregator: 'pending',
      })
    ).toBe('Searching for hotels...');
  });

  it('returns orchestrator message when orchestrator is searching', () => {
    expect(
      getStatusMessage({
        orchestrator: 'searching',
        hotels: 'pending',
        activities: 'pending',
        dining: 'pending',
        transport: 'pending',
        enrichment: 'pending',
        aggregator: 'pending',
      })
    ).toBe('Understanding your preferences...');
  });

  it('returns default message when all pending', () => {
    expect(
      getStatusMessage({
        orchestrator: 'pending',
        hotels: 'pending',
        activities: 'pending',
        dining: 'pending',
        transport: 'pending',
        enrichment: 'pending',
        aggregator: 'pending',
      })
    ).toBe('Starting your search...');
  });
});

describe('account-scoped status recovery', () => {
  it('sends fresh account authentication', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ searchId: 's-1', status: 'pending' }),
    });
    await getSearchStatus('s-1');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer current-account');
  });
  it('rejects a different search identity', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ searchId: 's-other', status: 'completed', results: {} }),
    });
    await expect(getSearchStatus('s-1')).rejects.toThrow('could not be verified');
  });
  it('settles a stalled status request and aborts it', async () => {
    jest.useFakeTimers();
    try {
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));
      const outcome = expect(getSearchStatus('s-1')).rejects.toThrow('timed out');
      await jest.advanceTimersByTimeAsync(5000);
      await outcome;
      expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
  it('suppresses late progress after the account changes', async () => {
    let release!: (value: unknown) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const progress = jest.fn();
    const outcome = expect(pollSearchStatus('s-1', progress)).rejects.toThrow('account changed');
    await Promise.resolve();
    await Promise.resolve();
    mockAccountCurrent = false;
    const body = jest.fn(async () => ({ searchId: 's-1', status: 'completed', results: {} }));
    release({ ok: true, json: body });
    await outcome;
    expect(body).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
  });
});
