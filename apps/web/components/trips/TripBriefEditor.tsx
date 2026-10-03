"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/load-trip";

export function TripBriefEditor({
  trip,
  onSaved,
  onReload,
}: {
  trip: Trip;
  onSaved: (trip: Trip) => void;
  onReload: () => void;
}) {
  const preferences = trip.preferences ?? {};
  const [destination, setDestination] = useState(trip.destination);
  const [start, setStart] = useState(trip.start_date);
  const [end, setEnd] = useState(trip.end_date);
  const [adults, setAdults] = useState(
    Number(preferences.adults ?? trip.travelers),
  );
  const [children, setChildren] = useState(Number(preferences.children ?? 0));
  const [budget, setBudget] = useState(trip.budget_tier ?? "moderate");
  const [type, setType] = useState(
    String(
      preferences.travelerType ?? (trip.travelers === 1 ? "solo" : "friends"),
    ),
  );
  const [origin, setOrigin] = useState(String(preferences.originCity ?? ""));
  const [airport, setAirport] = useState(
    String(preferences.originAirport ?? ""),
  );
  const [interests, setInterests] = useState(
    Array.isArray(preferences.interests)
      ? preferences.interests.join(", ")
      : "",
  );
  const [vibes, setVibes] = useState((trip.vibes ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locked = trip.status === "generating";
  const inputStyle =
    "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  const list = (value: string) => [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || locked) return;
    const changes: Record<string, unknown> = {};
    const changedPreferences: Record<string, unknown> = {};
    const changed = (
      key: string,
      value: unknown,
      previous: unknown,
      target = changes,
    ) => {
      if (JSON.stringify(value) !== JSON.stringify(previous))
        target[key] = value;
    };
    changed("destination", destination.trim(), trip.destination);
    changed("start_date", start, trip.start_date);
    changed("end_date", end, trip.end_date);
    changed("budget_tier", budget, trip.budget_tier ?? "moderate");
    changed("vibes", list(vibes), trip.vibes ?? []);
    changed(
      "travelerType",
      type,
      preferences.travelerType ?? (trip.travelers === 1 ? "solo" : "friends"),
      changedPreferences,
    );
    changed(
      "originCity",
      origin.trim(),
      preferences.originCity ?? "",
      changedPreferences,
    );
    changed(
      "originAirport",
      airport.trim().toUpperCase(),
      preferences.originAirport ?? "",
      changedPreferences,
    );
    changed(
      "interests",
      list(interests),
      preferences.interests ?? [],
      changedPreferences,
    );
    if (
      adults !== Number(preferences.adults ?? trip.travelers) ||
      children !== Number(preferences.children ?? 0)
    ) {
      changes.travelers = adults + children;
      Object.assign(changedPreferences, { adults, children });
    }
    if (Object.keys(changedPreferences).length)
      changes.preferences = changedPreferences;
    if (!Object.keys(changes).length) {
      setMessage("Your brief is already up to date. No changes were saved.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: trip.updated_at,
          ...changes,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(
          result.error ||
            "Could not save. Load the latest brief before retrying.",
        );
        return;
      }
      onSaved(result.trip);
    } catch {
      setMessage(
        "The save response was interrupted. Your edits are still here. Load the latest brief to check whether they were saved before retrying.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <details className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer list-none">
        <span className="font-semibold text-gray-900">Your trip brief</span>
        <span className="ml-3 text-sm text-gray-500">
          {locked ? "Locked while planning" : "Review or edit"}
        </span>
        <p className="mt-1 text-sm text-gray-600">
          {trip.travelers} travelers · {trip.budget_tier ?? "moderate"} budget
          {trip.vibes?.length ? ` · ${trip.vibes.join(", ")}` : ""}
        </p>
      </summary>
      <form onSubmit={save} className="mt-5">
        <fieldset
          disabled={locked || saving}
          className="grid gap-4 sm:grid-cols-2 disabled:opacity-60"
        >
          <label className="text-sm sm:col-span-2">
            Destination
            <input
              required
              maxLength={200}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              className={inputStyle}
            />
          </label>
          <label className="text-sm">
            Start date
            <input
              required
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={inputStyle}
            />
          </label>
          <label className="text-sm">
            End date
            <input
              required
              type="date"
              min={start}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={inputStyle}
            />
          </label>
          <label className="text-sm">
            Adults
            <input
              required
              type="number"
              min={1}
              max={50}
              value={adults}
              onChange={(event) => setAdults(Number(event.target.value))}
              className={inputStyle}
            />
          </label>
          <label className="text-sm">
            Children
            <input
              required
              type="number"
              min={0}
              max={49}
              value={children}
              onChange={(event) => setChildren(Number(event.target.value))}
              className={inputStyle}
            />
          </label>
          <label className="text-sm">
            Budget
            <select
              value={budget}
              onChange={(event) =>
                setBudget(event.target.value as typeof budget)
              }
              className={inputStyle}
            >
              <option value="budget">Budget</option>
              <option value="moderate">Moderate</option>
              <option value="luxury">Luxury</option>
            </select>
          </label>
          <label className="text-sm">
            Traveling as
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className={inputStyle}
            >
              {["solo", "couple", "family", "friends", "business"].map(
                (value) => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="text-sm">
            Starting city (optional)
            <input
              maxLength={200}
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              className={inputStyle}
            />
          </label>
          <label className="text-sm">
            Starting airport (optional)
            <input
              maxLength={10}
              value={airport}
              onChange={(event) => setAirport(event.target.value)}
              className={inputStyle}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Interests, separated by commas
            <input
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
              placeholder="Architecture, quiet cafés, art"
              className={inputStyle}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Trip vibes, separated by commas
            <input
              value={vibes}
              onChange={(event) => setVibes(event.target.value)}
              className={inputStyle}
            />
          </label>
          <p className="text-sm text-gray-500 sm:col-span-2">
            Changing your brief keeps your previous plan and turns off its
            public link. Choose Start planning when you are ready to build a
            plan for the updated brief.
          </p>
          <button
            type="submit"
            className="rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            {saving ? "Saving brief…" : "Save trip brief"}
          </button>
        </fieldset>
        {message && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
          >
            {message}
            <button
              type="button"
              onClick={onReload}
              className="ml-2 font-semibold underline"
            >
              Load latest brief
            </button>
          </div>
        )}
      </form>
    </details>
  );
}
