import { notFound } from "next/navigation";
import { SharedTripView } from "@/components/trips/SharedTripView";
import { loadSharedTrip } from "@/lib/trips/load-shared-trip";
import { buildTripEssentials } from "@/lib/affiliates/essentials";
import { buildHotelPartnerLinks } from "@/lib/affiliates/hotels";
import { buildFlightFallbackLinks } from "@/lib/affiliates/flights";

// Share revocation must take effect on the next request; do not serve a stale
// public itinerary after its owner disables the link.
export const dynamic = "force-dynamic";

interface SharedTripPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedTripPage({ params }: SharedTripPageProps) {
  const { token } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

  const trip = await loadSharedTrip(token);
  if (!trip) notFound();

  const itinerary = Array.isArray(trip.itineraries)
    ? trip.itineraries[0]
    : trip.itineraries;

  const prefs = trip.preferences || {};

  const essentials = buildTripEssentials({
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    trackingId: "shared_trip",
  });

  const hotelPartnerLinks = buildHotelPartnerLinks({
    destination: trip.destination,
    checkIn: trip.start_date,
    checkOut: trip.end_date,
    adults: trip.travelers,
    budgetTier: trip.budget_tier ?? undefined,
    campaign: "shared_trip",
  });

  const firstTransport = itinerary?.days?.find((d) => d.transport)?.transport;
  const flightFallbackLinks = buildFlightFallbackLinks({
    originAirport: firstTransport?.departure?.airport,
    destinationAirport: firstTransport?.arrival?.airport,
    destinationCity: trip.destination,
    departureDate: trip.start_date,
    returnDate: trip.end_date > trip.start_date ? trip.end_date : undefined,
    adults: trip.travelers,
    trackingId: "shared_trip",
  });

  return (
    <SharedTripView
      destination={trip.destination}
      startDate={trip.start_date}
      endDate={trip.end_date}
      travelers={trip.travelers}
      travelerType={prefs.travelerType as string | undefined}
      vibes={trip.vibes ?? undefined}
      budgetTier={trip.budget_tier ?? undefined}
      itinerary={
        itinerary
          ? {
              days: itinerary.days,
              overview: itinerary.overview ?? "",
              totalEstimatedCost: itinerary.total_cost ?? undefined,
              packingList: itinerary.packing_list ?? undefined,
              generalTips: itinerary.general_tips ?? undefined,
              generatedAt: itinerary.generated_at ?? "",
            }
          : null
      }
      shareToken={token}
      shareUrl={`${baseUrl}/s/${token}`}
      essentials={essentials}
      hotelPartnerLinks={hotelPartnerLinks}
      flightFallbackLinks={flightFallbackLinks}
    />
  );
}
