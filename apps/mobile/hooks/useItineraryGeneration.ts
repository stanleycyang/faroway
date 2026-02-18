/**
 * useItineraryGeneration
 *
 * Poll-based hook that:
 *   1. Calls POST /api/search/start to kick off the Vercel Workflow
 *   2. Polls GET /api/search/[searchId] every 2 s for progress
 *   3. When status === 'completed', extracts the jsonRenderSpec
 *   4. Returns the spec + progress state to the UI
 */

import { useState, useEffect, useRef } from 'react';
import {
  startSearch,
  pollSearchStatus,
  calculateProgressPercent,
  getStatusMessage,
  SearchResults,
} from '../services/searchService';
import type { SearchProgress, SearchStatusResponse } from '@tripgenie/types';

export interface ItineraryGenerationState {
  /** The json-render component array (null until completed) */
  jsonRenderSpec: unknown[] | null;
  /** The traditional search results (null until completed) */
  results: SearchResults | null;
  /** Current search ID */
  searchId: string | null;
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
  input: UseItineraryGenerationInput | null,
): ItineraryGenerationState {
  const [state, setState] = useState<ItineraryGenerationState>({
    jsonRenderSpec: null,
    results: null,
    searchId: null,
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
        statusMessage: 'Starting your search...',
      }));

      try {
        // 1. Kick off the workflow
        const { searchId } = await startSearch({
          destination: input.destination,
          startDate: input.startDate,
          endDate: input.endDate,
          travelers: input.travelers,
          travelerType: input.travelerType as any,
          vibes: input.vibes,
          budget: input.budget as any,
        });

        if (cancelledRef.current) return;

        setState((prev) => ({ ...prev, searchId }));

        // 2. Poll until completed or error
        const results = await pollSearchStatus(
          searchId,
          (status: SearchStatusResponse) => {
            if (cancelledRef.current) return;
            const progressPercent = calculateProgressPercent(status.progress);
            const message = getStatusMessage(status.progress);

            setState((prev) => ({
              ...prev,
              progress: progressPercent,
              searchProgress: status.progress,
              statusMessage: message,
              // If the spec arrived in a completed poll, grab it
              jsonRenderSpec: status.jsonRenderSpec
                ? (status.jsonRenderSpec as unknown[])
                : prev.jsonRenderSpec,
              results: status.results || prev.results,
            }));
          },
          2000, // poll every 2 s
          90,   // max ~3 min
        );

        if (cancelledRef.current) return;

        // 3. Final update – the last poll should have the spec, but in case
        //    pollSearchStatus resolved with results before the onProgress
        //    callback ran with jsonRenderSpec, we need to fetch one more time.
        //    The pollSearchStatus return value is the results object, so we
        //    check state for the spec.
        setState((prev) => ({
          ...prev,
          results: results || prev.results,
          progress: 100,
          isGenerating: false,
          isComplete: true,
          statusMessage: 'Your itinerary is ready!',
        }));
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
