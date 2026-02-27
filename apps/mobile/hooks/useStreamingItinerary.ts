import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/api';

export interface StreamingBlock {
  type: string;
  props: Record<string, unknown>;
}

export interface MicroProgress {
  stage: string;
  message: string;
  detail?: string;
}

export interface StreamingState {
  /** Accumulated json-render blocks (grows progressively as spec-block events arrive) */
  blocks: StreamingBlock[];
  /** The full json-render document (set to accumulated blocks, finalized on spec-complete) */
  document: StreamingBlock[] | null;
  /** Trip ID for the created/streaming trip */
  tripId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  progress: number;
  step: string;
  message: string;
  searchProgress: Record<string, string> | null;
  /** Top hotel from hotels agent (for display during streaming) */
  topHotel: Record<string, unknown> | null;
  /** Activity count from activities agent */
  activitiesCount: number;
  /** Dining count from dining agent */
  diningCount: number;
  /** Itinerary days from aggregator */
  days: unknown[] | null;
  /** Micro-progress updates for granular feedback */
  microProgress: MicroProgress | null;
  /** History of micro-progress messages */
  microHistory: MicroProgress[];
}

export interface UseStreamingItineraryOptions {
  /** Trip ID to stream from the unified endpoint (if already created) */
  tripId?: string;
  /** Input to create a new trip + trigger generation (if no tripId) */
  input?: {
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    travelerType: string;
    vibes: string[];
    budget?: string;
  };
  onComplete?: (document: StreamingBlock[]) => void;
  onError?: (error: Error) => void;
}

const initialState: StreamingState = {
  blocks: [],
  document: null,
  tripId: null,
  isLoading: false,
  isStreaming: false,
  isComplete: false,
  error: null,
  progress: 0,
  step: 'queued',
  message: 'Connecting...',
  searchProgress: null,
  topHotel: null,
  activitiesCount: 0,
  diningCount: 0,
  days: null,
  microProgress: null,
  microHistory: [],
};

/**
 * Parse SSE events from a text buffer.
 * Returns array of { type, data } objects and remaining unparsed buffer.
 */
function parseSSEBuffer(buffer: string): {
  events: Array<{ type: string; data: string }>;
  remaining: string;
} {
  const events: Array<{ type: string; data: string }> = [];
  const blocks = buffer.split('\n\n');
  const remaining = blocks.pop() || '';

  for (const block of blocks) {
    if (!block.trim()) continue;

    let eventType = 'message';
    let eventData = '';

    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        eventData += (eventData ? '\n' : '') + line.slice(6);
      }
    }

    if (eventType && eventData) {
      events.push({ type: eventType, data: eventData });
    }
  }

  return { events, remaining };
}

/**
 * Hook to stream itinerary generation using the unified SSE endpoint with POST.
 *
 * Uses XMLHttpRequest for React Native (supports onprogress for incremental data)
 * and fetch + ReadableStream for web.
 *
 * SSE event protocol:
 *   - event: progress     — { step, status, progress, message, searchProgress }
 *   - event: hotels       — { topHotel, count }
 *   - event: activities   — { count }
 *   - event: dining       — { count }
 *   - event: itinerary    — { days, topHotel }
 *   - event: spec-block   — { blocks: StreamingBlock[] }
 *   - event: spec-complete— { spec: StreamingBlock[] }
 *   - event: complete     — { tripId }
 *   - event: error        — { message }
 */
export function useStreamingItinerary(options: UseStreamingItineraryOptions): StreamingState {
  const { tripId: providedTripId, input, onComplete, onError } = options;

  const [state, setState] = useState<StreamingState>(initialState);

  const blocksRef = useRef<StreamingBlock[]>([]);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const processedLengthRef = useRef(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  });

  const processEvent = useCallback((type: string, rawData: string) => {
    try {
      const data = JSON.parse(rawData);

      switch (type) {
        case 'progress': {
          setState((prev) => ({
            ...prev,
            progress: data.progress ?? prev.progress,
            step: data.step ?? prev.step,
            message: data.message ?? prev.message,
            searchProgress: data.searchProgress ?? prev.searchProgress,
          }));
          break;
        }

        case 'hotels':
          setState((prev) => ({
            ...prev,
            topHotel: data.topHotel ?? prev.topHotel,
          }));
          break;

        case 'activities':
          setState((prev) => ({
            ...prev,
            activitiesCount: data.count ?? prev.activitiesCount,
          }));
          break;

        case 'dining':
          setState((prev) => ({
            ...prev,
            diningCount: data.count ?? prev.diningCount,
          }));
          break;

        case 'itinerary':
          setState((prev) => ({
            ...prev,
            days: data.days ?? prev.days,
            topHotel: data.topHotel ?? prev.topHotel,
          }));
          break;

        case 'spec-block': {
          const newBlocks = data.blocks as StreamingBlock[];
          if (Array.isArray(newBlocks) && newBlocks.length > 0) {
            blocksRef.current = [...blocksRef.current, ...newBlocks];
            setState((prev) => ({
              ...prev,
              blocks: blocksRef.current,
              document: blocksRef.current,
            }));
          }
          break;
        }

        case 'spec-complete': {
          const fullSpec = data.spec as StreamingBlock[];
          if (Array.isArray(fullSpec)) {
            blocksRef.current = fullSpec;
            setState((prev) => ({
              ...prev,
              blocks: fullSpec,
              document: fullSpec,
            }));
          }
          break;
        }

        case 'complete': {
          const finalDocument = blocksRef.current;
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            isComplete: true,
            progress: 100,
            step: 'complete',
            message: 'Your itinerary is ready!',
          }));
          onCompleteRef.current?.(finalDocument);
          break;
        }

        case 'error': {
          const errorMessage = data.message || 'Generation failed';
          setState((prev) => ({
            ...prev,
            error: errorMessage,
            isStreaming: false,
            isLoading: false,
          }));
          onErrorRef.current?.(new Error(errorMessage));
          break;
        }

        case 'micro': {
          const micro = data as MicroProgress;
          setState((prev) => ({
            ...prev,
            microProgress: micro,
            microHistory: [...prev.microHistory.slice(-9), micro], // Keep last 10
          }));
          break;
        }
      }
    } catch (err) {
      console.error(`[useStreamingItinerary] Failed to parse ${type} event:`, err);
    }
  }, []);

  useEffect(() => {
    if (!providedTripId && !input) {
      return;
    }

    const abortController = new AbortController();
    let sseBuffer = '';

    setState({
      ...initialState,
      isLoading: true,
      message: 'Starting trip generation...',
    });
    blocksRef.current = [];
    processedLengthRef.current = 0;

    const cleanup = () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
    };

    (async () => {
      try {
        let streamTripId = providedTripId;

        // If no tripId, create a trip and trigger generation first
        if (!streamTripId && input) {
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
            signal: abortController.signal,
          });

          if (!tripRes.ok) {
            const text = await tripRes.text().catch(() => '');
            throw new Error(text || 'Failed to create trip');
          }

          const { trip } = await tripRes.json();
          streamTripId = trip.id;

          // Trigger generation
          const genRes = await fetch(`${API_BASE_URL}/api/trips/${streamTripId}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortController.signal,
          });

          if (!genRes.ok && genRes.status !== 409) {
            const text = await genRes.text().catch(() => '');
            throw new Error(text || 'Failed to start generation');
          }
        }

        if (!streamTripId) {
          throw new Error('No trip ID available');
        }

        setState((prev) => ({
          ...prev,
          tripId: streamTripId,
          isLoading: false,
          isStreaming: true,
        }));

        // Use XMLHttpRequest for React Native (supports onprogress for incremental data)
        // This is more reliable than fetch for SSE in React Native
        const streamUrl = `${API_BASE_URL}/api/trips/${streamTripId}/stream`;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;

          xhr.open('POST', streamUrl, true);
          xhr.setRequestHeader('Accept', 'text/event-stream');
          xhr.setRequestHeader('Cache-Control', 'no-cache');

          // Process incremental data as it arrives
          xhr.onprogress = () => {
            if (xhr.readyState >= 3 && xhr.responseText) {
              // Get only the new data since last progress event
              const newData = xhr.responseText.substring(processedLengthRef.current);
              processedLengthRef.current = xhr.responseText.length;

              if (newData) {
                sseBuffer += newData;
                const { events, remaining } = parseSSEBuffer(sseBuffer);
                sseBuffer = remaining;

                for (const event of events) {
                  processEvent(event.type, event.data);
                }
              }
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              // Process any remaining data in buffer
              if (sseBuffer.trim()) {
                const { events } = parseSSEBuffer(sseBuffer + '\n\n');
                for (const event of events) {
                  processEvent(event.type, event.data);
                }
              }
              resolve();
            } else {
              reject(new Error(`Stream failed (HTTP ${xhr.status})`));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Network error during streaming'));
          };

          xhr.ontimeout = () => {
            reject(new Error('Stream timed out'));
          };

          // Set a long timeout for the generation process (5 minutes)
          xhr.timeout = 300000;

          xhr.send(null);
        });

        // Stream ended naturally
        setState((prev) => {
          if (prev.isComplete || prev.error) return prev;
          return { ...prev, isStreaming: false };
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        if (abortController.signal.aborted) return;

        const msg = (error as Error).message || 'Connection failed';
        console.error('[useStreamingItinerary] Stream error:', msg);

        setState((prev) => {
          if (prev.isComplete) return prev;
          return {
            ...prev,
            isLoading: false,
            isStreaming: false,
            error: msg,
          };
        });
        onErrorRef.current?.(new Error(msg));
      }
    })();

    return () => {
      abortController.abort();
      cleanup();
    };
  }, [providedTripId, processEvent, JSON.stringify(input)]);

  return state;
}
