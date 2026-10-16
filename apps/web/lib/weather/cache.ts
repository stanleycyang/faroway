import "server-only";
import { z } from "zod";
import { ForecastSchema } from "./forecast";

const storedInstant = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)));
const CacheRow = z.object({
  payload: ForecastSchema.nullable(),
  expires_at: storedInstant.nullable(),
  last_modified: z.string().nullable(),
  fetched_at: storedInstant.nullable(),
});
import type { CacheEntry, WeatherCache } from "./met";

export function createWeatherCache(): WeatherCache | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  async function request(path: string, method = "GET", body?: unknown) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method,
      cache: "no-store",
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(method === "PATCH" ? { Prefer: "return=minimal" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error("Weather cache unavailable");
    return res;
  }
  return {
    async read(cacheKey) {
      const res = await request(
        `met_weather_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,expires_at,last_modified,fetched_at`,
      );
      const rows: unknown = await res.json();
      if (!Array.isArray(rows)) throw new Error("Weather cache unavailable");
      if (rows.length === 0) return null;
      const parsed = CacheRow.safeParse(rows[0]);
      // A corrupt derived forecast is a miss, never trusted data. The adapter’s
      // shared lock and global request permit still control any fresh lookup.
      if (!parsed.success) return null;
      const row = parsed.data;
      if (!row.expires_at || !row.fetched_at) return null;
      const lastModified = row.last_modified ?? "";
      if (row.payload && !Number.isFinite(Date.parse(lastModified)))
        return null;
      return {
        forecast: row.payload,
        expiresAt: Date.parse(row.expires_at),
        lastModified,
        fetchedAt: Date.parse(row.fetched_at),
      } satisfies CacheEntry;
    },
    async claim(cacheKey) {
      const res = await request("rpc/claim_met_weather_cache", "POST", {
        p_cache_key: cacheKey,
      });
      return (await res.json()) === true;
    },
    async write(cacheKey, entry) {
      await request(
        `met_weather_cache?cache_key=eq.${encodeURIComponent(cacheKey)}`,
        "PATCH",
        {
          payload: entry.forecast,
          expires_at: new Date(entry.expiresAt).toISOString(),
          last_modified: entry.lastModified,
          fetched_at: new Date(entry.fetchedAt).toISOString(),
          lock_until: new Date(0).toISOString(),
        },
      );
    },
  };
}
