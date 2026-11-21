import { requestWithTimeout } from '../services/request';
import { reportedCount, reportedProgress } from '../lib/generationFacts';
import {
  createAndStartTrip,
  GenerationNotStartedError,
  recoverUnstartedTrip,
} from '../services/planningService';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { TravelerRequirements } from '@faroway/types';
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

export type DiscoveryAgent =
  | 'orchestrator'
  | 'hotels'
  | 'activities'
  | 'dining'
  | 'transport'
  | 'enrichment'
  | 'aggregator';

export interface AgentDiscovery {
  id: string;
  agent: DiscoveryAgent;
  headline: string;
  detail?: string;
  badge?: string;
  timestamp: number;
}

const VALID_DISCOVERY_AGENTS = new Set<DiscoveryAgent>([
  'orchestrator',
  'hotels',
  'activities',
  'dining',
  'transport',
  'enrichment',
  'aggregator',
]);

const MAX_DISCOVERIES = 12;

export function mergeAgentDiscoveries(
  existing: AgentDiscovery[],
  incoming: AgentDiscovery | AgentDiscovery[]
): AgentDiscovery[] {
  const list = Array.isArray(incoming) ? incoming : [incoming];
  if (list.length === 0) return existing;

  const byId = new Map<string, AgentDiscovery>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of list) {
    if (!item || !item.id || !item.headline.trim()) continue;
    byId.set(item.id, item);
  }
  const merged = Array.from(byId.values());
  return merged.length > MAX_DISCOVERIES ? merged.slice(-MAX_DISCOVERIES) : merged;
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
  canStart: boolean;
  progress: number;
  step: string;
  message: string;
  searchProgress: Record<string, string> | null;
  /** Top hotel from hotels agent (for display during streaming) */
  topHotel: Record<string, unknown> | null;
  /** Reported hotel count; a preview alone does not establish inventory. */
  hotelsCount: number | undefined;
  /** Activity count from activities agent */
  activitiesCount: number | undefined;
  /** Dining count from dining agent */
  diningCount: number | undefined;
  /** Transport count from transport agent */
  transportCount: number | undefined;
  /** Itinerary days from aggregator */
  days: unknown[] | null;
  /** Micro-progress updates for granular feedback */
  microProgress: MicroProgress | null;
  /** History of micro-progress messages */
  microHistory: MicroProgress[];
  /** Grounded real-time discovery feed emitted by specialist agents */
  discoveries: AgentDiscovery[];
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
    requirements?: TravelerRequirements;
    vibes: string[];
    budget?: string;
  };
  streamingEnabled?: boolean;
  /**
   * Bump this value to force the hook to re-run its effect (e.g. on retry).
   * Included in the effect's dependency array; the value itself is not used.
   */
  retryKey?: number;
  restartUnstarted?: boolean;
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
  canStart: false,
  progress: 0,
  step: 'queued',
  message: 'Connecting...',
  searchProgress: null,
  topHotel: null,
  hotelsCount: undefined,
  activitiesCount: undefined,
  diningCount: undefined,
  transportCount: undefined,
  days: null,
  microProgress: null,
  microHistory: [],
  discoveries: [],
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

export function getIncompleteStreamMessage(message: string): string {
  if (message.toLowerCase().includes('still generating')) {
    return 'Faroway is still planning in the background. Reconnect for updates.';
  }

  return 'The connection closed before your itinerary was ready. Reconnect to continue planning.';
}

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
  id?: string;
  agent?: string;
  headline?: string;
  badge?: string;
  timestamp?: number;
  discoveries?: unknown[];
  discovery?: unknown;
  day?: unknown;
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

function parseAgentDiscovery(raw: unknown): AgentDiscovery | null {
  if (!isObjectRecord(raw)) return null;
  const headline = typeof raw.headline === 'string' ? raw.headline.trim() : '';
  if (!headline) return null;
  const agent =
    typeof raw.agent === 'string' && VALID_DISCOVERY_AGENTS.has(raw.agent as DiscoveryAgent)
      ? (raw.agent as DiscoveryAgent)
      : 'orchestrator';
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `${agent}:${headline.toLowerCase().slice(0, 48)}`;
  return {
    id,
    agent,
    headline,
    detail: typeof raw.detail === 'string' && raw.detail.trim() ? raw.detail.trim() : undefined,
    badge: typeof raw.badge === 'string' && raw.badge.trim() ? raw.badge.trim() : undefined,
    timestamp:
      typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
        ? raw.timestamp
        : Date.now(),
  };
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
    restartUnstarted,
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
            progress: reportedProgress(data.progress) ?? prev.progress,
            step: data.step ?? prev.step,
            message: data.message ?? prev.message,
            searchProgress: data.searchProgress ?? prev.searchProgress,
          }));
          break;
        }

        case 'hotels': {
          const hotelsCount = reportedCount(data.count);
          const hotelName =
            isObjectRecord(data.topHotel) && typeof data.topHotel.name === 'string'
              ? data.topHotel.name.trim()
              : '';
          const synthetic: AgentDiscovery[] = [];
          if (hotelName) {
            synthetic.push({
              id: 'hotels:top-pick',
              agent: 'hotels',
              headline: `Found stay option: ${hotelName}`,
              detail:
                hotelsCount && hotelsCount > 1
                  ? `${hotelsCount} stays compared`
                  : 'Review details before booking',
              badge: 'Stays',
              timestamp: Date.now(),
            });
          } else if (hotelsCount && hotelsCount > 0) {
            synthetic.push({
              id: 'hotels:count',
              agent: 'hotels',
              headline: `Found ${hotelsCount} places to stay`,
              badge: 'Stays',
              timestamp: Date.now(),
            });
          }
          setState((prev) => ({
            ...prev,
            hotelsCount,
            topHotel: data.topHotel ?? prev.topHotel,
            discoveries: mergeAgentDiscoveries(prev.discoveries, synthetic),
          }));
          break;
        }

        case 'activities': {
          const activitiesCount = reportedCount(data.count);
          const synthetic: AgentDiscovery[] =
            activitiesCount && activitiesCount > 0
              ? [
                  {
                    id: 'activities:count',
                    agent: 'activities',
                    headline: `Shortlisted ${activitiesCount} sights & experiences`,
                    badge: 'Explore',
                    timestamp: Date.now(),
                  },
                ]
              : [];
          setState((prev) => ({
            ...prev,
            activitiesCount,
            discoveries: mergeAgentDiscoveries(prev.discoveries, synthetic),
          }));
          break;
        }

        case 'dining': {
          const diningCount = reportedCount(data.count);
          const synthetic: AgentDiscovery[] =
            diningCount && diningCount > 0
              ? [
                  {
                    id: 'dining:count',
                    agent: 'dining',
                    headline: `Selected ${diningCount} dining spots to review`,
                    badge: 'Dining',
                    timestamp: Date.now(),
                  },
                ]
              : [];
          setState((prev) => ({
            ...prev,
            diningCount,
            discoveries: mergeAgentDiscoveries(prev.discoveries, synthetic),
          }));
          break;
        }

        case 'transport': {
          const transportCount = reportedCount(data.count);
          const synthetic: AgentDiscovery[] =
            transportCount && transportCount > 0
              ? [
                  {
                    id: 'transport:count',
                    agent: 'transport',
                    headline: `Checked ${transportCount} transit & route option${transportCount === 1 ? '' : 's'}`,
                    badge: 'Transit',
                    timestamp: Date.now(),
                  },
                ]
              : [];
          setState((prev) => ({
            ...prev,
            transportCount,
            discoveries: mergeAgentDiscoveries(prev.discoveries, synthetic),
          }));
          break;
        }

        case 'day_ready': {
          const readyDay = data.day;
          if (isObjectRecord(readyDay)) {
            const readyDayNumber =
              typeof readyDay.dayNumber === 'number' && readyDay.dayNumber > 0
                ? readyDay.dayNumber
                : 1;
            const title =
              typeof readyDay.title === 'string' && readyDay.title.trim()
                ? readyDay.title.trim()
                : `Day ${readyDayNumber}`;
            setState((prev) => {
              const existingDays = Array.isArray(prev.days) ? [...prev.days] : [];
              const idx = existingDays.findIndex(
                (d) => isObjectRecord(d) && d.dayNumber === readyDayNumber
              );
              if (idx >= 0) existingDays[idx] = readyDay;
              else existingDays.push(readyDay);
              existingDays.sort((a, b) => {
                const an = isObjectRecord(a) && typeof a.dayNumber === 'number' ? a.dayNumber : 99;
                const bn = isObjectRecord(b) && typeof b.dayNumber === 'number' ? b.dayNumber : 99;
                return an - bn;
              });
              return {
                ...prev,
                days: existingDays,
                discoveries: mergeAgentDiscoveries(prev.discoveries, {
                  id: `aggregator:day-${readyDayNumber}`,
                  agent: 'aggregator',
                  headline: `Day ${readyDayNumber} ready: ${title}`,
                  badge: `Day ${readyDayNumber}`,
                  timestamp: Date.now(),
                }),
              };
            });
          }
          break;
        }

        case 'itinerary': {
          const incomingDays = Array.isArray(data.days) ? data.days : null;
          const firstDay =
            incomingDays && incomingDays.length > 0 && isObjectRecord(incomingDays[0])
              ? incomingDays[0]
              : null;
          const synthetic: AgentDiscovery[] = firstDay
            ? [
                {
                  id: 'aggregator:day-1',
                  agent: 'aggregator',
                  headline:
                    typeof firstDay.title === 'string' && firstDay.title.trim()
                      ? `Day 1 ready: ${firstDay.title.trim()}`
                      : `Drafted ${incomingDays!.length}-day schedule`,
                  badge: 'Itinerary',
                  timestamp: Date.now(),
                },
              ]
            : [];
          setState((prev) => ({
            ...prev,
            days: incomingDays ?? prev.days,
            topHotel: data.topHotel ?? prev.topHotel,
            discoveries: mergeAgentDiscoveries(prev.discoveries, synthetic),
          }));
          break;
        }

        case 'discovery': {
          const incoming: AgentDiscovery[] = [];
          const direct = parseAgentDiscovery(data);
          if (direct) incoming.push(direct);
          if (data.discovery) {
            const nested = parseAgentDiscovery(data.discovery);
            if (nested) incoming.push(nested);
          }
          if (Array.isArray(data.discoveries)) {
            for (const entry of data.discoveries) {
              const parsed = parseAgentDiscovery(entry);
              if (parsed) incoming.push(parsed);
            }
          }
          if (incoming.length > 0) {
            setState((prev) => ({
              ...prev,
              discoveries: mergeAgentDiscoveries(prev.discoveries, incoming),
            }));
          }
          break;
        }

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
        if (streamTripId && restartUnstarted)
          await recoverUnstartedTrip(streamTripId, abortController.signal);

        // If no tripId, create a trip and trigger generation first.
        // All three endpoints below now require Supabase bearer auth.
        if (!streamTripId && input) {
          streamTripId = await createAndStartTrip(
            input,
            (id) => {
              // Preserve the receipt even if generation dispatch is interrupted.
              if (!abortController.signal.aborted) setState((prev) => ({ ...prev, tripId: id }));
            },
            abortController.signal
          );
        }

        if (abortController.signal.aborted) return;
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
          if (!abortController.signal.aborted) onCompleteRef.current?.(blocksRef.current);
          return;
        }

        // Use XMLHttpRequest for React Native (supports onprogress for incremental data)
        // This is more reliable than fetch for SSE in React Native
        const streamUrl = `${API_BASE_URL}/api/trips/${streamTripId}/stream`;
        const streamHeaders = await getAuthHeaders();
        if (abortController.signal.aborted) return;

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
            if (abortController.signal.aborted) return;
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
            if (abortController.signal.aborted) {
              reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
              return;
            }
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
              reject(
                new Error(
                  xhr.status === 401
                    ? 'Sign in again to reconnect to your saved trip. Planning may still be running.'
                    : extractApiErrorMessage(
                        xhr.responseText || '',
                        `Stream failed (HTTP ${xhr.status})`
                      )
                )
              );
            }
          };

          xhr.onabort = () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));

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
            error: getIncompleteStreamMessage(prev.message),
          };
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
            canStart: error instanceof GenerationNotStartedError,
          };
        });
        onErrorRef.current?.(new Error(msg));
      }
    })();

    return () => {
      abortController.abort();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providedTripId, processEvent, streamingEnabled, inputKey, retryKey, restartUnstarted]);

  return state;
}

export async function pollGenerationStatus(
  tripId: string,
  signal: AbortSignal,
  update: (
    state: Partial<
      Pick<StreamingState, 'progress' | 'step' | 'message' | 'isComplete' | 'isStreaming'>
    >
  ) => void
) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });

    const pollHeaders = await getAuthHeaders();
    const data = await requestWithTimeout(
      `${API_BASE_URL}/api/trips/${tripId}/generate`,
      { method: 'GET', headers: pollHeaders, signal },
      async (response) => {
        if (!response.ok)
          throw new Error(
            await readApiErrorMessage(response, `Polling failed (HTTP ${response.status})`)
          );
        return response.json();
      },
      15_000
    );
    update({
      progress: reportedProgress(data.progress) ?? 0,
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

    await new Promise<void>((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer);
        reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', cancel);
        resolve();
      }, 2000);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
  }

  throw new Error('Generation polling timed out');
}
