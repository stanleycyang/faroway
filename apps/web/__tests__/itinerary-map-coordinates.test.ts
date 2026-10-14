import { expect, test, vi } from "vitest";
import type { GeneratedItinerary } from "@/lib/ai/types";
vi.mock("leaflet", () => ({ default: {} }));
import { extractMarkers } from "../components/trips/ItineraryMap";
test("map preserves prime-meridian/equator stops and omits invalid geography", () => {
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
    "Both zero",
    "Zero longitude meal",
  ]);
});
