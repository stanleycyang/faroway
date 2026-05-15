/**
 * useItineraryGeneration
 *
 * Unified flow that:
 *   1. Creates a trip via POST /api/trips
 *   2. Triggers generation via POST /api/trips/[id]/generate
 *   3. Polls GET /api/trips/[id]/generate for progress (reads from searches table)
 *   4. When status === 'completed', fetches the jsonRenderSpec from the search
 *   5. Returns the spec + progress state to the UI
 *
 * This ensures trips are stored in the `trips` table for both web and mobile (shared data).
 */

import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../constants/api';
import { getAuthHeaders } from '../lib/supabase';
import type { SearchProgress } from '@faroway/types';

export interface SearchResults {
  hotels: unknown[];
  activities: unknown[];
  dining: unknown[];
  itinerary: unknown[];
  [key: string]: unknown;
}

export interface ItineraryGenerationState {
  /** The json-render component array (null until completed) */
  jsonRenderSpec: unknown[] | null;
  /** The traditional search results (null until completed) */
  results: SearchResults | null;
  /** Current search ID */
  searchId: string | null;
  /** Created trip ID */
  tripId: string | null;
  /** Overall progress 0-100 */
  progress: number;
  /** Per-agent progress object */
  searchProgress: SearchProgress | null;
  /** Human-readable status message */
  statusMessage: string;
  /** True while the workflow is running */
  isGenerating: boolean;
  /** True when generation completed successfully */
  isComplete: boolean;
  /** Error message if the workflow failed */
  error: string | null;
}

export interface UseItineraryGenerationInput {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType?: string;
  vibes: string[];
  budget?: string;
}

export function useItineraryGeneration(
  input: UseItineraryGenerationInput | null
): ItineraryGenerationState {
  const [state, setState] = useState<ItineraryGenerationState>({
    jsonRenderSpec: null,
    results: null,
    searchId: null,
    tripId: null,
    progress: 0,
    searchProgress: null,
    statusMessage: 'Starting your search...',
    isGenerating: false,
    isComplete: false,
    error: null,
  });

  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!input) return;

    cancelledRef.current = false;

    const run = async () => {
      setState((prev) => ({
        ...prev,
        isGenerating: true,
        isComplete: false,
        error: null,
        progress: 0,
        jsonRenderSpec: null,
        results: null,
        searchId: null,
        tripId: null,
        statusMessage: 'Creating your trip...',
      }));

      try {
        const authHeaders = await getAuthHeaders();

        // 1. Create a trip via the unified API
        const tripResponse = await fetch(`${API_BASE_URL}/api/trips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            destination: input.destination,
            start_date: input.startDate,
            end_date: input.endDate,
            travelers: input.travelers,
            budget: input.budget || 'moderate',
            preferences: {
              travelerType: input.travelerType,
              vibes: input.vibes,
            },
          }),
        });

        if (!tripResponse.ok) {
          const err = await tripResponse.json().catch(() => ({ error: 'Failed to create trip' }));
          throw new Error(err.error || 'Failed to create trip');
        }

        const { trip } = await tripResponse.json();
        const tripId = trip.id;

        if (cancelledRef.current) return;

        setState((prev) => ({ ...prev, tripId, statusMessage: 'Starting AI trip planner...' }));

        // 2. Trigger generation via POST /api/trips/[id]/generate
        const genResponse = await fetch(`${API_BASE_URL}/api/trips/${tripId}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
        });

        if (!genResponse.ok && genResponse.status !== 409) {
          const err = await genResponse
            .json()
            .catch(() => ({ error: 'Failed to start generation' }));
          throw new Error(err.error || 'Failed to start generation');
        }

        const genData = await genResponse.json();
        const searchId = genData.searchId;

        if (cancelledRef.current) return;

        setState((prev) => ({ ...prev, searchId }));

        // 3. Poll GET /api/trips/[id]/generate for progress
        let attempts = 0;
        const maxAttempts = 90; // ~3 min at 2s intervals

        while (attempts < maxAttempts) {
          if (cancelledRef.current) return;

          const statusRes = await fetch(`${API_BASE_URL}/api/trips/${tripId}/generate`, {
            headers: authHeaders,
          });
          if (!statusRes.ok) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }

          const status = await statusRes.json();
          const progressPercent = status.progress || 0;
          const searchProgress = status.searchProgress || null;
          const message = status.message || 'Processing...';

          setState((prev) => ({
            ...prev,
            progress: progressPercent,
            searchProgress,
            statusMessage: message,
          }));

          if (status.status === 'completed') {
            // Fetch the json-render spec from the search
            if (searchId) {
              try {
                const searchRes = await fetch(`${API_BASE_URL}/api/search/${searchId}`, {
                  headers: authHeaders,
                });
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  setState((prev) => ({
                    ...prev,
                    jsonRenderSpec: searchData.jsonRenderSpec || null,
                    results: searchData.results || null,
                  }));
                }
              } catch {
                // Non-fatal — we can still navigate to the trip
              }
            }

            setState((prev) => ({
              ...prev,
              progress: 100,
              isGenerating: false,
              isComplete: true,
              statusMessage: 'Your itinerary is ready!',
            }));
            return;
          }

          if (status.status === 'failed') {
            throw new Error(status.message || 'Generation failed');
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempts++;
        }

        throw new Error('Generation timed out');
      } catch (error) {
        if (cancelledRef.current) return;
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: error instanceof Error ? error.message : 'Generation failed',
        }));
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(input)]);

  return state;
}
