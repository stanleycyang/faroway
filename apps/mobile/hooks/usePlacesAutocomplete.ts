import { useState, useRef, useCallback } from 'react';
import { popularDestinations } from '@faroway/constants';

export interface PlacePrediction {
  placeId: string;
  city: string;
  secondary: string; // country/region
}

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

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

export function usePlacesAutocomplete() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

    // No API key — fall back to local filtering
    if (!API_KEY) {
      setPredictions(filterLocalDestinations(query));
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const url =
          `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
          `?input=${encodeURIComponent(query)}` +
          `&types=(cities)` +
          `&key=${encodeURIComponent(API_KEY)}`;

        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();

        if (data.status === 'OK' && data.predictions) {
          setPredictions(
            data.predictions.map(
              (p: {
                place_id: string;
                description: string;
                structured_formatting?: { main_text?: string; secondary_text?: string };
              }) => ({
                placeId: p.place_id,
                city: p.structured_formatting?.main_text ?? p.description,
                secondary: p.structured_formatting?.secondary_text ?? '',
              })
            )
          );
          setError(null);
        } else if (data.status === 'ZERO_RESULTS') {
          setPredictions([]);
          setError(null);
        } else {
          // API error — fall back to local filtering
          setPredictions(filterLocalDestinations(query));
          setError(null);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Network error — fall back to local filtering
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
