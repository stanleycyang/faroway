import { API_TIMEOUT } from '../constants/api';

/**
 * Fetch with a hard deadline while preserving caller-driven cancellation.
 * React Native fetch otherwise has no default timeout and can hang indefinitely.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
