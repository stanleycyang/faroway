import { expect, test, vi } from "vitest";
import type {
  ActivityResult,
  DiningResult,
  LocationInfo,
} from "@faroway/types";
import type { GeneratedItinerary } from "@/lib/ai/types";
vi.mock("leaflet", () => ({ default: {} }));
import { extractMarkers } from "../components/trips/ItineraryMap";
test("map preserves prime-meridian/equator stops but omits invalid geography and the unknown sentinel", () => {
  const stops = [
    { name: "Equator", lat: 0, lng: 32 },
    { name: "Prime meridian", lat: 51, lng: 0 },
    { name: "Both zero", lat: 0, lng: 0 },
    { name: "Outside latitude", lat: 91, lng: 20 },
    { name: "Outside longitude", lat: 20, lng: 181 },
    { name: "Not finite", lat: Infinity, lng: 10 },
  ];
  const itinerary = {
    days: [
      {
        dayNumber: 1,
        morning: {
          activities: stops.map(({ name, lat, lng }) => ({
            name,
            location: { coordinates: { lat, lng } },
          })),
        },
        afternoon: {
          meal: {
            name: "Zero longitude meal",
            location: { coordinates: { lat: 51, lng: 0 } },
          },
        },
      },
    ],
  } as unknown as GeneratedItinerary;
  expect(extractMarkers(itinerary).map((marker) => marker.name)).toEqual([
    "Equator",
    "Prime meridian",
    "Zero longitude meal",
  ]);
});

test("saved activity and restaurant locations preserve unknowns through the actual bridge", async () => {
  const { mapSearchResultsToItinerary } = await import("../lib/search/bridge");
  const common = {
    name: "Test stop",
    description: "",
    rating: 0,
    reviewCount: 0,
    images: [],
    vibeScore: 0,
    vibeMatch: [],
    location: { name: "Known name", address: "Known address", lat: 0, lng: 0 },
  };
  const activity: ActivityResult = {
    ...common,
    id: "visit",
    category: "sightseeing",
    duration: 60,
    price: 0,
    currency: "USD",
    bestTimeOfDay: "morning",
    bookingRequired: false,
  };
  const meal: DiningResult = {
    ...common,
    id: "meal",
    cuisineTypes: [],
    priceLevel: 1,
    mealTypes: ["breakfast"],
    dietaryOptions: [],
  };
  const cases = [
    { coords: { lat: 0, lng: 0 }, expected: undefined },
    { coords: { lat: 91, lng: 10 }, expected: undefined },
    { coords: { lat: 10, lng: -181 }, expected: undefined },
    { coords: { lat: NaN, lng: 10 }, expected: undefined },
    { coords: { lat: 10 }, expected: undefined },
    { coords: { lat: "10", lng: 20 }, expected: undefined },
    { coords: { lat: 0, lng: 32 }, expected: { lat: 0, lng: 32 } },
    { coords: { lat: 51, lng: 0 }, expected: { lat: 51, lng: 0 } },
  ];
  for (const { coords, expected } of cases) {
    const location = {
      name: "Known name",
      address: "Known address",
      ...coords,
    } as LocationInfo;
    const day = {
      dayNumber: 1,
      date: "2027-01-11",
      title: "Test day",
      summary: "Test mapping",
      tips: [],
      morning: {
        activities: [{ ...activity, location }],
        meal: { ...meal, location },
      },
      afternoon: { activities: [] },
      evening: { activities: [] },
    };
    const mapped = mapSearchResultsToItinerary(
      {
        searchId: "coordinates",
        hotels: [],
        activities: [],
        dining: [],
        transport: [],
        itinerary: [day],
      },
      null,
    );
    expect(mapped.days[0].morning.activities[0].location.coordinates).toEqual(
      expected,
    );
    expect(mapped.days[0].morning.meals[0].location.coordinates).toEqual(
      expected,
    );
    expect(mapped.days[0].morning.activities[0].location.address).toBe(
      "Known address",
    );
    expect(
      extractMarkers({ days: mapped.days } as GeneratedItinerary),
    ).toHaveLength(expected ? 2 : 0);
  }
});
