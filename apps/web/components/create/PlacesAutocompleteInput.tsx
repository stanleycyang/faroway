"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { PlacesExplorer } from "@/components/places/PlacesExplorer";
import { Search, MapPin, X, Loader2 } from "lucide-react";

export interface PlaceResult {
  name: string;
  source: "catalog" | "user";
}

interface Prediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface PlacesAutocompleteInputProps {
  onSelect: (place: PlaceResult) => void;
  localDestinations: { name: string; country: string }[];
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const SEARCH_TIMEOUT_MS = 15_000;

export function PlacesAutocompleteInput({
  onSelect,
  localDestinations,
}: PlacesAutocompleteInputProps) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dismissResults = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setPredictions([]);
    setIsLoading(false);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      )
        dismissResults();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") dismissResults();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", dismissResults);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", dismissResults);
    };
  }, [dismissResults]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const localQuery = query.trim().toLowerCase();
  const localResults =
    localQuery.length < MIN_QUERY_LENGTH
      ? []
      : localDestinations.filter(
          (destination) =>
            destination.name.toLowerCase().includes(localQuery) ||
            destination.country.toLowerCase().includes(localQuery),
        );

  const handleInputChange = (value: string) => {
    setQuery(value);
    setIsOpen(true);
    setPredictions([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (value.length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setIsLoading(false);
      return;
    }

    if (!apiAvailable) return;

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      const isCurrent = () =>
        abortRef.current === controller && !controller.signal.aborted;
      const deadline = setTimeout(() => {
        if (!isCurrent()) return;
        controller.abort();
        setIsLoading(false);
      }, SEARCH_TIMEOUT_MS);
      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(value)}`,
          { signal: controller.signal },
        );

        if (!isCurrent()) return;
        if (res.status === 501) {
          // No API key configured — fall back to local only
          setApiAvailable(false);
          setIsLoading(false);
          return;
        }

        if (!res.ok) throw new Error("Destination search failed");
        const data: unknown = await res.json();
        if (isCurrent()) {
          const results =
            data && typeof data === "object" && "predictions" in data
              ? data.predictions
              : undefined;
          setPredictions(
            Array.isArray(results)
              ? results.filter(
                  (item): item is Prediction =>
                    item !== null &&
                    typeof item === "object" &&
                    typeof item.placeId === "string" &&
                    typeof item.mainText === "string" &&
                    typeof item.secondaryText === "string",
                )
              : [],
          );
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (isCurrent()) setIsLoading(false);
      } finally {
        clearTimeout(deadline);
      }
    }, DEBOUNCE_MS);
  };

  const handleSelectLocal = (dest: { name: string; country: string }) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    setIsOpen(false);
    setQuery(dest.name);
    setPredictions([]);
    onSelect({
      name: dest.name,
      source: "catalog",
    });
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    setQuery("");
    setPredictions([]);
    setIsLoading(false);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const hasGoogleResults = predictions.length > 0;
  const showDropdown = isOpen && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          value={query}
          maxLength={120}
          aria-label="Destination"
          aria-expanded={showDropdown}
          aria-controls={
            showDropdown ? "destination-search-results" : undefined
          }
          role="combobox"
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (query.length >= MIN_QUERY_LENGTH) setIsOpen(true);
          }}
          placeholder="Search any city worldwide..."
          className="w-full pl-12 pr-10 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear destination"
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id="destination-search-results"
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 max-h-[65vh] overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50"
        >
          {isLoading &&
          predictions.length === 0 &&
          localResults.length === 0 ? (
            <div className="px-4 py-6 flex items-center justify-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : (
            <ul className="max-h-64 overflow-auto">
              {localResults.map((d) => (
                <li key={d.name}>
                  <button
                    type="button"
                    onClick={() => handleSelectLocal(d)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {d.name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {d.country}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm font-medium text-primary"
                  onClick={() => {
                    abortRef.current?.abort();
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    setIsOpen(false);
                    setPredictions([]);
                    onSelect({ name: query.trim(), source: "user" });
                  }}
                >
                  Plan with “{query.trim()}”
                </button>
              </li>
            </ul>
          )}
          {hasGoogleResults && (
            <div
              data-sentry-block
              className="sentry-block border-t border-gray-200 p-3 bg-gray-50"
            >
              <p className="mb-2 text-xs text-gray-600">
                Live city reference · choose a catalog destination above or use
                your own text to plan.
              </p>
              {predictions.map((p) => (
                <div
                  key={p.placeId}
                  className="mb-2 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <p className="text-sm font-medium">{p.mainText}</p>
                  <p className="text-xs text-gray-600">{p.secondaryText}</p>
                  <span
                    translate="no"
                    className="text-xs font-normal text-[#5E5E5E] whitespace-nowrap"
                  >
                    Google Maps
                  </span>
                  <PlacesExplorer key={p.placeId} initialPlaceId={p.placeId} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
