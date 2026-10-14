"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PlaceDisplay } from "@/lib/places/display";
import { isPlaceDisplay, safeHttpsUrl } from "@/lib/places/display";

function Attribution({ place }: { place?: PlaceDisplay }) {
  return (
    <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-[#5E5E5E]">
      <span
        translate="no"
        className="whitespace-nowrap font-normal not-italic tracking-normal"
      >
        Google Maps
      </span>
      {place?.attributions.map((a, i) => (
        <span key={`${a.provider}-${i}`}>
          {" "}
          ·{" "}
          {safeHttpsUrl(a.providerUri) ? (
            <a
              href={a.providerUri}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {a.provider}
            </a>
          ) : (
            a.provider
          )}
        </span>
      ))}
    </div>
  );
}

/** Display-only boundary: no trip callback, persistence, analytics payloads or AI tools. */
export function PlacesExplorer({
  initialPlaceId,
}: {
  initialPlaceId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceDisplay[]>([]);
  const [detail, setDetail] = useState<PlaceDisplay | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const request = useRef<AbortController | null>(null);

  const clearDisplay = () => {
    request.current?.abort();
    setPlaces([]);
    setDetail(null);
    setError(null);
    setBusy(false);
    setSearched(false);
  };
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const clearOnHide = () => {
      if (document.visibilityState === "hidden") {
        request.current?.abort();
        setPlaces([]);
        setDetail(null);
        setBusy(false);
        setSearched(false);
      }
    };
    document.addEventListener("visibilitychange", clearOnHide);
    return () => document.removeEventListener("visibilitychange", clearOnHide);
  }, []);

  async function lookup(params: { query: string } | { placeId: string }) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setPlaces([]);
    setDetail(null);
    setSearched(false);
    const deadline = setTimeout(() => {
      if (request.current !== controller || controller.signal.aborted) return;
      controller.abort();
      setBusy(false);
      setError(
        "Live place details are taking too long. You can continue planning or try again.",
      );
    }, 15_000);
    controller.signal.addEventListener("abort", () => clearTimeout(deadline), {
      once: true,
    });
    try {
      const res = await fetch(
        `/api/places/venues?${new URLSearchParams(params)}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!res.ok)
        throw new Error(
          "Live place details are unavailable. You can continue planning or try again.",
        );
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (
        !data ||
        typeof data !== "object" ||
        (data.places !== undefined &&
          (!Array.isArray(data.places) ||
            !data.places.every(isPlaceDisplay))) ||
        (data.place != null && !isPlaceDisplay(data.place))
      ) {
        throw new Error("Live place response could not be verified");
      }
      setPlaces(data.places ?? []);
      setDetail(data.place ?? null);
      setSearched(true);
    } catch {
      if (!controller.signal.aborted)
        setError(
          "Live place details are unavailable. You can continue planning or try again.",
        );
    } finally {
      clearTimeout(deadline);
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section
      data-sentry-block
      className="sentry-block rounded-xl border border-gray-200 bg-white p-4"
      aria-label="Live place reference"
    >
      <button
        type="button"
        aria-expanded={open}
        className="text-sm font-semibold text-primary"
        onClick={() => {
          if (open) {
            clearDisplay();
            setOpen(false);
          } else {
            setOpen(true);
            if (initialPlaceId) void lookup({ placeId: initialPlaceId });
          }
        }}
      >
        {open
          ? "Close live place details"
          : initialPlaceId
            ? "View live city details"
            : "Explore live places"}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-600">
            Look up a venue and check its address on Google Maps. These
            references do not change your itinerary or confirm a reservation.
          </p>
          {!initialPlaceId && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim().length >= 2)
                  void lookup({ query: query.trim() });
              }}
            >
              <input
                aria-label="Venue and city"
                placeholder="Venue or category, city"
                maxLength={120}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  clearDisplay();
                }}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy || query.trim().length < 2}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Search places
              </button>
            </form>
          )}
          {busy && (
            <p role="status" className="text-sm text-gray-600">
              Looking up live places…
            </p>
          )}
          {error && (
            <div role="alert" className="text-sm text-gray-600">
              {error}
              {initialPlaceId && (
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => void lookup({ placeId: initialPlaceId })}
                >
                  Retry lookup
                </button>
              )}
            </div>
          )}
          {searched && !detail && places.length === 0 && (
            <p className="text-sm text-gray-600">
              No matching places. Try a venue name and city.
            </p>
          )}
          {places.map((place) => (
            <article
              key={place.placeId}
              className="rounded-lg border border-gray-200 p-3"
            >
              <h4 className="font-semibold text-gray-900">{place.name}</h4>
              {place.address && (
                <p className="mt-1 text-sm text-gray-600">{place.address}</p>
              )}
              <button
                type="button"
                onClick={() => void lookup({ placeId: place.placeId })}
                className="mt-2 text-sm font-medium text-primary"
              >
                View details for {place.name}
              </button>
              <Attribution place={place} />
            </article>
          ))}
          {detail && (
            <article className="rounded-lg border border-gray-200 p-3">
              <h4 className="font-semibold text-gray-900">{detail.name}</h4>
              {detail.address && (
                <p className="mt-1 text-sm text-gray-600">{detail.address}</p>
              )}
              {detail.businessStatus === "CLOSED_PERMANENTLY" && (
                <p className="mt-2 text-sm text-red-700">
                  Reported permanently closed
                </p>
              )}
              {detail.businessStatus === "CLOSED_TEMPORARILY" && (
                <p className="mt-2 text-sm text-amber-700">
                  Reported temporarily closed
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Price and availability not verified. Check current hours and
                booking terms before visiting.
              </p>
              {safeHttpsUrl(detail.mapsUrl) && (
                <a
                  href={detail.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-primary underline"
                >
                  Open on Google Maps
                </a>
              )}
              <Attribution place={detail} />
            </article>
          )}
        </div>
      )}
    </section>
  );
}
