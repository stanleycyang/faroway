"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TripDay, HotelResult } from "@faroway/types";

export interface SearchProgress {
  [key: string]: string | undefined;
  orchestrator?: string;
  hotels?: string;
  activities?: string;
  dining?: string;
  aggregator?: string;
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
  days: TripDay[] | null;

  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
}

interface UseTripGenerationOptions {
  tripId: string;
  enabled?: boolean;
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
  days: null,
  isStreaming: false,
  isComplete: false,
  error: null,
};

/**
 * React hook that connects to POST /api/trips/[id]/stream and reads SSE
 * events via fetch + ReadableStream. This replaces the old EventSource
 * approach, allowing the server to run agents directly and stream results
 * without a DB-polling intermediary.
 */
export function useTripGeneration(
  options: UseTripGenerationOptions,
): TripGenerationState {
  const { tripId, enabled = true, onComplete, onError } = options;

  const [state, setState] = useState<TripGenerationState>(initialState);

  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  });

  const processEvent = useCallback((type: string, rawData: string) => {
    try {
      const data = JSON.parse(rawData);

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

        case "itinerary":
          setState((prev) => ({
            ...prev,
            days: data.days ?? prev.days,
            topHotel: data.topHotel ?? prev.topHotel,
          }));
          break;

        case "complete":
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            isComplete: true,
            phase: "complete",
            progress: 100,
            message: "Your itinerary is ready!",
          }));
          onCompleteRef.current?.();
          break;

        case "error": {
          const errorMessage = data.message || "Generation failed";
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
    } catch (err) {
      console.error(`[useTripGeneration] Failed to parse ${type} event:`, err);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !tripId) return;

    const abortController = new AbortController();

    setState({
      ...initialState,
      isStreaming: true,
      message: "Starting trip generation...",
    });

    (async () => {
      try {
        const response = await fetch(`/api/trips/${tripId}/stream`, {
          method: "POST",
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `Stream failed (HTTP ${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            let eventType = "message";
            let eventData = "";

            for (const line of block.split("\n")) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                eventData += (eventData ? "\n" : "") + line.slice(6);
              }
            }

            if (eventType && eventData) {
              processEvent(eventType, eventData);
            }
          }
        }

        // Stream ended naturally — make sure we're in a terminal state
        setState((prev) => {
          if (prev.isComplete || prev.phase === "error") return prev;
          return { ...prev, isStreaming: false };
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        const msg = (error as Error).message || "Connection failed";
        console.error("[useTripGeneration] Stream error:", msg);

        setState((prev) => {
          if (prev.isComplete) return prev;
          return {
            ...prev,
            isStreaming: false,
            phase: "error",
            error: msg,
          };
        });
        onErrorRef.current?.(msg);
      }
    })();

    return () => abortController.abort();
  }, [tripId, enabled, processEvent]);

  return state;
}
