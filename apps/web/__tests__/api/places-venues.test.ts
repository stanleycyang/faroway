import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const limit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: limit,
  getClientIp: () => "test",
}));
import { GET } from "@/app/api/places/venues/route";
const request = (query: string) =>
  new NextRequest(`http://localhost/api/places/venues?${query}`);
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  limit.mockClear();
  vi.stubEnv("GOOGLE_PLACES_LIVE_ENABLED", "true");
  vi.stubEnv("GOOGLE_PLACES_ACCESSIBILITY_ENABLED", "false");
  limit.mockResolvedValue({ allowed: true });
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
});
describe("transient venue lookup", () => {
  it.each([undefined, "false", "1"])(
    "does not call providers or rate-limit storage when live lookup is off (%s)",
    async (enabled) => {
      vi.stubEnv("GOOGLE_PLACES_LIVE_ENABLED", enabled);
      const res = await GET(request("query=Museum"));
      expect(res.status).toBe(501);
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(limit).not.toHaveBeenCalled();
    },
  );
  it("uses capped Text Search New, no-store and a minimal Pro mask", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "p1",
              displayName: { text: "Museum" },
              formattedAddress: "Address",
              photos: ["secret"],
              reviews: ["review"],
              rating: 4.9,
              googleMapsUri: "javascript:alert(1)",
              attributions: [
                { provider: "Partner", providerUri: "javascript:alert(1)" },
              ],
            },
          ],
        }),
      ),
    );
    const res = await GET(request("query=Museum"));
    expect(await res.json()).toEqual({
      places: [
        {
          placeId: "p1",
          name: "Museum",
          address: "Address",
          attributions: [{ provider: "Partner" }],
        },
      ],
    });
    expect(res.headers.get("cache-control")).toContain("no-store");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init.cache).toBe("no-store");
    expect(init.headers["X-Goog-FieldMask"]).toBe(
      "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.attributions",
    );
    expect(JSON.parse(init.body)).toEqual({ textQuery: "Museum", pageSize: 3 });
  });
  it("makes no provider calls without credentials or when rate limited", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect((await GET(request("query=Museum"))).status).toBe(501);
    limit.mockResolvedValue({ allowed: false });
    expect((await GET(request("query=Museum"))).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    "query=x",
    "query=x&placeId=id",
    "placeId=../../secret",
    "query=" + "a".repeat(121),
  ])("rejects invalid inputs %s", async (query) => {
    expect((await GET(request(query))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

it.each(["false", "true"])(
  "requests accessibility only with explicit activation (%s)",
  async (enabled) => {
    vi.stubEnv("GOOGLE_PLACES_ACCESSIBILITY_ENABLED", enabled);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "p1",
          displayName: { text: "Museum" },
          accessibilityOptions: {
            wheelchairAccessibleEntrance: true,
            wheelchairAccessibleRestroom: false,
            wheelchairAccessibleSeating: "unknown",
          },
        }),
      ),
    );
    const response = await GET(request("placeId=p1"));
    expect(response.status).toBe(200);
    expect(
      fetchMock.mock.calls[0][1].headers["X-Goog-FieldMask"].includes(
        "accessibilityOptions",
      ),
    ).toBe(enabled === "true");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const payload = await response.json();
    expect(payload.place.accessibility).toEqual({
      wheelchairAccessibleEntrance: true,
      wheelchairAccessibleRestroom: false,
    });
  },
);
