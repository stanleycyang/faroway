import { notFound, redirect } from "next/navigation";
import { TripDetailClient } from "./TripDetailClient";
import { createClient } from "@/lib/supabase/server";
import { loadTripForUser } from "@/lib/trips/load-trip";
import { buildTripEssentials } from "@/lib/affiliates/essentials";
import { buildHotelPartnerLinks } from "@/lib/affiliates/hotels";
import { buildFlightFallbackLinks } from "@/lib/affiliates/flights";

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const [{ id }, supabase] = await Promise.all([params, createClient()]);
  if (!/^[a-zA-Z0-9-]+$/.test(id)) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=/trips/${encodeURIComponent(id)}`);
  }

  const initialData = await loadTripForUser(id, user.id);
  if (!initialData) notFound();

  const { trip, itinerary } = initialData;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";
  const initialShareUrl =
    trip.is_shared && trip.share_token
      ? `${baseUrl}/s/${trip.share_token}`
      : null;

  const essentials = trip.destination
    ? buildTripEssentials({
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        trackingId: id,
      })
    : undefined;

  const hotelPartnerLinks = trip.destination
    ? buildHotelPartnerLinks({
        destination: trip.destination,
        checkIn: trip.start_date,
        checkOut: trip.end_date,
        adults: trip.travelers,
        budgetTier: trip.budget_tier ?? undefined,
        campaign: "trip_view",
      })
    : undefined;

  const firstTransport = itinerary?.days?.find((d) => d.transport)?.transport;
  const prefsOriginAirport =
    typeof trip.preferences?.originAirport === "string"
      ? trip.preferences.originAirport
      : undefined;
  const flightFallbackLinks = trip.destination
    ? buildFlightFallbackLinks({
        originAirport: firstTransport?.departure?.airport || prefsOriginAirport,
        destinationAirport: firstTransport?.arrival?.airport,
        destinationCity: trip.destination,
        departureDate: trip.start_date,
        returnDate: trip.end_date > trip.start_date ? trip.end_date : undefined,
        adults: trip.travelers,
        trackingId: id,
      })
    : undefined;

  return (
    <TripDetailClient
      key={`${user.id}:${id}`}
      tripId={id}
      initialData={initialData}
      initialShareUrl={initialShareUrl}
      bookingChecklistEnabled={
        process.env.FAROWAY_BOOKING_CHECKLIST_ENABLED === "true"
      }
      planEditingEnabled={process.env.FAROWAY_PLAN_EDITING_ENABLED === "true"}
      essentials={essentials}
      hotelPartnerLinks={hotelPartnerLinks}
      flightFallbackLinks={flightFallbackLinks}
    />
  );
}
