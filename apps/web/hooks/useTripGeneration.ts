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

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 2000;

/**
 * React hook that connects to GET /api/trips/[id]/stream via EventSource
 * and accumulates progressive data events for rendering ItineraryDay components.
 *
 * Handles transient connection drops with exponential-backoff reconnect
 * instead of immediately entering the error state.
 */
export function useTripGeneration(options: UseTripGenerationOptions): TripGenerationState {
  const { tripId, enabled = true, onComplete, onError } = options;

  const [state, setState] = useState<TripGenerationState>(initialState);

  const eventSourceRef = useRef<EventSource | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  });

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
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

    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state is part of starting a new EventSource connection
    setState({
      ...initialState,
      isStreaming: true,
      message: 'Connecting to generation stream...',
    });

    reconnectAttemptRef.current = 0;

    function connect() {
      const eventSource = new EventSource(`/api/trips/${tripId}/stream`);
      eventSourceRef.current = eventSource;

      // Reset reconnect counter on successful connection
      eventSource.addEventListener('open', () => {
        reconnectAttemptRef.current = 0;
      });

      // Progress events
      eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data);

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

      // Error event — handles both server-sent errors and connection drops
      eventSource.addEventListener('error', (event) => {
        // Server-sent error event (named SSE event with JSON data)
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
            // Not a JSON error event — fall through to connection error handling
          }
        }

        // Connection drop — attempt reconnect with exponential backoff
        // EventSource auto-reconnect sets readyState to CONNECTING (0).
        // readyState CLOSED (2) means the browser gave up or we called close().
        if (eventSource.readyState === EventSource.CLOSED || eventSource.readyState === EventSource.CONNECTING) {
          eventSource.close();
          eventSourceRef.current = null;

          // Don't reconnect if we already completed
          setState(prev => {
            if (prev.isComplete) return prev;

            const attempt = reconnectAttemptRef.current;
            if (attempt < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttemptRef.current = attempt + 1;
              const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt);
              console.log(`[useTripGeneration] Connection lost, reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);

              reconnectTimerRef.current = setTimeout(() => {
                // Verify we haven't been cleaned up while waiting
                if (eventSourceRef.current === null) {
                  connect();
                }
              }, delay);

              return {
                ...prev,
                message: 'Reconnecting...',
              };
            }

            // All retries exhausted
            const errorMessage = 'Connection lost during generation. Please refresh to check your itinerary.';
            onErrorRef.current?.(errorMessage);
            return {
              ...prev,
              isStreaming: false,
              phase: 'error',
              error: errorMessage,
            };
          });
        }
      });
    }

    connect();

    return () => {
      cleanup();
    };
  }, [tripId, enabled, cleanup]);

  return state;
}
