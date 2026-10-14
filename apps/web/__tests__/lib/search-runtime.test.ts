import { beforeEach, describe, expect, it, vi } from "vitest";

describe("itinerary runtime budgets", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("allows structured AI responses within a bounded two-minute envelope", async () => {
    const runtime = await import("@/lib/search/runtime");

    expect(runtime.ORCHESTRATOR_TIMEOUT_MS).toBe(30000);
    expect(runtime.AI_AGENT_TIMEOUT_MS).toBe(60000);
    expect(runtime.AGGREGATOR_TIMEOUT_MS).toBe(30000);
    expect(runtime.VENDOR_TIMEOUT_MS).toBe(2000);

    // AI/provider agents run concurrently between orchestration and aggregation.
    expect(
      runtime.ORCHESTRATOR_TIMEOUT_MS +
        Math.max(runtime.AI_AGENT_TIMEOUT_MS, runtime.VENDOR_TIMEOUT_MS) +
        runtime.AGGREGATOR_TIMEOUT_MS,
    ).toBeLessThanOrEqual(120000);
  });

  it("allows explicit vendor-check overrides without weakening app defaults", async () => {
    vi.stubEnv("ITINERARY_VENDOR_TIMEOUT_MS", "30000");

    const runtime = await import("@/lib/search/runtime");

    expect(runtime.VENDOR_TIMEOUT_MS).toBe(30000);
  });

  it("actively aborts operations when the timeout budget elapses", async () => {
    const runtime = await import("@/lib/search/runtime");
    const observedSignals: AbortSignal[] = [];

    await expect(
      runtime.withAbortTimeout(
        (signal) => {
          observedSignals.push(signal);
          return new Promise<never>((_, reject) => {
            signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          });
        },
        5,
        "probe",
      ),
    ).rejects.toThrow("probe timed out after 5ms");

    expect(observedSignals[0]?.aborted).toBe(true);
  });

  it("rejects at the deadline even if the operation ignores abort", async () => {
    const runtime = await import("@/lib/search/runtime");

    await expect(
      runtime.withAbortTimeout(
        () => new Promise<never>(() => undefined),
        5,
        "stubborn probe",
      ),
    ).rejects.toThrow("stubborn probe timed out after 5ms");
  });

  it("identifies operation timeout errors for quiet fallback logging", async () => {
    const runtime = await import("@/lib/search/runtime");

    expect(
      runtime.isOperationTimeoutError(
        new Error("aggregator AI timed out after 1000ms"),
      ),
    ).toBe(true);
    expect(runtime.isOperationTimeoutError(new Error("vendor down"))).toBe(
      false,
    );
  });
});

describe("vendor response deadline", () => {
  it("bounds a stalled JSON body even when fetch ignores abort", async () => {
    vi.useFakeTimers();
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        bodyController = controller;
      },
    });
    let signal!: AbortSignal;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        signal = init.signal;
        return new Response(body);
      }),
    );
    try {
      const { fetchWithTimeout } = await import("@/lib/search/runtime");
      const response = await fetchWithTimeout(
        "https://example.invalid/vendor",
        {},
        25,
      );
      let settled = false;
      const result = response.json().then(
        () => {
          settled = true;
          return null;
        },
        (error) => {
          settled = true;
          return error;
        },
      );
      await vi.advanceTimersByTimeAsync(26);
      expect(settled).toBe(true);
      expect(signal.aborted).toBe(true);
      expect((await result).message).toContain("timed out");
    } finally {
      bodyController.error(new Error("Fixture cleanup"));
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it("bounds a fetch that never returns headers even when it ignores abort", async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input, init) => {
        signal = init.signal;
        return new Promise<Response>(() => undefined);
      }),
    );
    try {
      const { fetchWithTimeout } = await import("@/lib/search/runtime");
      let settled = false;
      const result = fetchWithTimeout(
        "https://example.invalid/vendor",
        {},
        25,
      ).then(
        () => {
          settled = true;
          return null;
        },
        (error) => {
          settled = true;
          return error;
        },
      );
      await vi.advanceTimersByTimeAsync(26);
      expect(settled).toBe(true);
      expect(signal.aborted).toBe(true);
      expect((await result).message).toContain("timed out");
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it("preserves response metadata and body methods and clears a successful deadline", async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    const original = new Response(JSON.stringify({ ready: true }), {
      status: 201,
      headers: { "X-Vendor": "fixture" },
    });
    Object.defineProperty(original, "url", {
      value: "https://example.invalid/vendor",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        signal = init.signal;
        return original;
      }),
    );
    try {
      const { fetchWithTimeout } = await import("@/lib/search/runtime");
      const response = await fetchWithTimeout(
        "https://example.invalid/vendor",
        {},
        25,
      );
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(201);
      expect(response.ok).toBe(true);
      expect(response.headers.get("X-Vendor")).toBe("fixture");
      expect(response.url).toBe(original.url);
      const clone = response.clone();
      expect(await response.json()).toEqual({ ready: true });
      expect(await clone.text()).toBe('{"ready":true}');
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(100);
      expect(signal.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
