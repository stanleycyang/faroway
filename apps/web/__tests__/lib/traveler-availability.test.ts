import { expect, it } from "vitest";
import {
  travelerAvailability,
  availableSlotMinutes,
} from "@/lib/search/traveler-availability";
it.each([
  ["Arrive on the first day at 18:00", 0, 1080, 1440],
  ["First-day arrival at 7pm", 0, 1140, 1440],
  ["Depart on the final day at 09:00", 2, 0, 540],
  ["Depart at 8am on the last day", 2, 0, 480],
  ["No starts before 10am", 1, 600, 1440],
  ["No starts before 12pm", 1, 720, 1440],
])(
  "interprets explicit local clock wording: %s",
  (text, day, earliest, latest) => {
    const result = travelerAvailability({ mobilityNeeds: String(text) }, 3);
    expect(result.windows[Number(day)]).toEqual({
      earliestMinute: earliest,
      latestMinute: latest,
    });
    expect(result.needsReview).toBe(false);
  },
);
it.each([
  "Do not arrive on the first day at 18:00",
  "Arrive on the first day at 25:00",
  "Arrival time is unknown",
  "Arrive on the first day at 9",
  "Working 09:00–17:00 each day",
])("requires review without guessing: %s", (text) => {
  const result = travelerAvailability({ mobilityNeeds: text }, 3);
  expect(result.windows.every((w) => w === undefined)).toBe(true);
  expect(result.needsReview).toBe(true);
});
it("intersects constraints without silently resolving a contradiction", () => {
  const result = travelerAvailability(
    {
      mobilityNeeds:
        "Arrive on the first day at 18:00; depart on the final day at 09:00",
    },
    1,
  );
  expect(availableSlotMinutes(result.windows[0], 2)).toBe(0);
  expect(result.windows[0]!.earliestMinute).toBeGreaterThan(
    result.windows[0]!.latestMinute,
  );
});
it("does not constrain a trip with no explicit timing request", () => {
  const result = travelerAvailability({ mobilityNeeds: "Short walks" }, 3);
  expect(result.needsReview).toBe(false);
  expect(availableSlotMinutes(result.windows[0], 0)).toBe(Infinity);
});

it("recognizes a restatement of a parsed arrival constraint regardless of clause order", () => {
  for (const text of [
    "Arrive on the first day at 18:00; no activities before arrival",
    "No activities before arrival; arrive on the first day at 18:00",
  ])
    expect(travelerAvailability({ mobilityNeeds: text }, 3).needsReview).toBe(
      false,
    );
  expect(
    travelerAvailability({ mobilityNeeds: "No activities before arrival" }, 3)
      .needsReview,
  ).toBe(true);
});
