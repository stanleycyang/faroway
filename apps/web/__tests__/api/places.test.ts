import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
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
    mocks.checkRateLimit.mockReturnValue({ allowed: true });
    mocks.getClientIp.mockReturnValue("127.0.0.1");
    fetchMock.mockResolvedValue({
      json: async () => ({ status: "ZERO_RESULTS" }),
    });
  });

  it("rate limits autocomplete requests before calling Google", async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false });
    const { GET } = await importAutocompleteRoute();

    const res = await GET(makeRequest("/api/places/autocomplete?input=Tokyo"));

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "places-autocomplete:127.0.0.1",
      { maxRequests: 120, windowMs: 60_000 },
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
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it("rate limits place details requests before calling Google", async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false });
    const { GET } = await importDetailsRoute();

    const res = await GET(makeRequest("/api/places/details?placeId=abc123"));

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "places-details:127.0.0.1",
      { maxRequests: 120, windowMs: 60_000 },
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
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });
});
