jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {} },
}));

jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'https://faroway.example',
  API_TIMEOUT: 5000,
}));

import React from 'react';
import {
  parsePlacesProxyPredictions,
  usePlacesAutocomplete,
} from '../../hooks/usePlacesAutocomplete';

const { renderToString } = require('react-dom/server') as {
  renderToString: (element: React.ReactElement) => string;
};

describe('autocomplete request lifecycle', () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();
  let hook: ReturnType<typeof usePlacesAutocomplete>;
  let state: unknown[];

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    state = [];
    // Capture state writes while React supplies the real refs/callbacks.
    jest.spyOn(React, 'useState').mockImplementation((initial?: unknown) => {
      const index = state.length;
      state.push(initial);
      return [
        initial,
        (value: unknown) => {
          state[index] = value;
        },
      ];
    });
    function Harness() {
      hook = usePlacesAutocomplete();
      return null;
    }
    renderToString(React.createElement(Harness));
  });
  afterEach(() => {
    hook.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  async function search(query: string) {
    hook.search(query);
    await jest.advanceTimersByTimeAsync(300);
  }
  function expectLocalTokyo() {
    expect(state[0]).toEqual(expect.arrayContaining([expect.objectContaining({ city: 'Tokyo' })]));
    expect(state[1]).toBe(false);
    expect(state[2]).toBeNull();
  }

  it('uses local results when the real fetch deadline aborts the request', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
          );
        })
    );
    await search('Tokyo');
    expect(state[1]).toBe(true);
    await jest.advanceTimersByTimeAsync(8000);
    expectLocalTokyo();
  });

  it.each(['network', 'http', 'malformed'])('uses local results on %s failure', async (failure) => {
    if (failure === 'network') fetchMock.mockRejectedValue(new Error('Offline'));
    else
      fetchMock.mockResolvedValue({
        ok: failure !== 'http',
        status: 503,
        json: async () => ({ invalid: true }),
      });
    await search('Tokyo');
    expectLocalTokyo();
  });

  it('uses local suggestions for the proxy provider-error contract', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ predictions: [], error: 'Places provider unavailable' }),
    });
    await search('Tokyo');
    expectLocalTokyo();
  });

  it('does not replace genuine zero results with local destinations', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ predictions: [] }) });
    await search('Tokyo');
    expect(state).toEqual([[], false, null]);
  });

  it.each(['resolve', 'reject'])(
    'ignores an older request that %ss after newer results',
    async (outcome) => {
      let resolveOld!: (value: unknown) => void;
      let rejectOld!: (error: Error) => void;
      fetchMock.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            resolveOld = resolve;
            rejectOld = reject;
          })
      );
      await search('Tokyo');
      const latest = { placeId: 'paris', mainText: 'Paris', secondaryText: 'France' };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ predictions: [latest] }) });
      await search('Paris');
      if (outcome === 'resolve')
        resolveOld({
          ok: true,
          json: async () => ({ predictions: [{ placeId: 'old', mainText: 'Old' }] }),
        });
      else rejectOld(new Error('Late network error'));
      await jest.advanceTimersByTimeAsync(0);
      expect(state[0]).toEqual([{ placeId: 'paris', city: 'Paris', secondary: 'France' }]);
      expect(state[1]).toBe(false);
    }
  );

  it('caller cancellation clears results without repopulating the fallback', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new Error('Caller cancelled')));
        })
    );
    await search('Tokyo');
    hook.clear();
    await jest.advanceTimersByTimeAsync(0);
    expect(state).toEqual([[], false, null]);
  });
});

describe('Places proxy response parsing', () => {
  it('maps the server proxy contract to mobile suggestions', () => {
    expect(
      parsePlacesProxyPredictions({
        predictions: [
          {
            placeId: 'tokyo-id',
            mainText: 'Tokyo',
            secondaryText: 'Japan',
          },
        ],
      })
    ).toEqual([{ placeId: 'tokyo-id', city: 'Tokyo', secondary: 'Japan' }]);
  });

  it('rejects malformed envelopes and drops malformed entries', () => {
    expect(parsePlacesProxyPredictions({ status: 'OK' })).toBeNull();
    expect(
      parsePlacesProxyPredictions({
        predictions: [null, { placeId: 'missing-name' }, { placeId: 'paris', mainText: 'Paris' }],
      })
    ).toEqual([{ placeId: 'paris', city: 'Paris', secondary: '' }]);
  });
});
