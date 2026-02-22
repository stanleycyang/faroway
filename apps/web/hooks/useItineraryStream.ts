'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * A json-render block from the SSE stream.
 */
export interface JsonRenderBlock {
  type: string;
  props: Record<string, unknown>;
}

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

export interface ItineraryStreamState {
  /** Accumulated json-render blocks */
  blocks: JsonRenderBlock[];
  /** Overall progress 0-100 */
  progress: number;
  /** Current step name */
  step: string;
  /** Human-readable status message */
  message: string;
  /** Per-agent progress */
  searchProgress: SearchProgress | null;
  /** True while SSE connection is active */
  isStreaming: boolean;
  /** True when all blocks have been received */
  isComplete: boolean;
  /** Error message if something went wrong */
  error: string | null;
}

interface UseItineraryStreamOptions {
  /** Trip ID to stream */
  tripId: string;
  /** Whether to start streaming immediately */
  enabled?: boolean;
  /** Callback when streaming completes */
  onComplete?: (blocks: JsonRenderBlock[]) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * React hook that connects to GET /api/trips/[id]/stream via EventSource
 * and accumulates json-render blocks as they arrive.
 */
export function useItineraryStream(options: UseItineraryStreamOptions): ItineraryStreamState {
  const { tripId, enabled = true, onComplete, onError } = options;

  const [state, setState] = useState<ItineraryStreamState>({
    blocks: [],
    progress: 0,
    step: 'queued',
    message: 'Connecting...',
    searchProgress: null,
    isStreaming: false,
    isComplete: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const blocksRef = useRef<JsonRenderBlock[]>([]);
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
    blocksRef.current = [];

    setState({
      blocks: [],
      progress: 0,
      step: 'connecting',
      message: 'Connecting to generation stream...',
      searchProgress: null,
      isStreaming: true,
      isComplete: false,
      error: null,
    });

    const eventSource = new EventSource(`/api/trips/${tripId}/stream`);
    eventSourceRef.current = eventSource;

    // Handle named events
    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          progress: data.progress ?? prev.progress,
          step: data.step ?? prev.step,
          message: data.message ?? prev.message,
          searchProgress: data.searchProgress ?? prev.searchProgress,
        }));
      } catch (err) {
        console.error('[useItineraryStream] Failed to parse progress event:', err);
      }
    });

    eventSource.addEventListener('block', (event) => {
      try {
        const block = JSON.parse(event.data) as JsonRenderBlock;
        blocksRef.current = [...blocksRef.current, block];
        setState(prev => ({
          ...prev,
          blocks: blocksRef.current,
        }));
      } catch (err) {
        console.error('[useItineraryStream] Failed to parse block event:', err);
      }
    });

    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[useItineraryStream] Stream complete: ${data.blockCount} blocks`);
      } catch {
        // Ignore parse errors on complete
      }

      setState(prev => ({
        ...prev,
        isStreaming: false,
        isComplete: true,
        progress: 100,
        step: 'complete',
        message: 'Your itinerary is ready!',
      }));

      onCompleteRef.current?.(blocksRef.current);
      eventSource.close();
      eventSourceRef.current = null;
    });

    eventSource.addEventListener('error', (event) => {
      // Check if it's an SSE error event with data
      if (event instanceof MessageEvent && event.data) {
        try {
          const data = JSON.parse(event.data);
          const errorMessage = data.message || 'Generation failed';
          setState(prev => ({
            ...prev,
            isStreaming: false,
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
      // EventSource auto-reconnects, but if CLOSED, handle it
      if (eventSource.readyState === EventSource.CLOSED) {
        setState(prev => {
          // If we already completed, don't set error
          if (prev.isComplete) return prev;

          const errorMessage = 'Connection lost during generation';
          onErrorRef.current?.(errorMessage);
          return {
            ...prev,
            isStreaming: false,
            error: errorMessage,
          };
        });
        eventSourceRef.current = null;
      }
    });

    // Also listen for generic 'error' events that come as named events
    eventSource.addEventListener('error', () => {
      // This is the built-in EventSource error handler, already handled above
    });

    return () => {
      cleanup();
    };
  }, [tripId, enabled, cleanup]);

  return state;
}
