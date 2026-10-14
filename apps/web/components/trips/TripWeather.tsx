"use client";
import React, { useEffect, useRef, useState } from "react";
import { destinations } from "@/lib/planner-destination-catalog";
import type { Forecast } from "@/lib/weather/met";
import { ForecastSchema } from "@/lib/weather/forecast";

export function TripWeather({
  destination,
  start,
  end,
}: {
  destination: string;
  start: string;
  end: string;
}) {
  const catalog = destinations.find(
    (d) => d.name.toLowerCase() === destination.toLowerCase(),
  );
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (!catalog) return null;
  async function load() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setMessage("");
    setForecast(null);
    const deadline = setTimeout(() => {
      if (controller.current !== current || current.signal.aborted) return;
      current.abort();
      setBusy(false);
      setMessage(
        "Weather is taking too long. Your trip plan is still available; try again when you’re ready.",
      );
    }, 15_000);
    current.signal.addEventListener("abort", () => clearTimeout(deadline), {
      once: true,
    });
    try {
      const params = new URLSearchParams({
        destinationId: catalog!.id,
        start: start.slice(0, 10),
        end: end.slice(0, 10),
      });
      const res = await fetch(`/api/weather?${params}`, {
        cache: "no-store",
        signal: current.signal,
      });
      const data = await res.json();
      if (current.signal.aborted) return;
      if (res.ok && data.status === "available") {
        const verified = ForecastSchema.safeParse(data.forecast);
        if (verified.success) setForecast(verified.data);
        else
          setMessage(
            "Weather is unavailable right now. You can continue with your trip plan.",
          );
      } else
        setMessage(
          data.status === "outside_forecast"
            ? "Forecasts for these trip dates are not available yet. Check again closer to departure."
            : "Weather is unavailable right now. You can continue with your trip plan.",
        );
    } catch {
      if (!current.signal.aborted)
        setMessage("Weather is unavailable right now. Please try again later.");
    } finally {
      clearTimeout(deadline);
      if (!current.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-4"
      aria-label="Trip weather"
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => void load()}
        className="text-sm font-semibold text-primary disabled:opacity-50"
      >
        {busy ? "Checking forecast…" : "Check trip forecast"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-sm text-gray-600">
          {message}
        </p>
      )}
      {forecast && (
        <div className="mt-3">
          <p className="text-xs text-gray-600">
            Updated {new Date(forecast.updatedAt).toUTCString()}. Forecasts can
            change; only available trip dates are shown.
          </p>
          {forecast.deprecated && (
            <p className="mt-2 text-sm text-amber-700">
              This forecast service version is being retired. Forecast
              availability may change.
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="text-left mb-2">
                Faroway-selected forecast points (up to 24); times in UTC.
              </caption>
              <thead>
                <tr>
                  <th className="p-2">Time</th>
                  <th className="p-2">Temperature</th>
                  <th className="p-2">Precipitation</th>
                  <th className="p-2">Wind</th>
                </tr>
              </thead>
              <tbody>
                {forecast.points
                  .filter((_, i) => i % 6 === 0)
                  .slice(0, 24)
                  .map((point) => (
                    <tr key={point.time} className="border-t border-gray-100">
                      <td className="p-2">
                        {point.time.replace("T", " ").replace(":00Z", " UTC")}
                      </td>
                      <td className="p-2">{point.temperatureC} °C</td>
                      <td className="p-2">
                        {point.precipitationMm === null
                          ? "Not available"
                          : `${point.precipitationMm} mm / ${point.precipitationHours} h`}
                      </td>
                      <td className="p-2">{point.windMetersPerSecond} m/s</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Weather data:{" "}
            <a
              className="underline"
              href="https://www.met.no/en"
              target="_blank"
              rel="noopener noreferrer"
            >
              MET Norway
            </a>
            ,{" "}
            <a
              className="underline"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0
            </a>
            . Faroway selects and formats forecast points; no provider
            endorsement.
          </p>
        </div>
      )}
    </section>
  );
}
