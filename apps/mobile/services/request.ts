import { API_TIMEOUT } from '../constants/api';

export class RequestTimeoutError extends Error {
  constructor() {
    super('The request timed out. Check your connection and try again.');
    this.name = 'TimeoutError';
  }
}

function cancellationError(): Error {
  const error = new Error('Request cancelled');
  error.name = 'AbortError';
  return error;
}

/**
 * One deadline for headers AND response reading. The reader should only parse
 * data; perform state/storage updates after this promise succeeds. Never return
 * a live response body/stream for later consumption. SSE uses its own lifecycle.
 *
 * Racing the operation also settles shims that ignore abort. Checks before and
 * after the reader fence late responses; timers/listeners are always removed.
 */
export async function requestWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  readResponse: (response: Response) => T | Promise<T>,
  timeoutMs = API_TIMEOUT ?? 25_000
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new RangeError('Request timeout must be a positive, finite timer duration');
  }
  const controller = new AbortController();
  const callerSignal =
    init.signal !== undefined
      ? init.signal
      : typeof Request !== 'undefined' && input instanceof Request
        ? input.signal
        : undefined;
  if (callerSignal?.aborted) throw cancellationError();

  let stoppedError: Error | undefined;
  let rejectStopped!: (error: Error) => void;
  const stopped = new Promise<never>((_resolve, reject) => {
    rejectStopped = reject;
  });
  const stop = (error: Error) => {
    if (stoppedError) return;
    stoppedError = error;
    // Reject first so transport AbortError cannot hide a deadline failure.
    rejectStopped(error);
    controller.abort();
  };
  const abortFromCaller = () => stop(cancellationError());
  const deadline = Date.now() + timeoutMs;
  const checkActive = () => {
    if (callerSignal?.aborted) abortFromCaller();
    if (Date.now() >= deadline) stop(new RequestTimeoutError());
    if (stoppedError) throw stoppedError;
  };

  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => stop(new RequestTimeoutError()), timeoutMs);

  try {
    const operation = (async () => {
      checkActive();
      const response = await fetch(input, { ...init, signal: controller.signal });
      checkActive();
      const result = await readResponse(response);
      checkActive();
      return result;
    })();
    return await Promise.race([operation, stopped]);
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
