import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ItineraryDay } from "@/components/trips/ItineraryDay";

test.each([-1, Infinity, 2.5])(
  "legacy rating %s and unsupported currency keep the saved day readable",
  (starRating) => {
    const empty = { activities: [], meals: [] };
    const html = renderToStaticMarkup(
      <ItineraryDay
        dayNumber={1}
        date="2026-02-30"
        title="Arrival"
        summary="Your saved arrival"
        morning={empty}
        afternoon={empty}
        evening={empty}
        hotel={{ name: "Saved hotel", starRating }}
        totalEstimatedCost={{ amount: 137, currency: "?" }}
      />,
    );
    expect(html).toContain("Your saved arrival");
    expect(html).toContain("Date unavailable");
    expect(html).toContain("Price unknown");
    expect(html).not.toContain("★");
    expect(html).not.toContain("Invalid Date");
  },
);

test.each([
  "not-an-array",
  [{ note: "broken" }, "Keep your museum reservation", null],
])("malformed saved tips leave the day readable: %j", (tips) => {
  const empty = { activities: [], meals: [] };
  const html = renderToStaticMarkup(
    <ItineraryDay
      dayNumber={1}
      date="2026-11-01"
      title="Arrival"
      summary="Your saved arrival"
      morning={empty}
      afternoon={empty}
      evening={empty}
      tips={tips as unknown as string[]}
    />,
  );
  expect(html).toContain("Your saved arrival");
  expect(html).not.toContain("broken");
  if (Array.isArray(tips))
    expect(html).toContain("Keep your museum reservation");
  else expect(html).not.toContain("Before you go");
});
