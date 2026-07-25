export function getEnvNumber(
  name: string,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  const value = Number.isFinite(parsed) ? parsed : fallback;
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, value));
}

export const ORCHESTRATOR_TIMEOUT_MS = getEnvNumber(
  "ITINERARY_ORCHESTRATOR_TIMEOUT_MS",
  750,
  { min: 500, max: 10000 },
);

export const AI_AGENT_TIMEOUT_MS = getEnvNumber(
  "ITINERARY_AI_AGENT_TIMEOUT_MS",
  1500,
  { min: 1000, max: 15000 },
);

export const AGGREGATOR_TIMEOUT_MS = getEnvNumber(
  "ITINERARY_AGGREGATOR_TIMEOUT_MS",
  1000,
  { min: 1000, max: 15000 },
);

export const VENDOR_TIMEOUT_MS = getEnvNumber(
  "ITINERARY_VENDOR_TIMEOUT_MS",
  2000,
  { min: 1000, max: 60000 },
);

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = VENDOR_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      cache: "no-store",
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = VENDOR_TIMEOUT_MS,
  label = "operation",
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function withAbortTimeout<T>(
  operation: (abortSignal: AbortSignal) => Promise<T>,
  timeoutMs = VENDOR_TIMEOUT_MS,
  label = "operation",
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeoutPromise]);
  } catch (error) {
    if (timedOut || controller.signal.aborted) {
      throw new Error(`${label} timed out after ${timeoutMs}ms`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function isOperationTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error && / timed out after \d+ms$/.test(error.message)
  );
}
