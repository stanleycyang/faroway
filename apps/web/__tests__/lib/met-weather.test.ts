import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  forecastForDates,
  getMetForecast,
  type CacheEntry,
  type WeatherCache,
} from "@/lib/weather/met";
const now = Date.parse("2026-10-03T12:00:00Z");
const weather = {
  properties: {
    meta: { updated_at: "2026-10-03T11:00:00Z" },
    timeseries: [
      {
        time: "2026-10-03T13:00:00Z",
        data: {
          instant: { details: { air_temperature: 18, wind_speed: 3 } },
          next_1_hours: { details: { precipitation_amount: 0.4 } },
        },
      },
      {
        time: "2026-10-04T13:00:00Z",
        data: { instant: { details: { air_temperature: 19, wind_speed: 4 } } },
      },
    ],
  },
};
let saved: CacheEntry | null;
const cache: WeatherCache = {
  read: vi.fn(async () => saved),
  claim: vi.fn(async () => true),
  write: vi.fn(async (_, entry) => {
    saved = entry;
  }),
};
const fetchMock = vi.fn();
const permitRequest = vi.fn();
const deps = () => ({
  cache,
  fetch: fetchMock,
  permitRequest,
  now: () => now,
  enabled: true,
  userAgent: "Faroway test https://weather-fixture.test/contact",
});
function response(status = 200, headers: Record<string, string> = {}) {
  return new Response(status === 304 ? null : JSON.stringify(weather), {
    status,
    headers: {
      expires: new Date(now + 3600000).toUTCString(),
      "last-modified": new Date(now - 3600000).toUTCString(),
      ...headers,
    },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  saved = null;
  vi.mocked(cache.claim).mockResolvedValue(true);
  permitRequest.mockResolvedValue(true);
  fetchMock.mockResolvedValue(response());
});
describe("MET shared-cache adapter", () => {
  it.each([
    { enabled: false },
    { userAgent: "" },
    { userAgent: "Faroway https://example.com" },
  ])("makes no calls without approved configuration %j", async (config) => {
    expect(await getMetForecast(35, 139, { ...deps(), ...config })).toBeNull();
    expect(cache.read).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rounds destination coordinates, sends identification and stores expiry/Last-Modified", async () => {
    const result = await getMetForecast(35.123456, 139.654321, deps());
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=35.1235&lon=139.6543",
    );
    expect(fetchMock.mock.calls[0][1].headers["User-Agent"]).toContain(
      "Faroway",
    );
    expect(saved?.expiresAt).toBe(now + 3600000);
    expect(result?.points[0]).toMatchObject({
      temperatureC: 18,
      windMetersPerSecond: 3,
      precipitationMm: 0.4,
      precipitationHours: 1,
    });
    expect(result?.points[1].precipitationMm).toBeNull();
  });
  it("serves shared cached data until expiry without another request or lock", async () => {
    await getMetForecast(35, 139, deps());
    vi.clearAllMocks();
    await getMetForecast(35, 139, deps());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.claim).not.toHaveBeenCalled();
  });
  it("revalidates expired content conditionally and honors 304 expiry", async () => {
    await getMetForecast(35, 139, deps());
    saved!.expiresAt = now - 1;
    fetchMock.mockResolvedValue(response(304));
    expect(await getMetForecast(35, 139, deps())).toEqual(saved!.forecast);
    expect(fetchMock.mock.calls[1][1].headers["If-Modified-Since"]).toBe(
      new Date(now - 3600000).toUTCString(),
    );
    expect(saved!.expiresAt).toBe(now + 3600000);
  });
  it("honors Retry-After across subsequent requests", async () => {
    fetchMock.mockResolvedValue(
      response(429, {
        expires: new Date(now).toUTCString(),
        "retry-after": "120",
      }),
    );
    expect(await getMetForecast(35, 139, deps())).toBeNull();
    expect(saved!.expiresAt).toBe(now + 120000);
    expect(await getMetForecast(35, 139, deps())).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("fails closed on cache failure, refresh lock contention, or aggregate throttle", async () => {
    vi.mocked(cache.read).mockRejectedValueOnce(new Error("offline"));
    expect(await getMetForecast(35, 139, deps())).toBeNull();
    vi.mocked(cache.claim).mockResolvedValueOnce(false);
    expect(await getMetForecast(35, 139, deps())).toBeNull();
    permitRequest.mockResolvedValueOnce(false);
    expect(await getMetForecast(35, 139, deps())).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("marks deprecated responses and only returns actual future trip forecast points", async () => {
    fetchMock.mockResolvedValue(response(203));
    const result = await getMetForecast(35, 139, deps());
    expect(result?.deprecated).toBe(true);
    expect(
      forecastForDates(result!, "2026-10-04", "2026-10-05", now).points,
    ).toHaveLength(1);
    expect(
      forecastForDates(result!, "2027-01-01", "2027-01-02", now).points,
    ).toEqual([]);
  });
  it("does not present malformed weather or missing conditional metadata", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("{}", {
        headers: { "last-modified": new Date(now).toUTCString() },
      }),
    );
    expect(await getMetForecast(35, 139, deps())).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(weather)));
    expect(await getMetForecast(35, 139, deps())).toBeNull();
    expect(cache.write).not.toHaveBeenCalled();
  });
});
