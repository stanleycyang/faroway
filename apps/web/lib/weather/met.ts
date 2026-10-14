import { ForecastSchema, type Forecast } from "./forecast";
import type { ForecastPoint } from "./forecast";
export type { Forecast, ForecastPoint } from "./forecast";

export interface CacheEntry {
  forecast: Forecast | null;
  expiresAt: number;
  lastModified: string;
  fetchedAt: number;
}
export interface WeatherCache {
  read(key: string): Promise<CacheEntry | null>;
  claim(key: string): Promise<boolean>;
  write(key: string, value: CacheEntry): Promise<void>;
}
interface Dependencies {
  cache: WeatherCache;
  permitRequest(): Promise<boolean>;
  fetch: typeof fetch;
  now(): number;
  enabled: boolean;
  userAgent: string;
}
export function validMetUserAgent(value: string): boolean {
  if (!/faroway/i.test(value) || /[\r\n]/.test(value)) return false;
  const match = value.match(/https:\/\/[^\s)]+/);
  if (!match) return false;
  try {
    const url = new URL(match[0]);
    return (
      !url.username &&
      !url.password &&
      url.hostname.includes(".") &&
      !/^(localhost|127\.|10\.|192\.168\.|example\.)/.test(url.hostname)
    );
  } catch {
    return false;
  }
}
function normalizeForecast(
  data: unknown,
  deprecated: boolean,
): Forecast | null {
  const properties = (
    data as {
      properties?: { meta?: { updated_at?: string }; timeseries?: unknown[] };
    }
  )?.properties;
  if (
    !properties?.meta?.updated_at ||
    !Number.isFinite(Date.parse(properties.meta.updated_at)) ||
    !Array.isArray(properties.timeseries)
  )
    return null;
  const points = properties.timeseries.flatMap((value) => {
    const row = value as {
      time?: string;
      data?: {
        instant?: {
          details?: { air_temperature?: number; wind_speed?: number };
        };
        next_1_hours?: { details?: { precipitation_amount?: number } };
        next_6_hours?: { details?: { precipitation_amount?: number } };
        next_12_hours?: { details?: { precipitation_amount?: number } };
      };
    };
    const details = row.data?.instant?.details;
    if (
      !row.time ||
      !Number.isFinite(Date.parse(row.time)) ||
      typeof details?.air_temperature !== "number" ||
      !Number.isFinite(details.air_temperature) ||
      typeof details.wind_speed !== "number" ||
      !Number.isFinite(details.wind_speed)
    )
      return [];
    const hours = row.data?.next_1_hours
      ? 1
      : row.data?.next_6_hours
        ? 6
        : row.data?.next_12_hours
          ? 12
          : null;
    const precipitation = hours
      ? row.data?.[`next_${hours}_hours`]?.details?.precipitation_amount
      : null;
    return [
      {
        time: row.time,
        temperatureC: details.air_temperature,
        windMetersPerSecond: details.wind_speed,
        precipitationMm:
          typeof precipitation === "number" && Number.isFinite(precipitation)
            ? precipitation
            : null,
        precipitationHours: hours,
      } as ForecastPoint,
    ];
  });
  return points.length
    ? { updatedAt: properties.meta.updated_at, points, deprecated }
    : null;
}

/** Shared-cache-first server adapter. Never called with traveler GPS or identity. */
export async function getMetForecast(
  lat: number,
  lng: number,
  deps: Dependencies,
): Promise<Forecast | null> {
  if (!deps.enabled || !validMetUserAgent(deps.userAgent)) return null;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  const latitude = lat.toFixed(4),
    longitude = lng.toFixed(4);
  const key = `met-v1:${latitude}:${longitude}`;
  try {
    const cached = await deps.cache.read(key);
    if (cached && cached.expiresAt > deps.now()) return cached.forecast;
    if (!(await deps.cache.claim(key))) return null;
    // One aggregate request per second across all destinations/instances.
    if (!(await deps.permitRequest())) return null;
    const res = await deps.fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latitude}&lon=${longitude}`,
      {
        cache: "no-store",
        headers: {
          "User-Agent": deps.userAgent,
          ...(cached?.forecast && cached.lastModified
            ? { "If-Modified-Since": cached.lastModified }
            : {}),
        },
        signal: AbortSignal.timeout(3000),
      },
    );
    const parsedExpiry = Date.parse(res.headers.get("expires") || "");
    // An absent/past Expires must not cause a retry loop. Back off at least 60s.
    const expiresAt = Math.max(
      Number.isFinite(parsedExpiry) ? parsedExpiry : 0,
      deps.now() + 60_000,
    );
    if (res.status === 304 && cached?.forecast) {
      await deps.cache.write(key, { ...cached, expiresAt });
      return cached.forecast;
    }
    if (res.status !== 200 && res.status !== 203) {
      const retry = res.headers.get("retry-after") || "";
      const retryTime = /^\d+$/.test(retry)
        ? deps.now() + Number(retry) * 1000
        : Date.parse(retry);
      await deps.cache.write(key, {
        forecast: null,
        expiresAt: Math.max(
          expiresAt,
          Number.isFinite(retryTime) ? retryTime : 0,
        ),
        lastModified: "",
        fetchedAt: deps.now(),
      });
      return null;
    }
    const normalized = normalizeForecast(await res.json(), res.status === 203);
    const verified = ForecastSchema.safeParse(normalized);
    if (!verified.success) return null;
    const forecast = verified.data;
    const lastModified = res.headers.get("last-modified") || "";
    if (!Number.isFinite(Date.parse(lastModified))) return null;
    await deps.cache.write(key, {
      forecast,
      expiresAt,
      lastModified,
      fetchedAt: deps.now(),
    });
    return forecast;
  } catch {
    return null;
  } // Fail closed if shared caching or provider access fails.
}

export function forecastForDates(
  forecast: Forecast,
  start: string,
  end: string,
  now: number,
): Forecast {
  return {
    ...forecast,
    points: forecast.points.filter(
      (p) =>
        p.time.slice(0, 10) >= start &&
        p.time.slice(0, 10) <= end &&
        Date.parse(p.time) >= now,
    ),
  };
}
