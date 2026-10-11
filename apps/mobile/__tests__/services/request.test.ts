jest.mock('../../constants/api', () => ({ API_TIMEOUT: 5000 }));

import { requestWithTimeout, RequestTimeoutError } from '../../services/request';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('complete request deadline', () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();
  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('shares one deadline across headers and body, even if abort is ignored', async () => {
    const headers = deferred<Response>();
    const body = deferred<unknown>();
    fetchMock.mockReturnValueOnce(headers.promise);
    const caller = new AbortController();
    const result = requestWithTimeout(
      '/test',
      { signal: caller.signal },
      (response) => response.json(),
      100
    );
    const rejected = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);
    await jest.advanceTimersByTimeAsync(60);
    headers.resolve({ json: () => body.promise } as Response);
    await jest.advanceTimersByTimeAsync(39);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await rejected;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(caller.signal.aborted).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    body.resolve({ late: true });
    await jest.advanceTimersByTimeAsync(0);
  });

  it.each(['resolve', 'reject'])(
    'ignores headers that %s after timeout without invoking the reader',
    async (outcome) => {
      const headers = deferred<Response>();
      const reader = jest.fn();
      fetchMock.mockReturnValueOnce(headers.promise);
      const result = requestWithTimeout('/test', {}, reader, 100);
      const rejected = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);
      await jest.advanceTimersByTimeAsync(100);
      await rejected;
      if (outcome === 'resolve') headers.resolve(new Response('{}'));
      else headers.reject(new Error('Late network failure'));
      await jest.advanceTimersByTimeAsync(0);
      expect(reader).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it.each(['resolve', 'reject'])(
    'ignores a body that %s after caller cancellation',
    async (outcome) => {
      const body = deferred<unknown>();
      const caller = new AbortController();
      const remove = jest.spyOn(caller.signal, 'removeEventListener');
      fetchMock.mockResolvedValueOnce({ json: () => body.promise });
      const result = requestWithTimeout('/test', { signal: caller.signal }, (response) =>
        response.json()
      );
      const rejected = expect(result).rejects.toMatchObject({
        name: 'AbortError',
        message: 'Request cancelled',
      });
      await jest.advanceTimersByTimeAsync(0);
      caller.abort();
      await rejected;
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(jest.getTimerCount()).toBe(0);
      if (outcome === 'resolve') body.resolve({ late: true });
      else body.reject(new Error('Late parse failure'));
      await jest.advanceTimersByTimeAsync(0);
    }
  );

  it('does not dispatch an already-cancelled request', async () => {
    const caller = new AbortController();
    caller.abort();
    await expect(
      requestWithTimeout('/test', { signal: caller.signal }, (response) => response.json())
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves the signal on a Request input unless init overrides it', async () => {
    const caller = new AbortController();
    const input = new Request('https://fixture.test/', { signal: caller.signal });
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const result = requestWithTimeout(input, {}, (response) => response.json());
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    caller.abort();
    await rejected;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    await expect(
      requestWithTimeout(input, { signal: null }, (response) => response.json())
    ).resolves.toEqual({});
  });

  it('cleans up after success and no longer forwards caller cancellation', async () => {
    const caller = new AbortController();
    const remove = jest.spyOn(caller.signal, 'removeEventListener');
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}'));
    await expect(
      requestWithTimeout('/test', { signal: caller.signal }, (response) => response.json())
    ).resolves.toEqual({ ok: true });
    expect(jest.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    caller.abort();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
  });

  it.each(['network', 'reader'])(
    'preserves %s errors and clears deadline resources',
    async (phase) => {
      const error = new Error('Original failure');
      if (phase === 'network') fetchMock.mockRejectedValueOnce(error);
      else fetchMock.mockResolvedValueOnce({ json: () => Promise.reject(error) });
      await expect(requestWithTimeout('/test', {}, (response) => response.json())).rejects.toBe(
        error
      );
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it('does not mistake deadline-triggered body AbortError for caller cancellation', async () => {
    fetchMock.mockImplementationOnce((_url, init: RequestInit) =>
      Promise.resolve({
        json: () =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener(
              'abort',
              () => reject(Object.assign(new Error('Body aborted'), { name: 'AbortError' })),
              { once: true }
            );
          }),
      })
    );
    const result = requestWithTimeout('/test', {}, (response) => response.json(), 100);
    const rejected = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);
    await jest.advanceTimersByTimeAsync(100);
    await rejected;
  });

  it('rejects expired results even before a delayed timer callback runs', async () => {
    const body = deferred<unknown>();
    fetchMock.mockResolvedValueOnce({ json: () => body.promise });
    const result = requestWithTimeout('/test', {}, (response) => response.json(), 100);
    const rejected = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);
    await jest.advanceTimersByTimeAsync(0);
    jest.setSystemTime(Date.now() + 101);
    body.resolve({ late: true });
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('accepts a no-body HTTP acknowledgement without attempting JSON parsing', async () => {
    const json = jest.fn(() => new Promise(() => {}));
    fetchMock.mockResolvedValueOnce({ status: 204, json });
    await expect(
      requestWithTimeout('/test', { method: 'DELETE' }, (response) => response.status)
    ).resolves.toBe(204);
    expect(json).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([0, -1, NaN, Infinity, 2_147_483_648])(
    'rejects invalid timeout %s before dispatch',
    async (timeout) => {
      await expect(
        requestWithTimeout('/test', {}, (response) => response.json(), timeout)
      ).rejects.toBeInstanceOf(RangeError);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    }
  );
});
