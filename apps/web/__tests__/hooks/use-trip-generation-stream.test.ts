import { describe, expect, it } from "vitest";
import { parseSSEBuffer, parseStreamingJson } from "@/hooks/useTripGeneration";

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
});
