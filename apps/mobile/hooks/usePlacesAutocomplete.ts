import { useState, useCallback } from 'react';
import { popularDestinations } from '@faroway/constants';

export interface PlacePrediction {
  placeId: string;
  city: string;
  secondary: string; // country/region
}

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

// Native planning uses independent catalog facts or explicit traveler text.
// Google display data must never be promoted into saved/offline trip inputs.
export function usePlacesAutocomplete() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const clear = useCallback(() => setPredictions([]), []);
  const search = useCallback((query: string) => {
    setPredictions(query.trim().length >= 2 ? filterLocalDestinations(query) : []);
  }, []);
  return { predictions, isLoading: false, error: null, search, clear };
}
