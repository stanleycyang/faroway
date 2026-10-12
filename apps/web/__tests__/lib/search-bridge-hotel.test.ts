import { expect, it } from "vitest";
import type { HotelResult, SearchResults } from "@faroway/types";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";

it("preserves an informational hotel without inventing a price", () => {
  const hotel: HotelResult = {
    id: "hotel",
    name: "Fixture hotel",
    description: "Informational suggestion",
    dataSource: "ai",
    amenities: [],
    location: { name: "Paris", address: "", lat: 48, lng: 2 },
    images: [],
    vibeScore: 80,
    vibeMatch: [],
  };
  const results: SearchResults = {
    searchId: "search",
    hotels: [hotel],
    activities: [],
    dining: [],
    transport: [],
    itinerary: [
      {
        dayNumber: 1,
        date: "2099-01-01",
        title: "Day",
        summary: "Summary",
        hotel,
        morning: { activities: [] },
        afternoon: { activities: [] },
        evening: { activities: [] },
        estimatedCost: 0,
        currency: "USD",
        tips: [],
      },
    ],
  };
  const day = mapSearchResultsToItinerary(results, hotel).days[0];
  expect(day.hotel).toEqual(hotel);
  expect(day.hotel?.pricePerNight).toBeUndefined();
});
