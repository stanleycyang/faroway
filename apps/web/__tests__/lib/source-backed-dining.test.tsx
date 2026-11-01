import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DiningResult, SuggestedDay } from "@faroway/types";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";
import { RestaurantCard } from "@/components/trips/ActivityCard";

// Reviewed branch evidence supports identity/address, not ratings, coordinates,
// a party price, January availability or stroller access. Never assign placeholders.
const candidate: DiningResult = {
  id: "reviewed-bloomhouse-ginger-garden",
  name: "The Bloomhouse by Little Farms",
  description:
    "Breakfast option in the Ginger Garden. Confirm service times, availability and stroller access before using this option.",
  cuisineTypes: [],
  priceStatus: "unknown",
  location: {
    name: "Ginger Garden, Singapore Botanic Gardens",
    address:
      "Blk 2, 1 Cluny Rd, Ginger Garden Singapore Botanic Gardens, 259569",
  },
  images: [],
  mealTypes: ["breakfast"],
  vibeScore: 0,
  vibeMatch: [],
  dietaryOptions: [],
};
function mapped(meal = candidate) {
  const day: SuggestedDay = {
    date: "2027-01-11",
    dayNumber: 1,
    title: "Breakfast review",
    summary: "Review the proposed alternative.",
    tips: [],
    morning: { activities: [], meal },
    afternoon: { activities: [] },
    evening: { activities: [] },
  };
  return mapSearchResultsToItinerary(
    {
      searchId: "fixture",
      hotels: [],
      activities: [],
      dining: [meal],
      transport: [],
      itinerary: [day],
    },
    null,
  );
}
describe("partially supported dining candidates", () => {
  it("preserves a reviewed address without inventing price, ratings or coordinates through saved mapping and web rendering", () => {
    const result = mapped(),
      meal = result.days[0].morning.meals[0];
    expect(meal.location.address).toBe(candidate.location.address);
    expect(meal.location.coordinates).toBeUndefined();
    expect(meal.priceLevel).toBeUndefined();
    expect(meal.rating).toBeUndefined();
    expect(meal.reviewCount).toBeUndefined();
    expect(meal.estimatedCost.status).toBe("unknown");
    const html = renderToStaticMarkup(
      createElement(RestaurantCard, { restaurant: meal }),
    );
    expect(html).toContain("Price unknown");
    expect(html).toContain("Confirm service times");
    expect(html).not.toContain("lucide-star");
    expect(html).not.toContain("$$");
  });
  it("removes an explicitly unknown price band while retaining supported optional values", () => {
    const unknown = mapped({ ...candidate, priceLevel: 2 }).days[0].morning
      .meals[0];
    expect(unknown.priceLevel).toBeUndefined();
    const known = mapped({
      ...candidate,
      priceStatus: "estimate",
      priceLevel: 2,
      rating: 4.5,
      reviewCount: 25,
    }).days[0].morning.meals[0];
    expect(known).toMatchObject({
      priceLevel: 2,
      rating: 4.5,
      reviewCount: 25,
    });
    // A price band does not establish an amount or party total.
    expect(known.estimatedCost.status).toBe("unknown");
  });
});
