import { afterEach, expect, test, vi } from "vitest";
import { FarowayClient } from "@faroway/api-client";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test.each(["token", "headers", "body"])(
  "API client deadline settles a stalled %s operation",
  async (stage) => {
    vi.useFakeTimers();
    const forever = new Promise<never>(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        stage === "headers"
          ? forever
          : Promise.resolve({ ok: true, json: () => forever }),
      ),
    );
    const client = new FarowayClient({
      baseUrl: "https://example.invalid",
      timeout: 1000,
      getAuthToken: () => (stage === "token" ? forever : null),
    });
    let result: unknown;
    const request = client.getTrips().then((value) => {
      result = value;
    });
    await vi.advanceTimersByTimeAsync(1001);
    expect(result).toEqual({ error: "Request timed out", code: "TIMEOUT" });
    await request;
  },
);

test("late token lookup cannot dispatch after the request timed out", async () => {
  vi.useFakeTimers();
  let release!: (value: string) => void;
  const token = new Promise<string>((resolve) => {
    release = resolve;
  });
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const client = new FarowayClient({
    baseUrl: "https://example.invalid",
    timeout: 1000,
    getAuthToken: () => token,
  });
  const request = client.getTrips();
  await vi.advanceTimersByTimeAsync(1001);
  expect(await request).toMatchObject({ code: "TIMEOUT" });
  release("fixture-token");
  await Promise.resolve();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a successful read returns data and releases its deadline", async () => {
  vi.useFakeTimers();
  const data = { trips: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(data))),
  );
  const client = new FarowayClient({
    baseUrl: "https://example.invalid",
    timeout: 1000,
    getAuthToken: () => null,
  });
  expect(await client.getTrips()).toEqual({ data });
  expect(vi.getTimerCount()).toBe(0);
});
