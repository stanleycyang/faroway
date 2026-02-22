import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../constants/api';

export interface StreamingBlock {
  type: string;
  props: Record<string, unknown>;
}

export interface StreamingState {
  /** Accumulated json-render blocks */
  blocks: StreamingBlock[];
  /** The full json-render document (set on complete) */
  document: any | null;
  isLoading: boolean;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  progress: number; // 0-100
  step: string;
  message: string;
  searchProgress: Record<string, string> | null;
}

export interface UseStreamingItineraryOptions {
  /** Trip ID to stream from the unified endpoint */
  tripId?: string;
  /** Legacy: search ID — will be converted to trip-based flow */
  searchId?: string;
  /** Input to create a new trip + trigger generation (if no tripId/searchId) */
  input?: {
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    travelerType: string;
    vibes: string[];
    budget?: string;
  };
  onComplete?: (document: any) => void;
  onError?: (error: Error) => void;
  fallbackToPoll?: boolean;
}

/**
 * Hook to stream itinerary generation using the unified SSE endpoint.
 *
 * Connects to GET /api/trips/[id]/stream and parses the shared SSE event protocol:
 *   - event: progress — { step, status, progress, message, searchProgress }
 *   - event: block    — { type, props }
 *   - event: complete — { tripId, blockCount }
 *   - event: error    — { message }
 */
export function useStreamingItinerary(options: UseStreamingItineraryOptions): StreamingState {
  const {
    tripId,
    input,
    onComplete,
    onError,
  } = options;

  const [state, setState] = useState<StreamingState>({
    blocks: [],
    document: null,
    isLoading: false,
    isStreaming: false,
    isComplete: false,
    error: null,
    progress: 0,
    step: 'queued',
    message: 'Connecting...',
    searchProgress: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const blocksRef = useRef<StreamingBlock[]>([]);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!tripId && !input) {
      return;
    }

    const startStreaming = async () => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          isStreaming: false,
          error: null,
          blocks: [],
          progress: 0,
        }));

        blocksRef.current = [];
        let streamTripId = tripId;

        // If no tripId, create a trip and trigger generation first
        if (!streamTripId && input) {
          // Create trip
          const tripRes = await fetch(`${API_BASE_URL}/api/trips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

          if (!tripRes.ok) {
            throw new Error('Failed to create trip');
          }

          const { trip } = await tripRes.json();
          streamTripId = trip.id;

          // Trigger generation
          const genRes = await fetch(`${API_BASE_URL}/api/trips/${streamTripId}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!genRes.ok && genRes.status !== 409) {
            throw new Error('Failed to start generation');
          }
        }

        if (!streamTripId) {
          throw new Error('No trip ID available');
        }

        // Check if EventSource is supported (not available in all RN environments)
        if (typeof EventSource === 'undefined') {
          console.warn('[useStreamingItinerary] EventSource not supported');
          throw new Error('Streaming not supported on this platform');
        }

        // Connect to the unified SSE endpoint
        const streamUrl = `${API_BASE_URL}/api/trips/${streamTripId}/stream`;
        const eventSource = new EventSource(streamUrl);
        eventSourceRef.current = eventSource;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isStreaming: true,
        }));

        // Handle progress events
        eventSource.addEventListener('progress', (event: any) => {
          try {
            const data = JSON.parse(event.data);
            setState((prev) => ({
              ...prev,
              progress: data.progress ?? prev.progress,
              step: data.step ?? prev.step,
              message: data.message ?? prev.message,
              searchProgress: data.searchProgress ?? prev.searchProgress,
            }));
          } catch (err) {
            console.error('[useStreamingItinerary] Failed to parse progress:', err);
          }
        });

        // Handle block events
        eventSource.addEventListener('block', (event: any) => {
          try {
            const block = JSON.parse(event.data) as StreamingBlock;
            blocksRef.current = [...blocksRef.current, block];
            setState((prev) => ({
              ...prev,
              blocks: blocksRef.current,
              // Also build document as array of blocks
              document: blocksRef.current,
            }));
          } catch (err) {
            console.error('[useStreamingItinerary] Failed to parse block:', err);
          }
        });

        // Handle complete event
        eventSource.addEventListener('complete', (event: any) => {
          const finalDocument = blocksRef.current;

          setState((prev) => ({
            ...prev,
            document: finalDocument,
            isStreaming: false,
            isComplete: true,
            progress: 100,
            step: 'complete',
            message: 'Your itinerary is ready!',
          }));

          eventSource.close();
          eventSourceRef.current = null;

          onCompleteRef.current?.(finalDocument);
        });

        // Handle error events
        eventSource.addEventListener('error', (event: any) => {
          if (event instanceof MessageEvent && event.data) {
            try {
              const data = JSON.parse(event.data);
              const errorMessage = data.message || 'Generation failed';
              setState((prev) => ({
                ...prev,
                error: errorMessage,
                isStreaming: false,
                isLoading: false,
              }));
              onErrorRef.current?.(new Error(errorMessage));
              eventSource.close();
              eventSourceRef.current = null;
              return;
            } catch {
              // Not a JSON error event
            }
          }

          // Generic connection error
          if (eventSource.readyState === EventSource.CLOSED) {
            setState((prev) => {
              if (prev.isComplete) return prev;
              const errorMessage = 'Connection lost during streaming';
              onErrorRef.current?.(new Error(errorMessage));
              return {
                ...prev,
                error: errorMessage,
                isStreaming: false,
                isLoading: false,
              };
            });
            eventSourceRef.current = null;
          }
        });
      } catch (error) {
        console.error('[useStreamingItinerary] Failed to start streaming:', error);

        const errorMessage = error instanceof Error ? error.message : 'Failed to start streaming';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          isStreaming: false,
        }));

        onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to start streaming'));
      }
    };

    startStreaming();

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, JSON.stringify(input)]);

  return state;
}
