import { notFound } from "next/navigation";
import { SharedTripView } from "@/components/trips/SharedTripView";
import { loadSharedTrip } from "@/lib/trips/load-shared-trip";

export const revalidate = 3600;

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
    />
  );
}
