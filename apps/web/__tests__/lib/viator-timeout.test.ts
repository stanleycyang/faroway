import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("VIATOR_API_KEY", "test-only-key");
  vi.stubEnv("VIATOR_PARTNER_ID", "P123");
  vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
  vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "test");
  vi.stubEnv("ITINERARY_VIATOR_TIMEOUT_MS", "");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("retains supplier results that arrive after the generic two-second deadline", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return Response.json({
        products: [{ productCode: "123P1", title: "Tokyo food tour" }],
      });
    }),
  );
  const { searchViatorProducts } = await import("@/lib/affiliates/viator");
  const pending = searchViatorProducts({ destination: "Tokyo" });
  await vi.advanceTimersByTimeAsync(3000);
  expect(await pending).toEqual([
    expect.objectContaining({ productCode: "123P1" }),
  ]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("still aborts a stalled supplier without retrying or inventing inventory", async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    }),
  );
  const { searchViatorProducts } = await import("@/lib/affiliates/viator");
  const pending = searchViatorProducts({ destination: "Tokyo" });
  await vi.advanceTimersByTimeAsync(10000);
  expect(await pending).toEqual([]);
  expect(signal?.aborted).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps the deadline active when supplier headers arrive but the body stalls", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new ReadableStream({ start() {} }))),
  );
  const { searchViatorProducts } = await import("@/lib/affiliates/viator");
  const pending = searchViatorProducts({ destination: "Tokyo" });
  await vi.advanceTimersByTimeAsync(10000);
  expect(await pending).toEqual([]);
});
