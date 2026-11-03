import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { withReviewedActivitySources } from "@/lib/search/reviewed-activity-sources";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";
import { ActivityCard } from "@/components/trips/ActivityCard";
import type { ActivityResult } from "@faroway/types";
import type { ReviewedVenueHours } from "@/lib/search/reviewed-venue-hours";
import hours from "../../../../scripts/fixtures/reviewed-venue-hours.json";

const candidate: ActivityResult = {
  id: "jewish-museum",
  name: "The Jewish Museum",
  description: "Art and culture",
  proposedVisitType: "ordinary_entry",
  category: "cultural",
  duration: 90,
  price: 0,
  currency: "",
  rating: 0,
  reviewCount: 0,
  location: {
    name: "Museum",
    address: "1109 5th Ave, New York, NY 10128",
    lat: 40.7853,
    lng: -73.9578,
  },
  images: [],
  bestTimeOfDay: "afternoon",
  vibeScore: 70,
  vibeMatch: [],
  bookingRequired: true,
};
const attach = (activity = candidate, asOf = "2026-11-03") =>
  withReviewedActivitySources(
    "New York, USA",
    [activity],
    hours as ReviewedVenueHours[],
    [],
    asOf,
  )[0];

it("preserves a reviewed activity source through saved JSON and web rendering", () => {
  const activity = attach();
  const mapped = mapSearchResultsToItinerary(
    {
      searchId: "source-test",
      hotels: [],
      activities: [activity],
      dining: [],
      transport: [],
      itinerary: [
        {
          date: "2027-01-11",
          dayNumber: 1,
          title: "Museum",
          summary: "A draft",
          tips: [],
          morning: { activities: [] },
          afternoon: { activities: [activity] },
          evening: { activities: [] },
        },
      ],
    },
    null,
  );
  const saved = JSON.parse(
    JSON.stringify(mapped.days[0].afternoon.activities[0]),
  );
  expect(saved.source).toEqual({
    url: "https://thejewishmuseum.org/visit/",
    retrievedOn: "2026-11-03",
  });
  const html = renderToStaticMarkup(
    createElement(ActivityCard, { activity: saved }),
  );
  expect(html).toContain("https://thejewishmuseum.org/visit/");
  expect(html).toContain("Confirm opening hours and");
  expect(saved.bookingInfo.bookingUrl).toBeUndefined();
});

it("does not lend attribution to another branch, scope, stale review or generated URL", () => {
  const generated = {
    ...candidate,
    source: { url: "https://unreviewed.example/", retrievedOn: "2026-11-03" },
  };
  expect(
    attach({
      ...generated,
      location: { ...candidate.location, address: "999 Fifth Ave" },
    }).source,
  ).toBeUndefined();
  expect(
    attach({ ...generated, proposedVisitType: "event" }).source,
  ).toBeUndefined();
  expect(attach(generated, "2030-01-01").source).toBeUndefined();
  expect(
    attach({ ...candidate, affiliatePartner: "vendor" }).source,
  ).toBeUndefined();
});
