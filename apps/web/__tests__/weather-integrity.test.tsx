import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { createWeatherCache } from "../lib/weather/cache";
import { getMetForecast } from "../lib/weather/met";
import { TripWeather } from "../components/trips/TripWeather";

const forecast = {
  updatedAt: "2026-10-14T12:00:00Z",
  deprecated: false,
  points: [
    {
      time: "2026-10-14T13:00:00Z",
      temperatureC: 18,
      windMetersPerSecond: 3,
      precipitationMm: null,
      precipitationHours: null,
    },
  ],
};
test.each([
  { updatedAt: forecast.updatedAt, points: "broken", deprecated: false },
  { ...forecast, points: [{ ...forecast.points[0], time: {} }] },
  { ...forecast, points: [{ ...forecast.points[0], temperatureC: null }] },
])("malformed persisted forecast is a cache miss: %j", async (payload) => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://weather-fixture.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-only");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              payload,
              expires_at: "2099-01-01T00:00:00Z",
              last_modified: "Wed, 14 Oct 2026 12:00:00 GMT",
              fetched_at: forecast.updatedAt,
            },
          ]),
        ),
    ),
  );
  try {
    expect(await createWeatherCache()!.read("met-v1:35:139")).toBeNull();
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
test.each([forecast, null])(
  "valid forecast or backoff record is retained: %j",
  async (payload) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://weather-fixture.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-only");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                payload,
                expires_at: "2099-01-01T00:00:00Z",
                last_modified: payload ? "Wed, 14 Oct 2026 12:00:00 GMT" : "",
                fetched_at: forecast.updatedAt,
              },
            ]),
          ),
      ),
    );
    try {
      expect(
        (await createWeatherCache()!.read("met-v1:35:139"))?.forecast,
      ).toEqual(payload);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  },
);
test("malformed available weather preserves the trip with inline recovery", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "available",
            forecast: {
              updatedAt: forecast.updatedAt,
              deprecated: false,
              points: "broken",
            },
          }),
        ),
    ),
  );
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripWeather destination="Paris" start="2026-10-14" end="2026-10-16" />,
      );
    });
    await act(async () => {
      renderer.root.findByType("button").props.onClick();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Weather is unavailable",
    );
    expect(renderer.root.findByType("button").props.disabled).toBe(false);
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});

test.each([true, false])(
  "corrupt cache refresh still requires the shared lock: %s",
  async (lockAllowed) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://weather-fixture.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-only");
    const dbFetch = vi.fn(async (input: string, init: RequestInit) => {
      if (input.includes("rpc/claim_met_weather_cache"))
        return new Response(JSON.stringify(lockAllowed));
      if (init.method === "PATCH") return new Response(null, { status: 204 });
      return new Response(
        JSON.stringify([
          {
            payload: { ...forecast, points: "broken" },
            expires_at: "2099-01-01T00:00:00Z",
            last_modified: "Wed, 14 Oct 2026 12:00:00 GMT",
            fetched_at: forecast.updatedAt,
          },
        ]),
      );
    });
    vi.stubGlobal("fetch", dbFetch);
    const permit = vi.fn(async () => true);
    const provider = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            properties: {
              meta: { updated_at: forecast.updatedAt },
              timeseries: [
                {
                  time: forecast.points[0].time,
                  data: {
                    instant: {
                      details: { air_temperature: 18, wind_speed: 3 },
                    },
                  },
                },
              ],
            },
          }),
          {
            headers: {
              expires: "Wed, 14 Oct 2026 14:00:00 GMT",
              "last-modified": "Wed, 14 Oct 2026 12:00:00 GMT",
            },
          },
        ),
    );
    try {
      const result = await getMetForecast(48.85, 2.33, {
        cache: createWeatherCache()!,
        permitRequest: permit,
        fetch: provider,
        now: () => Date.parse(forecast.updatedAt),
        enabled: true,
        userAgent: "Faroway test https://weather-fixture.test/contact",
      });
      if (lockAllowed) expect(result).toEqual(forecast);
      else expect(result).toBeNull();
      expect(permit).toHaveBeenCalledTimes(lockAllowed ? 1 : 0);
      expect(provider).toHaveBeenCalledTimes(lockAllowed ? 1 : 0);
      expect(dbFetch).toHaveBeenCalledTimes(lockAllowed ? 3 : 2);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  },
);

test("weather timeout releases the control and ignores a late forecast", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  let release!: (response: Response) => void;
  let signal!: AbortSignal;
  vi.stubGlobal(
    "fetch",
    vi.fn((_input, init) => {
      signal = init.signal;
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    }),
  );
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripWeather destination="Paris" start="2026-10-14" end="2026-10-16" />,
      );
    });
    await act(async () => {
      renderer.root.findByType("button").props.onClick();
    });
    expect(renderer.root.findByType("button").props.disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_001);
    });
    expect(signal.aborted).toBe(true);
    expect(renderer.root.findByType("button").props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Weather is taking too long",
    );
    await act(async () => {
      release(new Response(JSON.stringify({ status: "available", forecast })));
    });
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Weather is taking too long",
    );
    expect(renderer.root.findAllByType("table")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    await act(async () => renderer?.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
