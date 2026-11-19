import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { proposedVisitNote, readProposedVisitType } from "@faroway/types";
import { ActivityCard, type Activity } from "@/components/trips/ActivityCard";

const activity: Activity = {
  id: "visit",
  name: "Museum visit",
  description: "Explore the collection.",
  duration: 60,
  estimatedCost: { amount: 0, currency: "", status: "unknown" },
  timeOfDay: "morning",
  category: "cultural",
  location: { name: "Museum" },
  bookingInfo: { requiresReservation: true },
};
it.each([
  "ordinary_entry",
  "exterior_walk",
  "guided_tour",
  "event",
  "unknown",
] as const)(
  "displays proposed visit intent %s without booking urgency",
  (proposedVisitType) => {
    const saved = { ...activity, proposedVisitType };
    const html = renderToStaticMarkup(
      createElement(ActivityCard, { activity: saved }),
    );
    expect(html).toContain(proposedVisitNote(proposedVisitType));
    expect(html).not.toContain("secure your spot");
    expect(html).not.toContain("Check reservation requirements");
  },
);
it.each([undefined, null, "confirmed", "constructor", "__proto__", {}])(
  "does not infer or display intent from malformed/legacy value %s",
  (value) => {
    expect(readProposedVisitType(value)).toBeUndefined();
    expect(proposedVisitNote(value)).toBeUndefined();
  },
);
it("uses a confirmation request instead of urgency for a legacy reservation flag", () => {
  const html = renderToStaticMarkup(createElement(ActivityCard, { activity }));
  expect(html).toContain("Check reservation requirements with the venue.");
  expect(html).not.toContain("secure your spot");
});
