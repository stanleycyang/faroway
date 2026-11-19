import { describe, expect, it } from "vitest";
import {
  ItinerarySchema,
  aggregatorResponseTruncated,
  aggregatorRetryMaxOutputTokens,
  isAggregatorParseFailure,
  itineraryFromModelText,
  lowThinkingProviderOptions,
  repairAggregatorResponseText,
} from "@/lib/search/agents/aggregator-output";

function day(dayNumber: number) {
  return {
    dayNumber,
    date: `2026-06-0${dayNumber}`,
    title: `Day ${dayNumber}`,
    summary: "Walk the neighborhood",
    morning: { activityIds: ["walk"], mealId: null },
    afternoon: { activityIds: [] as string[], mealId: null },
    evening: { activityIds: [] as string[], mealId: null },
    tips: ["Confirm hours"],
  };
}

const liveParseError = "No object generated: could not parse the response.";

describe("aggregator parse recovery", () => {
  it("classifies the live cap failure as truncated unparsed output", () => {
    const error = Object.assign(new Error(liveParseError), {
      finishReason: "length",
      usage: { inputTokens: 2294, outputTokens: 8000 },
      text: '{"days":[{"dayNumber":1,"title":"Partial"',
    });
    expect(isAggregatorParseFailure(error)).toBe(true);
    expect(aggregatorResponseTruncated(error, 8000)).toBe(true);
    expect(aggregatorRetryMaxOutputTokens(8000, 4)).toBe(16000);
    expect(
      isAggregatorParseFailure(
        new Error("aggregator AI timed out after 60000ms"),
      ),
    ).toBe(false);
    expect(aggregatorResponseTruncated(new Error("socket hang up"), 8000)).toBe(
      false,
    );
  });

  it("treats output within 64 tokens of the cap as truncated", () => {
    const error = Object.assign(new Error(liveParseError), {
      usage: { outputTokens: 7967 },
      text: '{"days":[]}',
    });
    expect(aggregatorResponseTruncated(error, 8000)).toBe(true);
    const closed = Object.assign(
      new Error("No object generated: response did not match schema."),
      {
        finishReason: "stop",
        usage: { outputTokens: 1200 },
        text: '{"days":[]}',
      },
    );
    expect(aggregatorResponseTruncated(closed, 8000)).toBe(false);
  });

  it("repairs fenced, trailing-comma, and truncated JSON that still has every day", () => {
    const payload = { days: [day(1), day(2)], topHotelId: "hotel-1" };
    const raw = JSON.stringify(payload);
    const fenced = "```json\n" + raw + "\n```";
    expect(itineraryFromModelText(fenced)?.days).toHaveLength(2);
    const withComma =
      '{"days":[' + JSON.stringify(day(1)) + ',],"topHotelId":"hotel-1"}';
    expect(itineraryFromModelText(withComma)?.topHotelId).toBe("hotel-1");
    expect(itineraryFromModelText(raw.slice(0, -1))?.days).toHaveLength(2);
    expect(repairAggregatorResponseText(raw.slice(0, -1), 2)).toEqual(
      expect.any(String),
    );
    const repaired = repairAggregatorResponseText(fenced, 2);
    expect(repaired).toBeTruthy();
    expect(ItinerarySchema.safeParse(JSON.parse(repaired ?? "")).success).toBe(
      true,
    );
    expect(repairAggregatorResponseText(raw.slice(0, -1), 3)).toBeNull();
  });

  it("keeps a stringified days array and an embedded hotel id", () => {
    const days = JSON.stringify([day(1), day(2)]);
    const text = JSON.stringify({
      days: `${days},"topHotelId":"hotel-embedded"`,
      topHotelId: "hotel-root",
    });
    // Root id wins. The embedded form is the legacy recovery shape.
    expect(itineraryFromModelText(text)?.topHotelId).toBe("hotel-root");
    const embedded = JSON.stringify({
      days: `${days} "topHotelId": "hotel-embedded"`,
    });
    expect(itineraryFromModelText(embedded)?.topHotelId).toBe("hotel-embedded");
    expect(
      itineraryFromModelText(embedded)?.days[0].morning.activityIds,
    ).toEqual(["walk"]);
  });

  it("drops a truncated last day and accepts the activities schema shape", () => {
    const text =
      '{"days":[' +
      JSON.stringify(day(1)) +
      ',{"dayNumber":2,"title":"Cut","summary":"no","morning":{"activityIds":[]';
    const recovered = itineraryFromModelText(text);
    expect(recovered?.days).toHaveLength(1);
    expect(recovered?.days[0].title).toBe("Day 1");
    const structured = itineraryFromModelText(
      JSON.stringify({
        days: [
          {
            dayNumber: 1,
            date: "2026-06-01",
            title: "Slots",
            summary: "One walk",
            activities: [
              { id: "walk", slot: "morning" },
              { id: "museum", slot: "afternoon" },
            ],
            breakfastId: null,
            lunchId: "lunch-1",
            dinnerId: null,
            tips: "Bring a card",
          },
        ],
        topHotelId: "hotel-1",
      }),
    );
    expect(structured?.days[0].morning.activityIds).toEqual(["walk"]);
    expect(structured?.days[0].afternoon.mealId).toBe("lunch-1");
    expect(structured?.days[0].evening.mealId).toBeNull();
    expect(structured?.days[0].tips).toEqual(["Bring a card"]);
  });

  it("lowers thinking without dropping the gateway allowlist", () => {
    expect(
      lowThinkingProviderOptions({ gateway: { only: ["google", "vertex"] } }),
    ).toEqual({
      gateway: { only: ["google", "vertex"] },
      google: { thinkingConfig: { thinkingLevel: "low" } },
      vertex: { thinkingConfig: { thinkingLevel: "low" } },
    });
    expect(aggregatorRetryMaxOutputTokens(undefined, 4)).toBeUndefined();
    expect(aggregatorRetryMaxOutputTokens(20000, 4)).toBe(32000);
  });

  it("returns null for prose that is not an itinerary", () => {
    expect(itineraryFromModelText("Sorry, I cannot plan that.")).toBeNull();
    expect(itineraryFromModelText("")).toBeNull();
  });
});
