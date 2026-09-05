jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {} },
}));

jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  API_TIMEOUT: 5000,
}));

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  getAuthHeaders: jest.fn(async () => ({})),
}));

import React from 'react';
import {
  extractApiErrorMessage,
  getIncompleteStreamMessage,
  parseSSEBuffer,
  parseStreamingJson,
  useStreamingItinerary,
  type StreamingState,
  type UseStreamingItineraryOptions,
} from '../../hooks/useStreamingItinerary';

const { renderToString } = require('react-dom/server') as {
  renderToString: (element: React.ReactElement) => string;
};

describe('generation request lifecycle', () => {
  const originalFetch = globalThis.fetch;
  const originalXhr = Object.getOwnPropertyDescriptor(globalThis, 'XMLHttpRequest');
  const fetchMock = jest.fn();
  const onError = jest.fn();
  const onComplete = jest.fn();
  const input = {
    destination: 'Tokyo',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    travelers: 2,
    travelerType: 'couple',
    vibes: [],
  };
  let state: StreamingState;
  let effects: React.EffectCallback[];
  let cleanups: Array<() => void>;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    onError.mockReset();
    onComplete.mockReset();
    globalThis.fetch = fetchMock;
    effects = [];
    cleanups = [];
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(React, 'useState').mockImplementation((initial?: unknown) => {
      state = initial as StreamingState;
      return [
        initial,
        (value: unknown) => {
          const next = value as React.SetStateAction<StreamingState>;
          state = typeof next === 'function' ? next(state) : next;
        },
      ];
    });
    jest.spyOn(React, 'useEffect').mockImplementation((effect) => {
      effects.push(effect);
    });
  });
  function cleanup() {
    cleanups
      .splice(0)
      .reverse()
      .forEach((dispose) => dispose());
  }
  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalXhr) Object.defineProperty(globalThis, 'XMLHttpRequest', originalXhr);
    else Reflect.deleteProperty(globalThis, 'XMLHttpRequest');
  });
  function start(options: UseStreamingItineraryOptions = { input }) {
    function Harness() {
      useStreamingItinerary({ streamingEnabled: false, ...options, onError, onComplete });
      return null;
    }
    renderToString(React.createElement(Harness));
    effects.splice(0).forEach((effect) => {
      const dispose = effect();
      if (dispose) cleanups.push(dispose);
    });
  }
  function neverRespond(_url: string, init: RequestInit) {
    return new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () =>
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      );
    });
  }
  function createResponse() {
    return { ok: true, json: async () => ({ trip: { id: 'created-trip' } }) };
  }

  function statusResponse(status: string) {
    return { ok: true, json: async () => ({ status }) };
  }

  it.each([429, 500])('retries dispatch on the retained draft after HTTP %s', async (status) => {
    fetchMock.mockResolvedValueOnce(createResponse()).mockResolvedValueOnce({
      ok: false,
      status,
      text: async () => '{"error":"Try again"}',
    });
    start();
    await jest.advanceTimersByTimeAsync(0);
    expect(state.tripId).toBe('created-trip');
    expect(state.error).toBe('Try again');
    cleanup();
    fetchMock
      .mockResolvedValueOnce(statusResponse('draft'))
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce(statusResponse('completed'));
    start({ tripId: state.tripId!, retryKey: 1 });
    await jest.advanceTimersByTimeAsync(0);
    expect(state.isComplete).toBe(true);
    expect(state.error).toBeNull();
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['http://localhost:3000/api/trips', 'POST'],
      ['http://localhost:3000/api/trips/created-trip/generate', 'POST'],
      ['http://localhost:3000/api/trips/created-trip/generate', 'GET'],
      ['http://localhost:3000/api/trips/created-trip/generate', 'POST'],
      ['http://localhost:3000/api/trips/created-trip/generate', 'GET'],
    ]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it.each(['not_started', 'failed', 'error'])(
    'starts the same trip when recovery finds %s',
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(statusResponse(status))
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce(statusResponse('completed'));
      start({ tripId: 'existing-trip', retryKey: 1 });
      await jest.advanceTimersByTimeAsync(0);
      expect(state.isComplete).toBe(true);
      expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
      expect(fetchMock.mock.calls.every(([url]) => url.includes('/existing-trip/generate'))).toBe(
        true
      );
    }
  );

  it.each(['running', 'completed'])(
    'does not redispatch an existing %s generation',
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(statusResponse(status))
        .mockResolvedValue(statusResponse('completed'));
      start({ tripId: 'existing-trip', retryKey: 1 });
      await jest.advanceTimersByTimeAsync(0);
      expect(state.isComplete).toBe(true);
      expect(fetchMock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true);
    }
  );

  it.each(['unrecognized', 'status-error'])(
    'never dispatches when recovery status is %s',
    async (failure) => {
      fetchMock.mockResolvedValueOnce(
        failure === 'status-error'
          ? { ok: false, status: 503, text: async () => '{"error":"Status unavailable"}' }
          : statusResponse('unexpected')
      );
      start({ tripId: 'existing-trip', retryKey: 1 });
      await jest.advanceTimersByTimeAsync(0);
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['running', 'draft'])(
    'rechecks a dispatch conflict before connecting (%s)',
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(statusResponse('draft'))
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          text: async () => '{"error":"Generation conflict"}',
        })
        .mockResolvedValueOnce(statusResponse(status))
        .mockResolvedValue(statusResponse('completed'));
      start({ tripId: 'existing-trip', retryKey: 1 });
      await jest.advanceTimersByTimeAsync(0);
      expect(state.isComplete).toBe(status === 'running');
      expect(Boolean(state.error)).toBe(status === 'draft');
      expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
    }
  );

  it.each(['draft', 'running', 'completed'])(
    'recovers %s trips through the real SSE branch',
    async (status) => {
      const xhr = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        abort: jest.fn(),
        send: jest.fn(),
        readyState: 4,
        status: 200,
        responseText:
          'event: spec-complete\ndata: {"spec":[{"type":"TripSummary","props":{}}]}\n\nevent: complete\ndata: {}\n\n',
        onprogress: null as (() => void) | null,
        onload: null as (() => void) | null,
      };
      xhr.send.mockImplementation(() => {
        xhr.onprogress?.();
        xhr.onload?.();
      });
      Object.defineProperty(globalThis, 'XMLHttpRequest', {
        configurable: true,
        value: jest.fn(() => xhr),
      });
      fetchMock.mockResolvedValueOnce(statusResponse(status)).mockResolvedValue({ ok: true });
      start({ tripId: 'existing-trip', retryKey: 1, streamingEnabled: true });
      await jest.advanceTimersByTimeAsync(0);
      expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(
        status === 'draft' ? 1 : 0
      );
      expect(xhr.open).toHaveBeenCalledWith(
        'POST',
        'http://localhost:3000/api/trips/existing-trip/stream',
        true
      );
      expect(state.isComplete).toBe(true);
      expect(state.isStreaming).toBe(false);
      expect(onComplete).toHaveBeenCalledWith([{ type: 'TripSummary', props: {} }]);
      expect(onComplete).toHaveBeenCalledTimes(1);
    }
  );

  it('does not dispatch a draft from a status response that arrives after cancellation', async () => {
    let resolveStatus!: (body: unknown) => void;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
    });
    start({ tripId: 'existing-trip', retryKey: 1 });
    await jest.advanceTimersByTimeAsync(0);
    cleanup();
    resolveStatus({ status: 'draft' });
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('settles loading with recovery copy when the real create deadline expires', async () => {
    fetchMock.mockImplementation(neverRespond);
    start();
    await jest.advanceTimersByTimeAsync(0);
    expect(state.isLoading).toBe(true);
    await jest.advanceTimersByTimeAsync(5000);
    expect(state.isLoading).toBe(false);
    expect(state.isStreaming).toBe(false);
    expect(state.error).toMatch(/timed out/i);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('retains the created trip before generation starts and after its deadline expires', async () => {
    fetchMock.mockResolvedValueOnce(createResponse()).mockImplementationOnce(neverRespond);
    start();
    await jest.advanceTimersByTimeAsync(0);
    expect(state.tripId).toBe('created-trip');
    expect(state.isLoading).toBe(true);
    await jest.advanceTimersByTimeAsync(5000);
    expect(state.tripId).toBe('created-trip');
    expect(state.isLoading).toBe(false);
    expect(state.error).toMatch(/timed out/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('settles a polling deadline without losing the supplied trip', async () => {
    fetchMock.mockImplementation(neverRespond);
    start({ tripId: 'existing-trip' });
    await jest.advanceTimersByTimeAsync(5000);
    expect(state.tripId).toBe('existing-trip');
    expect(state.error).toMatch(/timed out/i);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not surface caller cancellation as an error', async () => {
    fetchMock.mockImplementation(neverRespond);
    start();
    await jest.advanceTimersByTimeAsync(0);
    cleanup();
    await jest.advanceTimersByTimeAsync(0);
    expect(state.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not start generation from a create response received after cancellation', async () => {
    let resolveCreate!: (response: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    start();
    await jest.advanceTimersByTimeAsync(0);
    cleanup();
    const previousState = state;
    resolveCreate(createResponse());
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state).toBe(previousState);
  });

  it('ignores late polling completion after cancellation', async () => {
    let resolveBody!: (body: unknown) => void;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        new Promise((resolve) => {
          resolveBody = resolve;
        }),
    });
    start({ tripId: 'existing-trip' });
    await jest.advanceTimersByTimeAsync(0);
    cleanup();
    const previousState = state;
    resolveBody({ status: 'completed', progress: 100 });
    await jest.advanceTimersByTimeAsync(0);
    expect(state).toBe(previousState);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('handles a non-Error rejection without leaving loading stuck', async () => {
    fetchMock.mockRejectedValueOnce(null);
    start();
    await jest.advanceTimersByTimeAsync(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Connection failed');
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('streaming itinerary SSE parsing', () => {
  it('parses complete SSE events and keeps an incomplete trailing event buffered', () => {
    const { events, remaining } = parseSSEBuffer(
      'event: spec-block\ndata: {"blocks":[{"type":"TripSummary"}]}\n\n' +
        'event: progress\ndata: {"progress":25}'
    );

    expect(events).toEqual([
      {
        type: 'spec-block',
        data: '{"blocks":[{"type":"TripSummary"}]}',
      },
    ]);
    expect(remaining).toBe('event: progress\ndata: {"progress":25}');
  });

  it('handles malformed partial JSON without throwing so later chunks can continue', () => {
    expect(parseStreamingJson('{"blocks":')).toBeNull();
    expect(parseStreamingJson('{"progress":50}')).toEqual({ progress: 50 });
  });

  it('extracts readable backend error messages from JSON responses', () => {
    expect(extractApiErrorMessage('{"error":"Unauthorized"}', 'Failed')).toBe('Unauthorized');
    expect(extractApiErrorMessage('{"message":"Trip not found"}', 'Failed')).toBe('Trip not found');
  });

  it('falls back for empty or HTML error bodies', () => {
    expect(extractApiErrorMessage('', 'Failed to create trip')).toBe('Failed to create trip');
    expect(extractApiErrorMessage('<html><body>500</body></html>', 'Failed to stream')).toBe(
      'Failed to stream'
    );
  });

  it('uses reconnectable copy when the stream closes before completion', () => {
    expect(
      getIncompleteStreamMessage('Still generating in background. Reconnect for updates.')
    ).toBe('Faroway is still planning in the background. Reconnect for updates.');
    expect(getIncompleteStreamMessage('Searching for the best hotels...')).toBe(
      'The connection closed before your itinerary was ready. Reconnect to continue planning.'
    );
  });
});
