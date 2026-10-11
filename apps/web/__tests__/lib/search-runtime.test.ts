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
