import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
}));

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

async function importAutocompleteRoute() {
  vi.resetModules();
  process.env.GOOGLE_PLACES_API_KEY = "places-key";
  return import("@/app/api/places/autocomplete/route");
}

async function importDetailsRoute() {
  vi.resetModules();
  process.env.GOOGLE_PLACES_API_KEY = "places-key";
  return import("@/app/api/places/details/route");
}

async function importStaticMapRoute() {
  vi.resetModules();
  process.env.GOOGLE_PLACES_API_KEY = "places-key";
  return import("@/app/api/places/static-map/route");
}

function makeRequest(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("Places API proxy routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true });
    mocks.getClientIp.mockReturnValue("127.0.0.1");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS" }),
    });
  });

  it("rate limits autocomplete requests before calling Google", async () => {
    mocks.checkRateLimitAsync.mockResolvedValueOnce({ allowed: false });
    const { GET } = await importAutocompleteRoute();

    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      "places-autocomplete:127.0.0.1",
      { maxRequests: 120, windowMs: 60_000, failClosed: true },
    );
  });

  it("rejects oversized autocomplete input without calling Google", async () => {
    const { GET } = await importAutocompleteRoute();
    const input = "a".repeat(121);

    const res = await GET(
      makeRequest(`/api/places/autocomplete?input=${input}`),
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkRateLimitAsync).not.toHaveBeenCalled();
  });

  it("bounds autocomplete provider calls with an abort signal", async () => {
    const { GET } = await importAutocompleteRoute();

    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    "OVER_QUERY_LIMIT",
    "REQUEST_DENIED",
    "INVALID_REQUEST",
    "UNKNOWN_ERROR",
    undefined,
  ])("does not disguise Google status %s as zero results", async (status) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status,
        predictions: [],
        error_message: "private provider diagnostic",
      }),
    });
    const { GET } = await importAutocompleteRoute();
    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      predictions: [],
      error: "Places provider unavailable",
    });
  });

  it("preserves genuine zero results as a successful empty response", async () => {
    const { GET } = await importAutocompleteRoute();
    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ predictions: [] });
  });

  it.each([
    null,
    { status: "OK" },
    { status: "OK", predictions: [null] },
    { status: "OK", predictions: [{ place_id: "tokyo" }] },
  ])("rejects malformed provider data %j", async (body) => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
    const { GET } = await importAutocompleteRoute();
    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));
    expect(res.status).toBe(502);
  });

  it("maps successful Google predictions without exposing provider-only fields", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        predictions: [
          {
            place_id: "tokyo",
            description: "Tokyo, Japan",
            structured_formatting: {
              main_text: "Tokyo",
              secondary_text: "Japan",
            },
          },
        ],
      }),
    });
    const { GET } = await importAutocompleteRoute();
    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      predictions: [
        { placeId: "tokyo", mainText: "Tokyo", secondaryText: "Japan" },
      ],
    });
  });

  it("rate limits place details requests before calling Google", async () => {
    mocks.checkRateLimitAsync.mockResolvedValueOnce({ allowed: false });
    const { GET } = await importDetailsRoute();

    const res = await GET(makeRequest("/api/places/details?placeId=abc123"));

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      "places-details:127.0.0.1",
      { maxRequests: 120, windowMs: 60_000, failClosed: true },
    );
  });

  it("rejects oversized place IDs without calling Google", async () => {
    const { GET } = await importDetailsRoute();
    const placeId = "p".repeat(257);

    const res = await GET(
      makeRequest(`/api/places/details?placeId=${placeId}`),
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkRateLimitAsync).not.toHaveBeenCalled();
  });

  it("bounds place details provider calls with an abort signal", async () => {
    const { GET } = await importDetailsRoute();

    const res = await GET(makeRequest("/api/places/details?placeId=abc123"));

    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("surfaces upstream place failures as a gateway error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ status: "UNKNOWN_ERROR" }),
    });
    const { GET } = await importDetailsRoute();

    const res = await GET(makeRequest("/api/places/details?placeId=abc123"));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to fetch details",
    });
  });

  it("proxies static maps without exposing the provider key to clients", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      }),
    );
    const { GET } = await importStaticMapRoute();

    const res = await GET(
      makeRequest("/api/places/static-map?destination=Tokyo&country=Japan"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("key=places-key");
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      "places-static-map:127.0.0.1",
      { maxRequests: 120, windowMs: 60_000, failClosed: true },
    );
  });
});
