'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
  placeId: string;
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

export function PlacesAutocompleteInput({ onSelect, localDestinations }: PlacesAutocompleteInputProps) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [localResults, setLocalResults] = useState<{ name: string; country: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filterLocal = useCallback((q: string) => {
    const lower = q.toLowerCase();
    return localDestinations.filter(
      d => d.name.toLowerCase().includes(lower) || d.country.toLowerCase().includes(lower)
    );
  }, [localDestinations]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (value.length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setLocalResults([]);
      setIsLoading(false);
      return;
    }

    // Always compute local results immediately
    setLocalResults(filterLocal(value));

    if (!apiAvailable) return;

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(value)}`,
          { signal: controller.signal }
        );

        if (res.status === 501) {
          // No API key configured — fall back to local only
          setApiAvailable(false);
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        if (!controller.signal.aborted) {
          setPredictions(data.predictions ?? []);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const handleSelectPrediction = async (prediction: Prediction) => {
    setIsOpen(false);
    setQuery(prediction.mainText);
    setPredictions([]);

    // Fetch lat/lng from details endpoint
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`);
      if (res.ok) {
        const data = await res.json();
        onSelect({
          name: prediction.mainText,
          lat: data.lat,
          lng: data.lng,
          placeId: prediction.placeId,
        });
        return;
      }
    } catch {
      // Fall through to no-coords selection
    }

    onSelect({
      name: prediction.mainText,
      lat: 0,
      lng: 0,
      placeId: prediction.placeId,
    });
  };

  const handleSelectLocal = (dest: { name: string; country: string }) => {
    setIsOpen(false);
    setQuery(dest.name);
    setPredictions([]);
    setLocalResults([]);
    onSelect({
      name: dest.name,
      lat: 0,
      lng: 0,
      placeId: '',
    });
  };

  const handleClear = () => {
    setQuery('');
    setPredictions([]);
    setLocalResults([]);
    inputRef.current?.focus();
  };

  const hasGoogleResults = predictions.length > 0;
  const hasLocalResults = localResults.length > 0;
  const showDropdown = isOpen && query.length >= MIN_QUERY_LENGTH && (hasGoogleResults || hasLocalResults || isLoading);

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
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (query.length >= MIN_QUERY_LENGTH) setIsOpen(true); }}
          placeholder="Search any city worldwide..."
          className="w-full pl-12 pr-10 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {query && (
          <button type="button" onClick={handleClear} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50"
        >
          {isLoading && predictions.length === 0 && localResults.length === 0 ? (
            <div className="px-4 py-6 flex items-center justify-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : (
            <ul className="max-h-64 overflow-auto">
              {predictions.map((p) => (
                <li key={p.placeId}>
                  <button
                    type="button"
                    onClick={() => handleSelectPrediction(p)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{p.mainText}</p>
                      <p className="text-sm text-gray-500 truncate">{p.secondaryText}</p>
                    </div>
                  </button>
                </li>
              ))}
              {!hasGoogleResults && localResults.map((d) => (
                <li key={d.name}>
                  <button
                    type="button"
                    onClick={() => handleSelectLocal(d)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{d.name}</p>
                      <p className="text-sm text-gray-500 truncate">{d.country}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
