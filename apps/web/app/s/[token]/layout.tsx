import { Metadata } from 'next'
import { getSupabase } from '@/lib/supabase/server'

interface SharedTripLayoutProps {
  children: React.ReactNode
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tripgenie.ai'

  let metadata: Metadata = {
    title: 'Shared Trip Itinerary | TripGenie',
    description: 'View this AI-generated travel itinerary on TripGenie',
    openGraph: {
      title: 'Shared Trip Itinerary | TripGenie',
      description: 'View this AI-generated travel itinerary',
      type: 'article',
      url: `${baseUrl}/s/${token}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Shared Trip Itinerary | TripGenie',
      description: 'View this AI-generated travel itinerary',
    },
    robots: {
      index: true,
      follow: true,
    },
  }

  try {
    const supabase = getSupabase()
    const { data: trip } = await supabase
      .from('trips')
      .select('destination, start_date, end_date, travelers')
      .eq('share_token', token)
      .eq('is_shared', true)
      .single()

    if (trip) {
      const destination = trip.destination
      const startDate = trip.start_date ? new Date(trip.start_date) : null
      const endDate = trip.end_date ? new Date(trip.end_date) : null
      const travelers = trip.travelers || 2

      let duration = ''
      let dateRange = ''

      if (startDate && endDate) {
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        duration = `${days}-day`
        dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      }

      const title = `${duration} ${destination} Trip Itinerary`
      const description = `Explore this ${duration ? duration + ' ' : ''}AI-generated itinerary to ${destination}${dateRange ? ` (${dateRange})` : ''}. Created with TripGenie for ${travelers} traveler${travelers > 1 ? 's' : ''}.`

      metadata = {
        title,
        description,
        openGraph: {
          title: `${title} | TripGenie`,
          description,
          type: 'article',
          url: `${baseUrl}/s/${token}`,
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} | TripGenie`,
          description,
        },
        alternates: {
          canonical: `${baseUrl}/s/${token}`,
        },
        robots: {
          index: true,
          follow: true,
        },
        other: {
          'script:ld+json': JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TravelAction',
            name: title,
            description,
            toLocation: {
              '@type': 'Place',
              name: destination,
            },
            ...(startDate && { startTime: startDate.toISOString() }),
            ...(endDate && { endTime: endDate.toISOString() }),
          }),
        },
      }
    }
  } catch {
    // Use default metadata if fetch fails
  }

  return metadata
}

export default function SharedTripLayout({ children }: SharedTripLayoutProps) {
  return <>{children}</>
}
