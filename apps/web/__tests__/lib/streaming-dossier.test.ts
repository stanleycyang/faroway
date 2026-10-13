import { describe, expect, it } from "vitest";
import { draftChapters, streamStepState } from "@/lib/trips/streaming-dossier";
import { sampleDays } from "../../e2e/fixtures/planning-data";

describe("live travel dossier", () => {
  it("merges partial spec chapters with full itinerary days in day order", () => {
    const chapters = draftChapters(
      [sampleDays[1], sampleDays[0]],
      [
        {
          type: "ItineraryDay",
          props: { dayNumber: 1, title: "A provisional title" },
        },
        {
          type: "ActivityCard",
          props: {
            name: "A quiet walk through Saint-Germain",
            time: "morning",
          },
        },
      ],
    );
    expect(chapters.map((chapter) => chapter.number)).toEqual([1, 2]);
    expect(chapters[0].title).toBe(sampleDays[0].title);
    expect(chapters[0].stops).toHaveLength(1);
    expect(chapters[0].stops[0].pickedForYou).toBe(
      "A leisurely introduction to the neighborhood.",
    );
  });
  it("ignores malformed chapters and deduplicates overlapping stream stops", () => {
    const chapters = draftChapters(null, [
      {
        type: "ItineraryDay",
        props: { dayNumber: "invalid", title: "Ignore this" },
      },
      { type: "ActivityCard", props: { name: "An orphan stop" } },
      { type: "ItineraryDay", props: { dayNumber: 2, title: "Paris" } },
      {
        type: "DayTimeline",
        props: { items: [null, { time: "morning", title: "The gallery" }] },
      },
      { type: "ActivityCard", props: { time: "morning", name: "The gallery" } },
    ]);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].stops).toHaveLength(1);
    expect(chapters[0].stops[0].pickedForYou).toBeFalsy();
    expect(chapters[0].stops).toMatchObject([
      { name: "The gallery", period: "morning", description: "" },
    ]);
  });
  it("reports actual agent activity instead of inferring success from elapsed progress", () => {
    expect(streamStepState("hotels", "searching", null)).toBe("waiting");
    expect(
      streamStepState("activities", "complete", { activities: "searching" }),
    ).toBe("waiting");
    expect(
      streamStepState("hotels", "searching", { hotels: "searching" }),
    ).toBe("active");
    expect(streamStepState("hotels", "error", { hotels: "done" })).toBe("done");
    expect(
      streamStepState("activities", "error", { activities: "searching" }),
    ).toBe("waiting");
    expect(
      streamStepState("activities", "error", { activities: "failed" }),
    ).toBe("interrupted");
  });
});
