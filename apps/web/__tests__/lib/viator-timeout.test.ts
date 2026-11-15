import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("VIATOR_API_KEY", "test-only-key");
  vi.stubEnv("VIATOR_SANDBOX", "true");
  vi.stubEnv("VIATOR_PARTNER_ID", "P123");
  vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
  vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "test");
  vi.stubEnv("ITINERARY_VIATOR_TIMEOUT_MS", "");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

it("does not expose provider error bodies through the independent probe", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("private-provider-request-details", { status: 403 }),
    ),
  );
  const { probeViatorSandbox } = await import("@/lib/affiliates/viator");
  expect(await probeViatorSandbox()).toMatchObject({
    status: "failed",
    reason: "Viator search HTTP 403",
  });
  expect(console.error).not.toHaveBeenCalled();
});

it("will not use a production key mode for the QA probe", async () => {
  vi.stubEnv("VIATOR_SANDBOX", "false");
  vi.stubGlobal("fetch", vi.fn());
  const { probeViatorSandbox } = await import("@/lib/affiliates/viator");
  expect(await probeViatorSandbox()).toEqual({ status: "unconfigured" });
  expect(fetch).not.toHaveBeenCalled();
});

it("checks returned attribution against the configured partner without returning the ID", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        products: [
          {
            productCode: "1P1",
            title: "Tour",
            images: [{ url: "https://images.example.test/a.jpg" }],
            productUrl:
              "https://www.viator.com/tours/Tokyo/Tour/d334-1P1?pid=P123&mcid=42383&medium=api",
          },
          {
            productCode: "2P1",
            title: "Other",
            productUrl:
              "https://www.viator.com/tours/Tokyo/Other/d334-2P1?pid=P999&mcid=42383&medium=api",
          },
        ],
      }),
    ),
  );
  const { probeViatorSandbox } = await import("@/lib/affiliates/viator");
  const result = await probeViatorSandbox();
  expect(result).toMatchObject({
    status: "available",
    products: 2,
    withPhotos: 1,
    attributedProducts: 1,
  });
  expect(JSON.stringify(result)).not.toContain("P123");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("recovers a dated timeout with one small catalog search and retains uncertainty", async () => {
  const calls: Array<{
    filtering: Record<string, unknown>;
    pagination: { count: number };
  }> = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, init) => {
      calls.push(JSON.parse(init.body));
      return calls.length === 1
        ? new Promise(() => {})
        : Promise.resolve(
            Response.json({
              products: [{ productCode: "123P1", title: "Real tour" }],
            }),
          );
    }),
  );
  const { searchViatorProducts } = await import("@/lib/affiliates/viator");
  const pending = searchViatorProducts({
    destination: "Tokyo",
    startDate: "2026-12-07",
    endDate: "2026-12-09",
    limit: 15,
  });
  await vi.advanceTimersByTimeAsync(10000);
  expect(await pending).toEqual([
    expect.objectContaining({ productCode: "123P1", catalogOnly: true }),
  ]);
  expect(calls).toHaveLength(2);
  expect(calls[1].filtering).toEqual({ destination: "334" });
  expect(calls[1].pagination.count).toBe(3);
});

it.each([200, 401, 429, 503])(
  "does not replace an empty or failed HTTP %s dated search with catalog results",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ products: [] }, { status })),
    );
    const { searchViatorProducts } = await import("@/lib/affiliates/viator");
    expect(
      await searchViatorProducts({
        destination: "Tokyo",
        startDate: "2026-12-07",
      }),
    ).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it("bounds the catalog fallback too, with at most two supplier requests", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const { searchViatorProducts } = await import("@/lib/affiliates/viator");
  const pending = searchViatorProducts({
    destination: "Tokyo",
    startDate: "2026-12-07",
  });
  await vi.advanceTimersByTimeAsync(15000);
  expect(await pending).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(2);
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
