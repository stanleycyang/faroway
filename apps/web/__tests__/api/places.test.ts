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
      json: async () => ({ suggestions: [] }),
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

  it("rate limits place details requests before calling Google", async () => {
    mocks.checkRateLimitAsync.mockResolvedValueOnce({ allowed: false });
    const { GET } = await importDetailsRoute();

    const res = await GET(makeRequest("/api/places/details?placeId=abc123"));

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      "places-venues:127.0.0.1",
      { maxRequests: 30, windowMs: 60_000, failClosed: true },
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
  it("uses Autocomplete New with a server key, city filter and minimal mask", async () => {
    const { GET } = await importAutocompleteRoute();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: "tokyo",
                text: { text: "Tokyo, Japan" },
                structuredFormat: {
                  mainText: { text: "Tokyo" },
                  secondaryText: { text: "Japan" },
                },
              },
            },
            { queryPrediction: { text: { text: "not a place" } } },
          ],
        }),
      ),
    );
    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));
    expect(await res.json()).toEqual({
      predictions: [
        { placeId: "tokyo", mainText: "Tokyo", secondaryText: "Japan" },
      ],
    });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(init.headers["X-Goog-Api-Key"]).toBe("places-key");
    expect(init.headers["X-Goog-FieldMask"]).not.toContain("*");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      input: "Tokyo",
      includedPrimaryTypes: ["(cities)"],
    });
  });

  it("returns transient Details New fields while omitting coordinates and reviews", async () => {
    const { GET } = await importDetailsRoute();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "abc123",
          displayName: { text: "Tokyo" },
          location: { latitude: 35.6, longitude: 139.7 },
          attributions: [
            { provider: "Example", providerUri: "https://example.com" },
          ],
          rating: 4.8,
        }),
      ),
    );
    const res = await GET(makeRequest("/api/places/details?placeId=abc123"));
    expect(await res.json()).toEqual({
      place: {
        placeId: "abc123",
        name: "Tokyo",
        attributions: [
          { provider: "Example", providerUri: "https://example.com/" },
        ],
      },
    });
    expect(res.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://places.googleapis.com/v1/places/abc123",
    );
    expect(fetchMock.mock.calls[0][1].headers["X-Goog-FieldMask"]).toBe(
      "id,displayName,formattedAddress,googleMapsUri,attributions,businessStatus",
    );
  });

  it.each(["autocomplete?input=Tokyo", "details?placeId=tokyo"])(
    "fails gracefully without a key: %s",
    async (path) => {
      const { GET } = path.startsWith("autocomplete")
        ? await importAutocompleteRoute()
        : await importDetailsRoute();
      delete process.env.GOOGLE_PLACES_API_KEY;
      const res = await GET(makeRequest(`/api/places/${path}`));
      expect(res.status).toBe(501);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["autocomplete?input=Tokyo", "details?placeId=tokyo"])(
    "does not leak upstream error details: %s",
    async (path) => {
      const { GET } = path.startsWith("autocomplete")
        ? await importAutocompleteRoute()
        : await importDetailsRoute();
      fetchMock.mockResolvedValueOnce(
        new Response("sensitive provider error", { status: 403 }),
      );
      const res = await GET(makeRequest(`/api/places/${path}`));
      expect(res.status).toBe(502);
      expect(await res.text()).not.toContain("sensitive");
    },
  );

  it("handles aborted requests without exposing errors", async () => {
    const { GET } = await importAutocompleteRoute();
    fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ predictions: [] });
  });

  it("rejects malformed details without a display name", async () => {
    const { GET } = await importDetailsRoute();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ location: { latitude: 999, longitude: "bad" } }),
      ),
    );
    const res = await GET(makeRequest("/api/places/details?placeId=tokyo"));
    expect(res.status).toBe(404);
  });
});
