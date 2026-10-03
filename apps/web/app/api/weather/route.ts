import { NextRequest, NextResponse } from "next/server";
import { destinations } from "@/lib/planner-destination-catalog";
import { createWeatherCache } from "@/lib/weather/cache";
import {
  forecastForDates,
  getMetForecast,
  validMetUserAgent,
} from "@/lib/weather/met";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const reply = (body: unknown) =>
    NextResponse.json(body, {
      headers: { "Cache-Control": "private, no-store" },
    });
  const ua = process.env.MET_USER_AGENT || "";
  if (process.env.MET_WEATHER_ENABLED !== "true" || !validMetUserAgent(ua))
    return reply({ status: "disabled" });
  const destination = destinations.find(
    (d) => d.id === request.nextUrl.searchParams.get("destinationId"),
  );
  const start = request.nextUrl.searchParams.get("start") || "",
    end = request.nextUrl.searchParams.get("end") || "";
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!destination || !validDate(start) || !validDate(end) || start > end)
    return reply({ status: "unavailable" });
  const now = Date.now();
  if (
    Date.parse(start) > now + 9 * 86400000 ||
    Date.parse(end) + 86400000 < now
  )
    return reply({ status: "outside_forecast" });
  const cache = createWeatherCache();
  if (!cache || !process.env.IP_HASH_SALT)
    return reply({ status: "unavailable" });
  const forecast = await getMetForecast(destination.lat, destination.lng, {
    cache,
    enabled: true,
    userAgent: ua,
    fetch,
    now: () => Date.now(),
    permitRequest: async () =>
      (
        await checkRateLimitAsync("met-weather-global-v1", {
          maxRequests: 1,
          windowMs: 1000,
          failClosed: true,
        })
      ).allowed,
  });
  if (!forecast) return reply({ status: "unavailable" });
  const selected = forecastForDates(forecast, start, end, now);
  return reply(
    selected.points.length
      ? { status: "available", forecast: selected }
      : { status: "outside_forecast" },
  );
}
