import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../constants/api';
import { getAuthHeaders } from '../lib/supabase';

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
  /** Distinguishes reconnectable incomplete streams from hard failures. */
  errorKind: 'incomplete' | 'unauthorized' | 'failed' | null;
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
  /** Transport count from transport agent */
  transportCount: number;
  /** Hotel result count from the hotels agent (omit UI when 0) */
  hotelsCount: number;
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
    originCity?: string;
    originAirport?: string;
    vibes: string[];
    budget?: string;
  };
  streamingEnabled?: boolean;
  /**
   * Bump this value to force the hook to re-run its effect (e.g. on retry).
   * Included in the effect's dependency array; the value itself is not used.
   */
  retryKey?: number;
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
  errorKind: null,
  progress: 0,
  step: 'queued',
  message: 'Getting your trip started...',
  searchProgress: null,
  topHotel: null,
  activitiesCount: 0,
  diningCount: 0,
  transportCount: 0,
  hotelsCount: 0,
  days: null,
  microProgress: null,
  microHistory: [],
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function extractApiErrorMessage(body: string, fallback: string): string {
  const trimmed = body.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed);
    if (isObjectRecord(parsed)) {
      const error = parsed.error;
      if (typeof error === 'string' && error.trim()) {
        return error.trim();
      }

      const message = parsed.message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }
  } catch {
    // Plain-text responses are handled below.
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('<!doctype') || lower.startsWith('<html')) {
    return fallback;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}

async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => '');
  return extractApiErrorMessage(text, fallback);
}

function getTripIdFromCreateResponse(payload: unknown): string | null {
  if (!isObjectRecord(payload)) return null;
  const trip = payload.trip;
  if (!isObjectRecord(trip)) return null;
  return typeof trip.id === 'string' && trip.id.trim() ? trip.id : null;
}

export function getIncompleteStreamMessage(message: string): string {
  if (message.toLowerCase().includes('still generating')) {
    return 'Faroway is still planning in the background. Reconnect for updates.';
  }

  return 'The connection closed before your itinerary was ready. Reconnect to continue planning.';
}

export function isUnauthorizedStatus(status: number): boolean {
  return status === 401;
}

export const UNAUTHORIZED_GENERATE_MESSAGE = 'Sign in to generate your trip';

/**
 * Parse SSE events from a text buffer.
 * Returns array of { type, data } objects and remaining unparsed buffer.
 */
export function parseSSEBuffer(buffer: string): {
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

export function parseStreamingJson(rawData: string): unknown | null {
  try {
    return JSON.parse(rawData);
  } catch {
    return null;
  }
}

interface StreamingEventData {
  stage?: string;
  step?: string;
  progress?: number;
  message?: string;
  detail?: string;
  searchProgress?: Record<string, string>;
  topHotel?: Record<string, unknown> | null;
  count?: number;
  days?: unknown[];
  blocks?: StreamingBlock[];
  spec?: StreamingBlock[];
}

function isStreamingEventData(value: unknown): value is StreamingEventData {
  return value !== null && typeof value === 'object';
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
 *   - event: transport    — { count }
 *   - event: itinerary    — { days, topHotel }
 *   - event: spec-block   — { blocks: StreamingBlock[] }
 *   - event: spec-complete— { spec: StreamingBlock[] }
 *   - event: complete     — { tripId }
 *   - event: error        — { message }
 */
export function useStreamingItinerary(options: UseStreamingItineraryOptions): StreamingState {
  const {
    tripId: providedTripId,
    input,
    streamingEnabled = process.env.EXPO_PUBLIC_ITINERARY_STREAMING_ENABLED !== 'false',
    retryKey,
    onComplete,
    onError,
  } = options;

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
    const data = parseStreamingJson(rawData);
    if (!isStreamingEventData(data)) {
      console.error(`[useStreamingItinerary] Failed to parse ${type} event`);
      return;
    }

    try {
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
            hotelsCount: data.count ?? prev.hotelsCount,
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

        case 'transport':
          setState((prev) => ({
            ...prev,
            transportCount: data.count ?? prev.transportCount,
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
          const errorMessage = data.message ?? 'Generation failed';
          setState((prev) => ({
            ...prev,
            error: errorMessage,
            errorKind: 'failed',
            isStreaming: false,
            isLoading: false,
          }));
          onErrorRef.current?.(new Error(errorMessage));
          break;
        }

        case 'micro': {
          if (typeof data.stage !== 'string' || typeof data.message !== 'string') {
            break;
          }

          const micro: MicroProgress = {
            stage: data.stage,
            message: data.message,
            detail: data.detail,
          };
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

  // Stable serialized key for input object — avoids inline expression in deps array
  const inputKey = useMemo(() => JSON.stringify(input), [input]);

  useEffect(() => {
    if (!providedTripId && !input) {
      return;
    }

    const abortController = new AbortController();
    let sseBuffer = '';

    setState({
      ...initialState,
      isLoading: true,
      message: 'Getting your trip started...',
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

        // If no tripId, create a trip and trigger generation first.
        // All three endpoints below now require Supabase bearer auth.
        if (!streamTripId && input) {
          const createHeaders = await getAuthHeaders();
          const tripRes = await fetch(`${API_BASE_URL}/api/trips`, {
            method: 'POST',
            headers: createHeaders,
            body: JSON.stringify({
              destination: input.destination,
              start_date: input.startDate,
              end_date: input.endDate,
              travelers: input.travelers,
              budget: input.budget || 'moderate',
              preferences: {
                travelerType: input.travelerType,
                originCity: input.originCity,
                originAirport: input.originAirport,
                vibes: input.vibes,
              },
            }),
            signal: abortController.signal,
          });

          if (!tripRes.ok) {
            if (isUnauthorizedStatus(tripRes.status)) {
              throw Object.assign(new Error(UNAUTHORIZED_GENERATE_MESSAGE), {
                status: 401,
              });
            }
            throw new Error(await readApiErrorMessage(tripRes, 'Failed to create trip'));
          }

          const createPayload = await tripRes.json().catch(() => null);
          const createdTripId = getTripIdFromCreateResponse(createPayload);
          if (!createdTripId) {
            throw new Error('Trip was created, but the server response was incomplete.');
          }
          streamTripId = createdTripId;

          const genHeaders = await getAuthHeaders();
          const genRes = await fetch(`${API_BASE_URL}/api/trips/${streamTripId}/generate`, {
            method: 'POST',
            headers: genHeaders,
            signal: abortController.signal,
          });

          if (!genRes.ok && genRes.status !== 409) {
            if (isUnauthorizedStatus(genRes.status)) {
              throw Object.assign(new Error(UNAUTHORIZED_GENERATE_MESSAGE), {
                status: 401,
              });
            }
            throw new Error(await readApiErrorMessage(genRes, 'Failed to start generation'));
          }
        }

        if (!streamTripId) {
          throw new Error('No trip ID available');
        }

        setState((prev) => ({
          ...prev,
          tripId: streamTripId,
          isLoading: false,
          isStreaming: streamingEnabled,
        }));

        if (!streamingEnabled) {
          await pollGenerationStatus(streamTripId, abortController.signal, (progress) =>
            setState((prev) => ({ ...prev, ...progress }))
          );
          onCompleteRef.current?.(blocksRef.current);
          return;
        }

        // Use XMLHttpRequest for React Native (supports onprogress for incremental data)
        // This is more reliable than fetch for SSE in React Native
        const streamUrl = `${API_BASE_URL}/api/trips/${streamTripId}/stream`;
        const streamHeaders = await getAuthHeaders();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;

          xhr.open('POST', streamUrl, true);
          xhr.setRequestHeader('Accept', 'text/event-stream');
          xhr.setRequestHeader('Cache-Control', 'no-cache');
          if (streamHeaders.Authorization) {
            xhr.setRequestHeader('Authorization', streamHeaders.Authorization);
          }

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
            } else if (isUnauthorizedStatus(xhr.status)) {
              reject(
                Object.assign(new Error(UNAUTHORIZED_GENERATE_MESSAGE), { status: 401 })
              );
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
          return {
            ...prev,
            isLoading: false,
            isStreaming: false,
            errorKind: 'incomplete',
            error: getIncompleteStreamMessage(prev.message),
          };
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        if (abortController.signal.aborted) return;

        const msg = (error as Error).message || 'Connection failed';
        const status = (error as { status?: number }).status;
        const errorKind = isUnauthorizedStatus(status ?? 0) ? 'unauthorized' : 'failed';
        console.error('[useStreamingItinerary] Stream error:', msg);

        setState((prev) => {
          if (prev.isComplete) return prev;
          return {
            ...prev,
            isLoading: false,
            isStreaming: false,
            error: msg,
            errorKind,
          };
        });
        if (errorKind !== 'unauthorized') {
          onErrorRef.current?.(new Error(msg));
        }
      }
    })();

    return () => {
      abortController.abort();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providedTripId, processEvent, streamingEnabled, inputKey, retryKey]);

  return state;
}

async function pollGenerationStatus(
  tripId: string,
  signal: AbortSignal,
  update: (
    state: Partial<
      Pick<StreamingState, 'progress' | 'step' | 'message' | 'isComplete' | 'isStreaming'>
    >
  ) => void
) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (signal.aborted) return;

    const pollHeaders = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/generate`, {
      method: 'GET',
      headers: pollHeaders,
      signal,
    });
    if (!response.ok) {
      throw new Error(
        await readApiErrorMessage(response, `Polling failed (HTTP ${response.status})`)
      );
    }

    const data = await response.json();
    update({
      progress: typeof data.progress === 'number' ? data.progress : 0,
      step: data.step || 'running',
      message: data.message || 'Generating...',
    });

    if (data.status === 'completed') {
      update({
        progress: 100,
        step: 'complete',
        message: 'Your itinerary is ready!',
        isComplete: true,
        isStreaming: false,
      });
      return;
    }

    if (data.status === 'failed') {
      throw new Error(data.message || 'Generation failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Generation polling timed out');
}
