import { describe, expect, it } from "vitest";
import {
  parseSSEBuffer,
  parseStreamingJson,
  reconcileInactiveGeneration,
  type TripGenerationState,
} from "@/hooks/useTripGeneration";

describe("useTripGeneration stream parsing", () => {
  it("parses complete SSE events and preserves incomplete trailing data", () => {
    const { events, remaining } = parseSSEBuffer(
      'event: itinerary\ndata: {"days":[{"dayNumber":1}]}\n\n' +
        'event: progress\ndata: {"progress":75}',
    );

    expect(events).toEqual([
      {
        type: "itinerary",
        data: '{"days":[{"dayNumber":1}]}',
      },
    ]);
    expect(remaining).toBe('event: progress\ndata: {"progress":75}');
  });

  it("handles malformed partial output without throwing", () => {
    expect(parseStreamingJson('{"days":')).toBeNull();
    expect(parseStreamingJson('{"progress":75}')).toEqual({ progress: 75 });
  });

  it("clears a disconnect error when polling observes completion", () => {
    const disconnected: TripGenerationState = {
      phase: "error",
      progress: 80,
      message: "Still planning",
      searchProgress: null,
      topHotel: null,
      activitiesCount: 0,
      diningCount: 0,
      transportCount: 0,
      days: null,
      specBlocks: [],
      isStreaming: false,
      isComplete: false,
      error: "Live updates disconnected. Checking progress…",
    };

    expect(reconcileInactiveGeneration(disconnected, true)).toMatchObject({
      phase: "complete",
      progress: 100,
      isStreaming: false,
      isComplete: true,
      error: null,
    });
  });
});
