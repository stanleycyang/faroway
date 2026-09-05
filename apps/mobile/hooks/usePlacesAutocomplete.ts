import { useState, useRef, useCallback, useEffect } from 'react';
import { popularDestinations } from '@faroway/constants';
import { API_BASE_URL } from '../constants/api';
import { fetchWithTimeout } from '../services/request';

export interface PlacePrediction {
  placeId: string;
  city: string;
  secondary: string; // country/region
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const PLACES_TIMEOUT_MS = 8000;

function filterLocalDestinations(query: string): PlacePrediction[] {
  const q = query.toLowerCase();
  return popularDestinations
    .filter((d) => d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q))
    .map((d) => ({
      placeId: d.id,
      city: d.name,
      secondary: d.country,
    }));
}

export function parsePlacesProxyPredictions(value: unknown): PlacePrediction[] | null {
  if (!value || typeof value !== 'object' || !('predictions' in value)) {
    return null;
  }

  const rawPredictions = (value as { predictions?: unknown }).predictions;
  if (!Array.isArray(rawPredictions)) return null;

  return rawPredictions.flatMap((prediction) => {
    if (
      !prediction ||
      typeof prediction !== 'object' ||
      typeof (prediction as { placeId?: unknown }).placeId !== 'string' ||
      typeof (prediction as { mainText?: unknown }).mainText !== 'string'
    ) {
      return [];
    }

    const item = prediction as {
      placeId: string;
      mainText: string;
      secondaryText?: unknown;
    };
    return [
      {
        placeId: item.placeId,
        city: item.mainText,
        secondary: typeof item.secondaryText === 'string' ? item.secondaryText : '',
      },
    ];
  });
}

export function usePlacesAutocomplete() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    []
  );

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setPredictions([]);
    setIsLoading(false);
    setError(null);
  }, []);

  const search = useCallback((query: string) => {
    // Clear previous debounce / request
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (query.length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const url = `${API_BASE_URL}/api/places/autocomplete?input=${encodeURIComponent(query)}`;
        const res = await fetchWithTimeout(url, { signal: controller.signal }, PLACES_TIMEOUT_MS);
        if (!res.ok) {
          throw new Error(`Places request failed (${res.status})`);
        }
        const data = await res.json();
        // Some fetch implementations (or body readers) settle after cancellation.
        if (controller.signal.aborted) return;
        const parsedPredictions = parsePlacesProxyPredictions(data);

        if (parsedPredictions) {
          setPredictions(parsedPredictions);
          setError(null);
        } else {
          throw new Error('Invalid places response');
        }
      } catch {
        if (controller.signal.aborted) return;
        // Deadlines also throw AbortError, but do not abort the caller's signal.
        // Timeouts, network failures and invalid responses all use local results.
        setPredictions(filterLocalDestinations(query));
        setError(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);
  }, []);

  return { predictions, isLoading, error, search, clear };
}
