import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ cache: vi.fn(), forecast: vi.fn() }));
vi.mock("@/lib/weather/cache", () => ({ createWeatherCache: mocks.cache }));
vi.mock("@/lib/weather/met", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/weather/met")>()),
  getMetForecast: mocks.forecast,
}));
import { GET } from "@/app/api/weather/route";
const request = (s: string) =>
  new NextRequest(`http://localhost/api/weather?${s}`);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MET_WEATHER_ENABLED", "false");
  vi.stubEnv(
    "MET_USER_AGENT",
    "Faroway test https://weather-fixture.test/contact",
  );
  vi.stubEnv("IP_HASH_SALT", "test");
});
describe("weather activation and input boundaries", () => {
  it("does not touch cache/provider while disabled", async () => {
    expect(await (await GET(request("destinationId=tokyo"))).json()).toEqual({
      status: "disabled",
    });
    expect(mocks.cache).not.toHaveBeenCalled();
    expect(mocks.forecast).not.toHaveBeenCalled();
  });
  it("requires identified contact even when enabled", async () => {
    vi.stubEnv("MET_WEATHER_ENABLED", "true");
    vi.stubEnv("MET_USER_AGENT", "Faroway");
    expect(await (await GET(request("destinationId=tokyo"))).json()).toEqual({
      status: "disabled",
    });
    expect(mocks.cache).not.toHaveBeenCalled();
  });
  it.each([
    "lat=35&lon=139",
    "destinationId=unknown",
    "destinationId=tokyo&start=2026-02-30&end=2026-03-01",
    "destinationId=tokyo&start=2099-01-01&end=2099-01-03",
  ])(
    "does not call MET for GPS, unsupported locations or unavailable dates: %s",
    async (query) => {
      vi.stubEnv("MET_WEATHER_ENABLED", "true");
      const data = await (await GET(request(query))).json();
      expect(["unavailable", "outside_forecast"]).toContain(data.status);
      expect(mocks.forecast).not.toHaveBeenCalled();
      expect(mocks.cache).not.toHaveBeenCalled();
    },
  );
});
