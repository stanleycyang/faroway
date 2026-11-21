"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TripDay, HotelResult } from "@faroway/types";
import {
  extractAgentDiscoveries,
  isDiscoveryAgent,
  mergeDiscoveries,
  normalizeAgentDiscovery,
  type AgentDiscovery,
} from "@/lib/trips/streaming-dossier";

export type { AgentDiscovery } from "@/lib/trips/streaming-dossier";

export interface SearchProgress {
  [key: string]: string | undefined;
  orchestrator?: string;
  hotels?: string;
  activities?: string;
  dining?: string;
  transport?: string;
  enrichment?: string;
  aggregator?: string;
}

export interface StreamingSpecBlock {
  type: string;
  props?: Record<string, unknown>;
}

export interface TripGenerationState {
  phase:
    | "connecting"
    | "orchestrator"
    | "searching"
    | "composing"
    | "complete"
    | "error";
  progress: number;
  message: string;
  searchProgress: SearchProgress | null;

  topHotel: HotelResult | null;
  activitiesCount: number;
  diningCount: number;
  transportCount: number;
  days: TripDay[] | null;
  specBlocks: StreamingSpecBlock[];
  discoveries?: AgentDiscovery[];

  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
}

interface UseTripGenerationOptions {
  tripId: string;
  generationId?: string | null;
  enabled?: boolean;
  completed?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const initialState: TripGenerationState = {
  phase: "connecting",
  progress: 0,
  message: "Connecting...",
  searchProgress: null,
  topHotel: null,
  activitiesCount: 0,
  diningCount: 0,
  transportCount: 0,
  days: null,
  specBlocks: [],
  discoveries: [],
  isStreaming: false,
  isComplete: false,
  error: null,
};

export const ITINERARY_STREAMING_ENABLED =
  process.env.NEXT_PUBLIC_ITINERARY_STREAMING_ENABLED !== "false";

export function reconcileInactiveGeneration(
  state: TripGenerationState,
  completed: boolean,
): TripGenerationState {
  const discoveries = state.discoveries ?? [];
  if (completed) {
    return {
      ...state,
      discoveries,
      phase: "complete",
      progress: 100,
      message: "Your itinerary is ready!",
      isStreaming: false,
      isComplete: true,
      error: null,
    };
  }

  if (!state.isStreaming && state.error === null) return state;

  return {
    ...state,
    discoveries,
    phase: state.phase === "error" ? "connecting" : state.phase,
    isStreaming: false,
    error: null,
  };
}

export function parseStreamingJson(rawData: string): unknown | null {
  try {
    return JSON.parse(rawData);
  } catch {
    return null;
  }
}

interface StreamingEventData {
  chapter?: string;
  step?: string;
  agent?: string;
  id?: string;
  headline?: string;
  detail?: string;
  badge?: string;
  timestamp?: number;
  progress?: number;
  message?: string;
  searchProgress?: SearchProgress;
  topHotel?: HotelResult | null;
  hotel?: HotelResult | null;
  count?: number;
  day?: TripDay;
  days?: TripDay[];
  blocks?: StreamingSpecBlock[];
  spec?: StreamingSpecBlock[];
  discovery?: unknown;
  discoveries?: unknown[];
}

function isStreamingEventData(value: unknown): value is StreamingEventData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (
    data.chapter != null &&
    (typeof data.chapter !== "string" || !data.chapter.trim())
  )
    return false;
  if (data.message != null && typeof data.message !== "string") return false;
  if (data.step != null && typeof data.step !== "string") return false;
  if (data.agent != null && typeof data.agent !== "string") return false;
  if (
    data.progress != null &&
    (typeof data.progress !== "number" ||
      !Number.isFinite(data.progress) ||
      data.progress < 0 ||
      data.progress > 100)
  )
    return false;
  if (
    data.count != null &&
    (typeof data.count !== "number" ||
      !Number.isSafeInteger(data.count) ||
      data.count < 0)
  )
    return false;
  if (
    data.searchProgress != null &&
    (typeof data.searchProgress !== "object" ||
      Array.isArray(data.searchProgress) ||
      !Object.values(data.searchProgress).every(
        (status) => typeof status === "string",
      ))
  )
    return false;
  for (const key of ["days", "blocks", "spec", "discoveries"]) {
    if (data[key] != null && !Array.isArray(data[key])) return false;
  }
  return true;
}

function mergeProgressiveDays(
  existing: TripDay[] | null,
  incoming: TripDay[],
): TripDay[] {
  const byNumber = new Map<number, TripDay>();
  for (const day of existing ?? []) {
    if (typeof day?.dayNumber === "number" && day.dayNumber > 0) {
      byNumber.set(day.dayNumber, day);
    }
  }
  for (const day of incoming) {
    if (typeof day?.dayNumber === "number" && day.dayNumber > 0) {
      byNumber.set(day.dayNumber, day);
    }
  }
  return [...byNumber.values()].sort((a, b) => a.dayNumber - b.dayNumber);
}

function collectExplicitDiscoveries(
  data: StreamingEventData,
): AgentDiscovery[] {
  const collected: AgentDiscovery[] = [];
  if (Array.isArray(data.discoveries)) {
    for (const item of data.discoveries) {
      const normalized = normalizeAgentDiscovery(item);
      if (normalized) collected.push(normalized);
    }
  }
  if (data.discovery != null) {
    const normalized = normalizeAgentDiscovery(data.discovery);
    if (normalized) collected.push(normalized);
  }
  const direct = normalizeAgentDiscovery(data);
  if (direct) collected.push(direct);
  return collected;
}

/** Observe the durable planning job through the read-only SSE endpoint.
 * Native EventSource keeps browser delivery separate from React rendering and
 * avoids fetch byte-stream buffering in affected WebKit versions.
 */
export function useTripGeneration(
  options: UseTripGenerationOptions,
): TripGenerationState & {
  discoveries: AgentDiscovery[];
  reconnect: () => void;
} {
  const {
    tripId,
    generationId,
    enabled = true,
    completed = false,
    onComplete,
    onError,
  } = options;

  const [state, setState] = useState<TripGenerationState>(initialState);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const autoRetriesRef = useRef(0);
  const jobKey = `${tripId}:${generationId || "current"}`;
  const activeJobRef = useRef(jobKey);
  const openedJob = useRef<string | null>(null);
  const specChapters = useRef(new Map<string, StreamingSpecBlock[]>());
  const explicitDiscoveryIds = useRef(new Set<string>());
  useEffect(() => {
    autoRetriesRef.current = 0;
    if (activeJobRef.current !== jobKey) {
      activeJobRef.current = jobKey;
      specChapters.current.clear();
      explicitDiscoveryIds.current.clear();
      setState(initialState);
    }
  }, [jobKey]);
  const reconnect = useCallback(() => {
    if (completed || !enabled) return;
    setState((previous) => ({
      ...previous,
      isStreaming: true,
      phase: "connecting",
      error: null,
      message: "Reconnecting to your saved planning job…",
    }));
    setConnectionAttempt((attempt) => attempt + 1);
  }, [completed, enabled]);

  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  });

  const applyDiscoveries = useCallback(
    (
      existing: readonly AgentDiscovery[] | undefined,
      explicit: readonly AgentDiscovery[],
      synthesized: readonly AgentDiscovery[],
    ): AgentDiscovery[] => {
      for (const item of explicit) {
        explicitDiscoveryIds.current.add(item.id);
      }
      const filteredSynthesized = synthesized.filter(
        (item) => !explicitDiscoveryIds.current.has(item.id),
      );
      const withSynthetic = mergeDiscoveries(
        existing ?? [],
        filteredSynthesized,
        undefined,
        { preferExisting: true },
      );
      return mergeDiscoveries(withSynthetic, explicit);
    },
    [],
  );

  const processEvent = useCallback(
    (type: string, rawData: string) => {
      const data = parseStreamingJson(rawData);
      if (!isStreamingEventData(data)) {
        console.error(`[useTripGeneration] Failed to parse ${type} event`);
        return false;
      }

      try {
        switch (type) {
          case "progress":
          case "search_progress": {
            let phase: TripGenerationState["phase"] = "searching";
            if (data.step === "orchestrator") phase = "orchestrator";
            else if (data.step === "aggregator" || data.step === "saving")
              phase = "composing";
            else if (data.step === "complete") phase = "complete";

            const explicit = collectExplicitDiscoveries(data);
            const synthesized = extractAgentDiscoveries({
              searchProgress: data.searchProgress,
            });

            setState((prev) => ({
              ...prev,
              phase,
              progress: data.progress ?? prev.progress,
              message: data.message ?? prev.message,
              searchProgress: data.searchProgress ?? prev.searchProgress,
              discoveries: applyDiscoveries(
                prev.discoveries,
                explicit,
                synthesized,
              ),
            }));
            break;
          }

          case "discovery": {
            const explicit = collectExplicitDiscoveries(data);
            if (explicit.length === 0) return false;
            setState((prev) => ({
              ...prev,
              discoveries: applyDiscoveries(prev.discoveries, explicit, []),
            }));
            break;
          }

          case "agent_complete": {
            const agentKey = data.agent ?? data.step;
            const explicit = collectExplicitDiscoveries(data);
            const synthesized: AgentDiscovery[] = [];
            const nextTopHotel = data.topHotel ?? data.hotel ?? undefined;

            if (nextTopHotel) {
              synthesized.push(
                ...extractAgentDiscoveries({ topHotel: nextTopHotel }),
              );
            } else if (agentKey === "activities" && data.count) {
              synthesized.push(
                ...extractAgentDiscoveries({ activitiesCount: data.count }),
              );
            } else if (agentKey === "dining" && data.count) {
              synthesized.push(
                ...extractAgentDiscoveries({ diningCount: data.count }),
              );
            } else if (agentKey === "transport" && data.count) {
              synthesized.push(
                ...extractAgentDiscoveries({ transportCount: data.count }),
              );
            } else if (isDiscoveryAgent(agentKey) && data.message?.trim()) {
              synthesized.push({
                id: `${agentKey}:summary`,
                agent: agentKey,
                headline: data.message.trim(),
                ...(data.detail?.trim() ? { detail: data.detail.trim() } : {}),
                ...(data.badge?.trim() ? { badge: data.badge.trim() } : {}),
                timestamp: Date.now(),
              });
            }

            setState((prev) => ({
              ...prev,
              topHotel: nextTopHotel ?? prev.topHotel,
              activitiesCount:
                agentKey === "activities" && data.count != null
                  ? data.count
                  : prev.activitiesCount,
              diningCount:
                agentKey === "dining" && data.count != null
                  ? data.count
                  : prev.diningCount,
              transportCount:
                agentKey === "transport" && data.count != null
                  ? data.count
                  : prev.transportCount,
              searchProgress: data.searchProgress
                ? data.searchProgress
                : isDiscoveryAgent(agentKey)
                  ? { ...(prev.searchProgress ?? {}), [agentKey]: "done" }
                  : prev.searchProgress,
              discoveries: applyDiscoveries(
                prev.discoveries,
                explicit,
                synthesized,
              ),
            }));
            break;
          }

          case "hotels":
          case "top_hotel": {
            const topHotel = data.topHotel ?? data.hotel ?? null;
            const explicit = collectExplicitDiscoveries(data);
            const synthesized = extractAgentDiscoveries({ topHotel });
            setState((prev) => ({
              ...prev,
              topHotel: topHotel ?? prev.topHotel,
              discoveries: applyDiscoveries(
                prev.discoveries,
                explicit,
                synthesized,
              ),
            }));
            break;
          }

          case "activities": {
            const explicit = collectExplicitDiscoveries(data);
            const synthesized = extractAgentDiscoveries({
              activitiesCount: data.count,
            });
            setState((prev) => ({
              ...prev,
              activitiesCount: data.count ?? prev.activitiesCount,
              discoveries: applyDiscoveries(
                prev.discoveries,
                explicit,
                synthesized,
              ),
            }));
            break;
          }

          case "dining": {
            const explicit = collectExplicitDiscoveries(data);
            const synthesized = extractAgentDiscoveries({
              diningCount: data.count,
            });
            setState((prev) => ({
              ...prev,
              diningCount: data.count ?? prev.diningCount,
              discoveries: applyDiscoveries(
                prev.discoveries,
                explicit,
                synthesized,
              ),
            }));
            break;
          }

          case "transport": {
            const explicit = collectExplicitDiscoveries(data);
            const synthesized = extractAgentDiscoveries({
              transportCount: data.count,
            });
            setState((prev) => ({
              ...prev,
              transportCount: data.count ?? prev.transportCount,
              discoveries: applyDiscoveries(
                prev.discoveries,
                explicit,
                synthesized,
              ),
            }));
            break;
          }

          case "day_ready": {
            const incomingDays = Array.isArray(data.days)
              ? data.days
              : data.day
                ? [data.day]
                : [];
            if (incomingDays.length === 0) return false;
            const explicit = collectExplicitDiscoveries(data);
            setState((prev) => {
              const mergedDays = mergeProgressiveDays(prev.days, incomingDays);
              const synthesized = extractAgentDiscoveries({
                days: mergedDays,
                topHotel: data.topHotel ?? null,
              });
              return {
                ...prev,
                days: mergedDays,
                topHotel: data.topHotel ?? prev.topHotel,
                discoveries: applyDiscoveries(
                  prev.discoveries,
                  explicit,
                  synthesized,
                ),
              };
            });
            break;
          }

          case "itinerary": {
            const explicit = collectExplicitDiscoveries(data);
            const synthesized = extractAgentDiscoveries({
              days: data.days,
              topHotel: data.topHotel ?? null,
            });
            setState((prev) => ({
              ...prev,
              days: data.days ?? prev.days,
              topHotel: data.topHotel ?? prev.topHotel,
              discoveries: applyDiscoveries(
                prev.discoveries,
                explicit,
                synthesized,
              ),
            }));
            break;
          }

          case "spec-block":
            if (Array.isArray(data.blocks) && data.blocks.length > 0) {
              const blocks = data.blocks;
              // Durable reconnects replay chapters; update each chapter in place.
              const chapter =
                data.chapter || `legacy:${JSON.stringify(blocks)}`;
              specChapters.current.set(chapter, blocks);
              setState((prev) => ({
                ...prev,
                specBlocks: [...specChapters.current.values()].flat(),
              }));
            }
            break;

          case "spec-complete":
            if (Array.isArray(data.spec)) {
              const spec = data.spec;
              setState((prev) => ({
                ...prev,
                specBlocks: spec,
              }));
            }
            break;

          case "complete":
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              isComplete: true,
              phase: "complete",
              progress: 100,
              message: "Your itinerary is ready!",
              error: null,
            }));
            onCompleteRef.current?.();
            break;

          case "error": {
            const errorMessage =
              typeof data.message === "string"
                ? data.message
                : "Generation failed";
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              phase: "error",
              error: errorMessage,
            }));
            onErrorRef.current?.(errorMessage);
            break;
          }
        }
        return true;
      } catch (err) {
        console.error(
          `[useTripGeneration] Failed to parse ${type} event:`,
          err,
        );
        return false;
      }
    },
    [applyDiscoveries],
  );

  useEffect(() => {
    if (completed || !enabled || !tripId || !ITINERARY_STREAMING_ENABLED)
      return;
    const source = new EventSource(
      `/api/trips/${encodeURIComponent(tripId)}/stream`,
    );
    const job = `${tripId}:${generationId || "current"}`;
    let terminal = false;
    source.addEventListener("open", () => {
      if (terminal) return;
      autoRetriesRef.current = 0;
      const resuming = openedJob.current === job;
      if (!resuming) {
        specChapters.current.clear();
        explicitDiscoveryIds.current.clear();
      }
      openedJob.current = job;
      setState((previous) => ({
        ...(resuming ? previous : initialState),
        isStreaming: true,
        phase: "connecting",
        error: null,
        message: resuming
          ? "Live updates reconnected."
          : "Opening your travel dossier…",
      }));
    });
    const events = [
      "progress",
      "search_progress",
      "agent_complete",
      "discovery",
      "hotels",
      "top_hotel",
      "activities",
      "dining",
      "transport",
      "day_ready",
      "itinerary",
      "spec-block",
      "spec-complete",
      "complete",
    ];
    for (const type of events) {
      source.addEventListener(type, (event) => {
        if (terminal) return;
        const processed = processEvent(
          type,
          (event as MessageEvent<string>).data,
        );
        if (type === "complete" && processed) {
          terminal = true;
          source.close();
        }
      });
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    source.addEventListener("error", (event) => {
      if (terminal) return;
      terminal = true;
      const data = (event as MessageEvent<string>).data;
      if (typeof data === "string" && processEvent("error", data)) {
        source.close();
        return;
      }
      source.close();
      // Attempt up to 2 bounded automatic reconnects on transient network hiccups
      // before surfacing a paused-updates error to the traveler.
      if (autoRetriesRef.current < 2) {
        autoRetriesRef.current += 1;
        const delayMs = 1500 * autoRetriesRef.current;
        retryTimer = setTimeout(() => {
          setConnectionAttempt((attempt) => attempt + 1);
        }, delayMs);
        return;
      }
      const message = "Live updates disconnected. Checking your saved plan…";
      setState((previous) =>
        previous.isComplete
          ? previous
          : {
              ...previous,
              isStreaming: false,
              phase: "error",
              error: message,
            },
      );
      onErrorRef.current?.(message);
    });
    return () => {
      terminal = true;
      if (retryTimer) clearTimeout(retryTimer);
      source.close();
    };
  }, [
    tripId,
    generationId,
    enabled,
    completed,
    connectionAttempt,
    processEvent,
  ]);

  const view = completed
    ? reconcileInactiveGeneration(state, true)
    : !enabled || !ITINERARY_STREAMING_ENABLED
      ? reconcileInactiveGeneration(state, false)
      : state;
  return { ...view, discoveries: view.discoveries ?? [], reconnect };
}
