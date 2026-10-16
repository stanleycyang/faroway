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
  30000,
  { min: 500, max: 60000 },
);

export const AI_AGENT_TIMEOUT_MS = getEnvNumber(
  "ITINERARY_AI_AGENT_TIMEOUT_MS",
  60000,
  { min: 1000, max: 120000 },
);

export const AGGREGATOR_TIMEOUT_MS = getEnvNumber(
  "ITINERARY_AGGREGATOR_TIMEOUT_MS",
  30000,
  { min: 1000, max: 60000 },
);

export const VENDOR_TIMEOUT_MS = getEnvNumber(
  "ITINERARY_VENDOR_TIMEOUT_MS",
  2000,
  { min: 1000, max: 60000 },
);

/** Keep the vendor deadline active through finite body reads, not just headers. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = VENDOR_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timeout!: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      const error = new DOMException(
        `vendor request timed out after ${timeoutMs}ms`,
        "AbortError",
      );
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  // A caller inspecting only status must not keep a CLI process alive.
  timeout.unref?.();
  const bodyMethods = new Set<PropertyKey>([
    "json",
    "text",
    "arrayBuffer",
    "blob",
    "formData",
  ]);
  const wrap = (response: Response): Response =>
    new Proxy(response, {
      get(target, property) {
        // Response accessors/methods require the real Response as their receiver.
        const value = Reflect.get(target, property, target);
        if (property === "clone" && typeof value === "function")
          return () => wrap(target.clone());
        if (bodyMethods.has(property) && typeof value === "function") {
          return async (...args: unknown[]) => {
            try {
              return await Promise.race([
                Reflect.apply(value, target, args),
                deadline,
              ]);
            } finally {
              clearTimeout(timeout);
            }
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  try {
    const response = await Promise.race([
      fetch(input, { cache: "no-store", ...init, signal: controller.signal }),
      deadline,
    ]);
    if (response.body === null) clearTimeout(timeout);
    return wrap(response);
  } catch (error) {
    clearTimeout(timeout);
    throw error;
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
