import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  ActivityCard,
  RestaurantCard,
  type Activity,
  type Restaurant,
} from "@/components/trips/ActivityCard";
import { FeaturedHotelCard } from "@/components/trips/FeaturedHotelCard";
import { ItineraryDay } from "@/components/trips/ItineraryDay";
import { StreamedSpecPreview } from "@/components/trips/StreamedSpecPreview";

const unsafe = "https://provider.example/unchecked-booking";
const activity: Activity = {
  id: "local",
  name: "Walk",
  estimatedCost: { amount: 20, currency: "USD" },
  description: "Idea",
  duration: 60,
  category: "sightseeing",
  timeOfDay: "morning",
  location: { name: "Paris" },
  bookingInfo: {
    requiresReservation: true,
    bookingUrl: unsafe,
    affiliateId: "other",
  },
};
const restaurant: Restaurant = {
  id: "dining",
  name: "Lunch",
  estimatedCost: { amount: 20, currency: "USD", perPerson: true },
  description: "Idea",
  mealType: "lunch",
  location: { name: "Paris" },
  cuisineType: [],
  priceLevel: 2,
  dietaryOptions: [],
  reservationInfo: { recommended: true, url: unsafe },
};

describe("saved trip outbound booking boundary", () => {
  it("keeps unsupported activity, restaurant and hotel links unavailable", () => {
    const cards = [
      createElement(ActivityCard, { activity }),
      createElement(RestaurantCard, { restaurant }),
    ];
    for (const card of cards) {
      const html = renderToStaticMarkup(card);
      expect(html).toMatch(/<button[^>]*disabled=""/);
      expect(html).toContain("unavailable");
      expect(html).not.toContain(unsafe);
      expect(html).not.toContain("Confirmed instantly");
      expect(html).not.toContain("Free to cancel");
    }
    const hotelHtml = renderToStaticMarkup(
      createElement(FeaturedHotelCard, {
        nights: 2,
        hotel: { name: "Hotel", pricePerNight: 100, affiliateUrl: unsafe },
      }),
    );
    expect(hotelHtml).toContain("Hotel checkout is not available");
    expect(hotelHtml).not.toContain(unsafe);
    expect(hotelHtml).not.toMatch(/<(a|button)\b/);
    expect(hotelHtml).not.toContain("Confirmed instantly");
    expect(hotelHtml).not.toContain("Free to cancel");
  });

  it("disables itinerary hotel and flight actions even with a saved provider URL", () => {
    const html = renderToStaticMarkup(
      createElement(ItineraryDay, {
        dayNumber: 1,
        date: "2099-06-01",
        title: "Paris",
        summary: "",
        defaultExpanded: true,
        morning: { activities: [], meals: [] },
        afternoon: { activities: [], meals: [] },
        evening: { activities: [], meals: [] },
        hotel: { name: "Hotel", affiliateUrl: unsafe },
        transport: {
          type: "flight",
          provider: "Airline",
          departure: {
            airport: "LHR",
            city: "London",
            dateTime: "2099-06-01T09:00:00Z",
          },
          arrival: {
            airport: "CDG",
            city: "Paris",
            dateTime: "2099-06-01T11:00:00Z",
          },
          duration: 60,
          stops: 0,
          price: 100,
          currency: "USD",
          affiliateUrl: unsafe,
        },
      }),
    );
    expect(html).toContain("Hotel booking unavailable");
    expect(html).toContain("Flight booking unavailable");
    expect(html).not.toContain(unsafe);
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
  });

  it("renders streamed booking URLs as inert previews", () => {
    const html = renderToStaticMarkup(
      createElement(StreamedSpecPreview, {
        blocks: [
          { type: "HotelCard", props: { name: "Hotel", bookingUrl: unsafe } },
          {
            type: "BookingButton",
            props: { label: "Book instantly", url: unsafe },
          },
          { type: "ActivityCard", props: { name: "Tour", bookingUrl: unsafe } },
          {
            type: "RestaurantCard",
            props: { name: "Lunch", reservationUrl: unsafe },
          },
        ],
      }),
    );
    expect(html).not.toContain("href=");
    expect(html).not.toContain(unsafe);
    expect(html).not.toContain("Book instantly");
    expect(html).toContain("review your saved plan");
  });

  it("prevents reintroducing direct navigation or legacy click tracking in saved-trip cards", () => {
    // Architectural regression guard: all live handoffs belong to TripCheckout,
    // whose consent/revision/recovery behavior has API and browser coverage.
    for (const file of [
      "components/trips/FeaturedHotelCard.tsx",
      "components/trips/ItineraryDay.tsx",
      "components/trips/ActivityCard.tsx",
      "components/trips/StreamedSpecPreview.tsx",
      "app/(app)/trips/[id]/TripDetailClient.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(
        /window\.open|window\.location\.(assign|replace)|api\/track\/click/,
      );
      expect(source).not.toMatch(
        /href=\{[^}]*?(affiliate|booking|reservation)/i,
      );
    }
  });
});
