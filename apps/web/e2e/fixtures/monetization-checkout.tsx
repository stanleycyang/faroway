import React from "react";
import { createRoot } from "react-dom/client";
import type { TripDay } from "@faroway/types";
import { TripCheckout } from "../../components/trips/TripCheckout";
import { ViatorContentPolicy } from "../../components/trips/ViatorContentPolicy";
import {
  ActivityCard,
  RestaurantCard,
  type Activity,
  type Restaurant,
} from "../../components/trips/ActivityCard";
import {
  FeaturedHotelCard,
  type FeaturedHotel,
} from "../../components/trips/FeaturedHotelCard";
import { FlightLeg } from "../../components/trips/FlightLeg";
import { BookingChecklist } from "../../components/trips/BookingChecklist";

const viatorActivity: Activity & { viatorContentVersion: number } = {
  id: "activity_v_123P1",
  name: "Louvre Museum Guided Tour",
  description: "Skip-the-line guided walk through the Denon and Sully wings.",
  duration: 150,
  estimatedCost: { amount: 65, status: "estimate", currency: "USD" },
  timeOfDay: "morning",
  category: "cultural",
  location: { name: "Musée du Louvre", address: "Rue de Rivoli, 75001 Paris" },
  bookingInfo: {
    requiresReservation: true,
    affiliateId: "viator",
    bookingUrl:
      "https://www.viator.com/tours/Paris/Walk/d479-123P1?pid=P12345678&mcid=42383&medium=api",
  },
  rating: 4.8,
  reviewCount: 342,
  viatorContentVersion: 1,
};

const nonViatorActivity: Activity = {
  id: "act_gyg_456",
  name: "Seine Evening Cruise",
  description: "One-hour panoramic river cruise past illuminated landmarks.",
  duration: 60,
  estimatedCost: { amount: 22, status: "estimate", currency: "EUR" },
  timeOfDay: "evening",
  category: "sightseeing",
  location: { name: "Port de la Bourdonnais" },
  bookingInfo: {
    requiresReservation: true,
    affiliateId: "getyourguide",
    bookingUrl:
      "https://www.getyourguide.com/paris-l16/seine-cruise-t456/?partner_id=TEST",
  },
  rating: 4.5,
  reviewCount: 180,
};

const featuredRestaurant: Restaurant = {
  id: "rest_le_petit_cler",
  name: "Le Petit Cler",
  cuisineType: ["French", "Bistro"],
  priceLevel: 2,
  description: "Neighborhood Parisian bistro near Rue Cler.",
  estimatedCost: {
    amount: 38,
    status: "estimate",
    currency: "USD",
    perPerson: true,
  },
  mealType: "dinner",
  location: { name: "Rue Cler", address: "29 Rue Cler, 75007 Paris" },
  dietaryOptions: ["Vegetarian options"],
  reservationInfo: {
    recommended: true,
    url: "https://www.opentable.com/r/le-petit-cler-paris",
  },
  rating: 4.6,
  reviewCount: 215,
};

const featuredHotel: FeaturedHotel = {
  id: "hotel_saint_germain",
  name: "Hotel Recamier Saint-Germain",
  affiliateUrl:
    "https://www.stay22.com/allez/roam?aid=faroway&address=Paris&checkin=2099-06-01&checkout=2099-06-04",
  affiliatePartner: "stay22",
  pricePerNight: 240,
  currency: "USD",
  priceStatus: "estimate",
  starRating: 4,
  userRating: 4.7,
  reviewCount: 412,
  description: "Quiet boutique stay steps from Place Saint-Sulpice.",
  amenities: ["Free Wi-Fi", "Breakfast available", "Air conditioning"],
};

const currentFlight: NonNullable<TripDay["transport"]> = {
  type: "flight",
  provider: "Air France",
  affiliatePartner: "duffel",
  price: 780,
  currency: "USD",
  duration: 645,
  stops: 0,
  expiresAt: "2099-06-01T10:00:00Z",
  affiliateUrl: "https://book.duffel.com/flights/SFO-CDG",
  departure: {
    airport: "SFO",
    city: "San Francisco",
    dateTime: "2099-06-01T14:30:00Z",
  },
  arrival: {
    airport: "CDG",
    city: "Paris",
    dateTime: "2099-06-02T10:15:00Z",
  },
};

const expiredFlight: NonNullable<TripDay["transport"]> = {
  type: "flight",
  provider: "United Airlines",
  affiliatePartner: "duffel",
  price: 690,
  currency: "USD",
  duration: 720,
  stops: 1,
  expiresAt: "2020-01-01T00:00:00Z",
  affiliateUrl: "https://book.duffel.com/flights/CDG-SFO",
  departure: {
    airport: "CDG",
    city: "Paris",
    dateTime: "2099-06-04T12:00:00Z",
  },
  arrival: {
    airport: "SFO",
    city: "San Francisco",
    dateTime: "2099-06-04T15:00:00Z",
  },
};

function MonetizationCheckoutFixture() {
  const tripId = "00000000-0000-4000-8000-000000000001";
  const userId = "00000000-0000-4000-8000-000000000001";

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 bg-[#FAF8F3] px-4 py-8">
      <ViatorContentPolicy enabled={true}>
        <TripCheckout tripId={tripId} travelers={2}>
          <section
            aria-label="Activity cards"
            className="grid gap-4 sm:grid-cols-2"
          >
            <ActivityCard activity={viatorActivity} date="2099-06-01" />
            <ActivityCard activity={nonViatorActivity} date="2099-06-01" />
          </section>
        </TripCheckout>
      </ViatorContentPolicy>

      <FeaturedHotelCard
        hotel={featuredHotel}
        stayEstimate={{ amount: 720, currency: "USD", nights: 3 }}
      />

      <section aria-label="Dining options" className="space-y-4">
        <RestaurantCard restaurant={featuredRestaurant} />
      </section>

      <section
        aria-label="Flight options"
        className="grid gap-4 rounded-2xl bg-slate-900 p-5 sm:grid-cols-2"
      >
        <FlightLeg transport={currentFlight} label="Outbound" />
        <FlightLeg transport={expiredFlight} label="Return" />
      </section>

      <BookingChecklist tripId={tripId} userId={userId} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <MonetizationCheckoutFixture />,
);
