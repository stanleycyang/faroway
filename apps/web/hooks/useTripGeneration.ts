'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TripDay, HotelResult } from '@tripgenie/types';

/**
 * Search progress from the backend (per-agent status).
 */
export interface SearchProgress {
  [key: string]: string | undefined;
  orchestrator?: string;
  hotels?: string;
  activities?: string;
  dining?: string;
  aggregator?: string;
}

export interface TripGenerationState {
  // Progress
  phase: 'connecting' | 'orchestrator' | 'searching' | 'composing' | 'complete' | 'error';
  progress: number;
  message: string;
  searchProgress: SearchProgress | null;

  // Progressive data
  topHotel: HotelResult | null;
  activitiesCount: number;
  diningCount: number;
  days: TripDay[] | null;

  // Status
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
}

interface UseTripGenerationOptions {
  /** Trip ID to stream */
  tripId: string;
  /** Whether to start streaming immediately */
  enabled?: boolean;
  /** Callback when streaming completes */
  onComplete?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

const initialState: TripGenerationState = {
  phase: 'connecting',
  progress: 0,
  message: 'Connecting...',
  searchProgress: null,
  topHotel: null,
  activitiesCount: 0,
  diningCount: 0,
  days: null,
  isStreaming: false,
  isComplete: false,
  error: null,
};

/**
 * React hook that connects to GET /api/trips/[id]/stream via EventSource
 * and accumulates progressive data events for rendering ItineraryDay components.
 */
export function useTripGeneration(options: UseTripGenerationOptions): TripGenerationState {
  const { tripId, enabled = true, onComplete, onError } = options;

  const [state, setState] = useState<TripGenerationState>(initialState);

  const eventSourceRef = useRef<EventSource | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !tripId) {
      return;
    }

    cleanup();

    setState({
      ...initialState,
      isStreaming: true,
      message: 'Connecting to generation stream...',
    });

    const eventSource = new EventSource(`/api/trips/${tripId}/stream`);
    eventSourceRef.current = eventSource;

    // Progress events
    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);

        // Map step to phase
        let phase: TripGenerationState['phase'] = 'searching';
        if (data.step === 'orchestrator') phase = 'orchestrator';
        else if (data.step === 'aggregator') phase = 'composing';
        else if (data.step === 'complete') phase = 'complete';

        setState(prev => ({
          ...prev,
          phase,
          progress: data.progress ?? prev.progress,
          message: data.message ?? prev.message,
          searchProgress: data.searchProgress ?? prev.searchProgress,
        }));
      } catch (err) {
        console.error('[useTripGeneration] Failed to parse progress event:', err);
      }
    });

    // Hotels event
    eventSource.addEventListener('hotels', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          topHotel: data.topHotel ?? prev.topHotel,
        }));
      } catch (err) {
        console.error('[useTripGeneration] Failed to parse hotels event:', err);
      }
    });

    // Activities event
    eventSource.addEventListener('activities', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          activitiesCount: data.count ?? prev.activitiesCount,
        }));
      } catch (err) {
        console.error('[useTripGeneration] Failed to parse activities event:', err);
      }
    });

    // Dining event
    eventSource.addEventListener('dining', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          diningCount: data.count ?? prev.diningCount,
        }));
      } catch (err) {
        console.error('[useTripGeneration] Failed to parse dining event:', err);
      }
    });

    // Itinerary event (aggregator done)
    eventSource.addEventListener('itinerary', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          days: data.days ?? prev.days,
          topHotel: data.topHotel ?? prev.topHotel,
        }));
      } catch (err) {
        console.error('[useTripGeneration] Failed to parse itinerary event:', err);
      }
    });

    // Complete event
    eventSource.addEventListener('complete', () => {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        isComplete: true,
        phase: 'complete',
        progress: 100,
        message: 'Your itinerary is ready!',
      }));

      onCompleteRef.current?.();
      eventSource.close();
      eventSourceRef.current = null;
    });

    // Error event
    eventSource.addEventListener('error', (event) => {
      // Check if it's an SSE error event with data
      if (event instanceof MessageEvent && event.data) {
        try {
          const data = JSON.parse(event.data);
          const errorMessage = data.message || 'Generation failed';
          setState(prev => ({
            ...prev,
            isStreaming: false,
            phase: 'error',
            error: errorMessage,
          }));
          onErrorRef.current?.(errorMessage);
          eventSource.close();
          eventSourceRef.current = null;
          return;
        } catch {
          // Not a JSON error event
        }
      }

      // Generic EventSource connection error
      if (eventSource.readyState === EventSource.CLOSED) {
        setState(prev => {
          if (prev.isComplete) return prev;

          const errorMessage = 'Connection lost during generation';
          onErrorRef.current?.(errorMessage);
          return {
            ...prev,
            isStreaming: false,
            phase: 'error',
            error: errorMessage,
          };
        });
        eventSourceRef.current = null;
      }
    });

    return () => {
      cleanup();
    };
  }, [tripId, enabled, cleanup]);

  return state;
}
