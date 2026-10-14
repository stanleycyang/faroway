"use client";

import { useEffect, useRef, useState } from "react";
import type { Trip } from "@/lib/trips/load-trip";

interface TripBriefEditorProps {
  trip: Trip;
  onSaved: (trip: Trip) => void;
  onReload: () => Promise<Trip | null | undefined>;
}

export function TripBriefEditor(props: TripBriefEditorProps) {
  return (
    <BriefForm
      key={`${props.trip.user_id}:${props.trip.id}:${props.trip.updated_at}`}
      {...props}
    />
  );
}

function BriefForm({ trip, onSaved, onReload }: TripBriefEditorProps) {
  const saveLock = useRef(false);
  const destinationInput = useRef<HTMLInputElement>(null);
  const focusAfterReload = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
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
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (!reloading && focusAfterReload.current) {
      focusAfterReload.current = false;
      destinationInput.current?.focus();
    }
  }, [reloading]);
  const [message, setMessage] = useState<{
    text: string;
    kind: "info" | "error";
  } | null>(null);
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
  const reload = async () => {
    if (saveLock.current || !active.current) return;
    saveLock.current = true;
    setReloading(true);
    try {
      const latest = await onReload();
      if (!active.current) return;
      if (
        !latest ||
        latest.id !== trip.id ||
        latest.user_id !== trip.user_id ||
        latest.updated_at !== trip.updated_at
      ) {
        setMessage({
          text: "The latest brief couldn’t be verified. Your edits are kept. Try loading it again.",
          kind: "error",
        });
        return;
      }
      const latestPreferences = latest.preferences ?? {};
      setDestination(latest.destination);
      setStart(latest.start_date);
      setEnd(latest.end_date);
      setAdults(Number(latestPreferences.adults ?? latest.travelers));
      setChildren(Number(latestPreferences.children ?? 0));
      setBudget(latest.budget_tier ?? "moderate");
      setType(
        String(
          latestPreferences.travelerType ??
            (latest.travelers === 1 ? "solo" : "friends"),
        ),
      );
      setOrigin(String(latestPreferences.originCity ?? ""));
      setAirport(String(latestPreferences.originAirport ?? ""));
      setInterests(
        Array.isArray(latestPreferences.interests)
          ? latestPreferences.interests.join(", ")
          : "",
      );
      setVibes((latest.vibes ?? []).join(", "));
      setMessage(null);
      focusAfterReload.current = true;
    } catch {
      if (active.current)
        setMessage({
          text: "The latest brief couldn’t load. Your edits are kept. Try again.",
          kind: "error",
        });
    } finally {
      saveLock.current = false;
      if (active.current) {
        setReloading(false);
      }
    }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saveLock.current || saving || locked || !active.current) return;
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
      setMessage({
        text: "Your brief is already up to date. No changes were saved.",
        kind: "info",
      });
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: trip.updated_at,
          ...changes,
        }),
      });
      const result = await response.json();
      if (!active.current) return;
      if (!response.ok) {
        setMessage({
          text:
            typeof result.error === "string"
              ? result.error
              : "Could not save. Load the latest brief before retrying.",
          kind: "error",
        });
        return;
      }
      if (
        result.trip?.id !== trip.id ||
        result.trip?.user_id !== trip.user_id ||
        typeof result.trip?.updated_at !== "string" ||
        !result.trip.updated_at.trim() ||
        result.trip.updated_at === trip.updated_at
      ) {
        setMessage({
          text: "This save response could not be verified. Your edits are kept. Load the latest brief before trying again.",
          kind: "error",
        });
        return;
      }
      onSaved(result.trip);
    } catch {
      if (!active.current) return;
      setMessage({
        text: "The save response was interrupted. Your edits are still here. Load the latest brief to check whether they were saved before retrying.",
        kind: "error",
      });
    } finally {
      saveLock.current = false;
      if (active.current) setSaving(false);
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
          disabled={locked || saving || reloading}
          className="grid gap-4 sm:grid-cols-2 disabled:opacity-60"
        >
          <label className="text-sm sm:col-span-2">
            Destination
            <input
              ref={destinationInput}
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
            className="rounded-full bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 sm:col-span-2"
          >
            {saving ? "Saving brief…" : "Save trip brief"}
          </button>
        </fieldset>
        {message && (
          <div
            role={message.kind === "info" ? "status" : "alert"}
            className={
              message.kind === "info"
                ? "mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"
                : "mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            }
          >
            {message.text}
            {message.kind === "error" && (
              <button
                type="button"
                onClick={reload}
                disabled={saving || reloading}
                className="ml-2 font-semibold underline"
              >
                {reloading ? "Loading saved brief…" : "Load latest brief"}
              </button>
            )}
          </div>
        )}
      </form>
    </details>
  );
}
