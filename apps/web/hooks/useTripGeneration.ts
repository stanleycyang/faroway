"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TripDay, HotelResult } from "@faroway/types";

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
  if (completed) {
    return {
      ...state,
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
  step?: string;
  progress?: number;
  message?: string;
  searchProgress?: SearchProgress;
  topHotel?: HotelResult | null;
  count?: number;
  days?: TripDay[];
  blocks?: StreamingSpecBlock[];
  spec?: StreamingSpecBlock[];
}

function isStreamingEventData(value: unknown): value is StreamingEventData {
  return value !== null && typeof value === "object";
}

/** Observe the durable planning job through the read-only SSE endpoint.
 * Native EventSource keeps browser delivery separate from React rendering and
 * avoids fetch byte-stream buffering in affected WebKit versions.
 */
export function useTripGeneration(
  options: UseTripGenerationOptions,
): TripGenerationState & { reconnect: () => void } {
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
  const openedJob = useRef<string | null>(null);
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

  const processEvent = useCallback((type: string, rawData: string) => {
    const data = parseStreamingJson(rawData);
    if (!isStreamingEventData(data)) {
      console.error(`[useTripGeneration] Failed to parse ${type} event`);
      return false;
    }

    try {
      switch (type) {
        case "progress": {
          let phase: TripGenerationState["phase"] = "searching";
          if (data.step === "orchestrator") phase = "orchestrator";
          else if (data.step === "aggregator" || data.step === "saving")
            phase = "composing";
          else if (data.step === "complete") phase = "complete";

          setState((prev) => ({
            ...prev,
            phase,
            progress: data.progress ?? prev.progress,
            message: data.message ?? prev.message,
            searchProgress: data.searchProgress ?? prev.searchProgress,
          }));
          break;
        }

        case "hotels":
          setState((prev) => ({
            ...prev,
            topHotel: data.topHotel ?? prev.topHotel,
          }));
          break;

        case "activities":
          setState((prev) => ({
            ...prev,
            activitiesCount: data.count ?? prev.activitiesCount,
          }));
          break;

        case "dining":
          setState((prev) => ({
            ...prev,
            diningCount: data.count ?? prev.diningCount,
          }));
          break;

        case "transport":
          setState((prev) => ({
            ...prev,
            transportCount: data.count ?? prev.transportCount,
          }));
          break;

        case "itinerary":
          setState((prev) => ({
            ...prev,
            days: data.days ?? prev.days,
            topHotel: data.topHotel ?? prev.topHotel,
          }));
          break;

        case "spec-block":
          if (Array.isArray(data.blocks) && data.blocks.length > 0) {
            const blocks = data.blocks;
            setState((prev) => ({
              ...prev,
              specBlocks: [...prev.specBlocks, ...blocks],
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
      console.error(`[useTripGeneration] Failed to parse ${type} event:`, err);
      return false;
    }
  }, []);

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
      const resuming = openedJob.current === job;
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
      "hotels",
      "activities",
      "dining",
      "transport",
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
    source.addEventListener("error", (event) => {
      if (terminal) return;
      terminal = true;
      const data = (event as MessageEvent<string>).data;
      if (typeof data !== "string" || !processEvent("error", data)) {
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
      }
      // Status polling handles recovery; closing prevents automatic replays of
      // partial chapters and never dispatches a new generation request.
      source.close();
    });
    return () => {
      terminal = true;
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
  return { ...view, reconnect };
}
