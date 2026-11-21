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
  60000,
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
  const parent = init.signal;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (timeout !== undefined) clearTimeout(timeout);
    parent?.removeEventListener("abort", onParentAbort);
  };
  let rejectDeadline!: (reason: unknown) => void;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  const onParentAbort = () => {
    const reason =
      parent?.reason ??
      new DOMException("The operation was aborted.", "AbortError");
    cleanup();
    controller.abort(reason);
    rejectDeadline(reason);
  };
  if (parent?.aborted) {
    onParentAbort();
  } else {
    parent?.addEventListener("abort", onParentAbort, { once: true });
    timeout = setTimeout(() => {
      const error = new DOMException(
        `vendor request timed out after ${timeoutMs}ms`,
        "AbortError",
      );
      cleanup();
      controller.abort(error);
      rejectDeadline(error);
    }, timeoutMs);
    // A caller inspecting only status must not keep a CLI process alive.
    timeout.unref?.();
  }
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
              cleanup();
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
    if (response.body === null) cleanup();
    return wrap(response);
  } catch (error) {
    cleanup();
    throw error;
  }
}

export interface BoundedCall<T> {
  label: string;
  timeoutMs: number;
  run: (signal: AbortSignal) => Promise<T>;
}

/**
 * Run independent calls with a concurrency cap, a deadline per call, and one
 * parent cancellation signal. A call is invoked once. A timeout or abort does
 * not start it again.
 */
export async function allBounded<A, B, C>(
  tasks: readonly [BoundedCall<A>, BoundedCall<B>, BoundedCall<C>],
  options: { concurrency: number; signal?: AbortSignal },
): Promise<
  [PromiseSettledResult<A>, PromiseSettledResult<B>, PromiseSettledResult<C>]
>;
export async function allBounded<A, B>(
  tasks: readonly [BoundedCall<A>, BoundedCall<B>],
  options: { concurrency: number; signal?: AbortSignal },
): Promise<[PromiseSettledResult<A>, PromiseSettledResult<B>]>;
export async function allBounded<T>(
  tasks: readonly BoundedCall<T>[],
  options: { concurrency: number; signal?: AbortSignal },
): Promise<PromiseSettledResult<T>[]>;
export async function allBounded(
  tasks: readonly BoundedCall<unknown>[],
  options: { concurrency: number; signal?: AbortSignal },
): Promise<PromiseSettledResult<unknown>[]> {
  const concurrency = Math.max(1, Math.floor(options.concurrency));
  const results: PromiseSettledResult<unknown>[] = new Array(tasks.length);
  let cursor = 0;
  const runSlot = async () => {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      const task = tasks[index];
      if (options.signal?.aborted) {
        results[index] = {
          status: "rejected",
          reason: new DOMException("The operation was aborted.", "AbortError"),
        };
        continue;
      }
      const controller = new AbortController();
      let settled = false;
      try {
        const value = await new Promise<unknown>((resolve, reject) => {
          const finish = (settle: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            options.signal?.removeEventListener("abort", onParent);
            settle();
          };
          const timer = setTimeout(() => {
            controller.abort();
            finish(() =>
              reject(
                new Error(`${task.label} timed out after ${task.timeoutMs}ms`),
              ),
            );
          }, task.timeoutMs);
          timer.unref?.();
          const onParent = () => {
            controller.abort();
            finish(() =>
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              ),
            );
          };
          if (options.signal?.aborted) onParent();
          else
            options.signal?.addEventListener("abort", onParent, { once: true });
          task.run(controller.signal).then(
            (result) => finish(() => resolve(result)),
            (error) => finish(() => reject(error)),
          );
        });
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () =>
      runSlot(),
    ),
  );
  return results;
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
