import { notFound } from 'next/navigation'
import { getSupabase } from '@/lib/supabase/server'
import { SharedTripView } from '@/components/trips/SharedTripView'

export const revalidate = 3600

interface SharedTripPageProps {
  params: Promise<{ token: string }>
}

export default async function SharedTripPage({ params }: SharedTripPageProps) {
  const { token } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    notFound()
  }

  const supabase = getSupabase()

  const { data: trip, error } = await supabase
    .from('trips')
    .select(`
      destination, start_date, end_date, travelers, traveler_type, vibes, budget_tier,
      itineraries(days, overview, total_cost, packing_list, general_tips, generated_at)
    `)
    .eq('share_token', token)
    .eq('is_shared', true)
    .single()

  if (error || !trip) {
    notFound()
  }

  const itinerary = Array.isArray(trip.itineraries)
    ? trip.itineraries[0]
    : trip.itineraries

  return (
    <SharedTripView
      destination={trip.destination}
      startDate={trip.start_date}
      endDate={trip.end_date}
      travelers={trip.travelers}
      travelerType={trip.traveler_type}
      vibes={trip.vibes}
      budgetTier={trip.budget_tier}
      itinerary={itinerary ? {
        days: itinerary.days,
        overview: itinerary.overview,
        totalEstimatedCost: itinerary.total_cost,
        packingList: itinerary.packing_list,
        generalTips: itinerary.general_tips,
        generatedAt: itinerary.generated_at,
      } : null}
      shareToken={token}
    />
  )
}
