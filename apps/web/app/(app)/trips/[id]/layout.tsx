import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

interface TripLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tripgenie.ai'
  
  // Default metadata
  let metadata: Metadata = {
    title: 'Trip Itinerary',
    description: 'View your AI-generated travel itinerary on TripGenie',
    openGraph: {
      title: 'Trip Itinerary | TripGenie',
      description: 'View this AI-generated travel itinerary',
      type: 'article',
      url: `${baseUrl}/trips/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Trip Itinerary | TripGenie',
      description: 'View this AI-generated travel itinerary',
    },
    robots: {
      index: false, // Don't index private trip pages by default
      follow: true,
    },
  }

  try {
    const supabase = await createClient()
    const { data: trip } = await supabase
      .from('trips')
      .select('destination, start_date, end_date, travelers')
      .eq('id', id)
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

      const title = `${duration} ${destination} Trip${duration ? '' : ' Itinerary'}`
      const description = `Explore this ${duration ? duration + ' ' : ''}AI-generated itinerary to ${destination}${dateRange ? ` (${dateRange})` : ''}. Created with TripGenie for ${travelers} traveler${travelers > 1 ? 's' : ''}.`

      metadata = {
        title,
        description,
        openGraph: {
          title: `${title} | TripGenie`,
          description,
          type: 'article',
          url: `${baseUrl}/trips/${id}`,
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} | TripGenie`,
          description,
        },
        alternates: {
          canonical: `${baseUrl}/trips/${id}`,
        },
        robots: {
          index: false, // Private content
          follow: true,
        },
      }
    }
  } catch {
    // Use default metadata if fetch fails
  }

  return metadata
}

export default function TripLayout({ children }: TripLayoutProps) {
  return <>{children}</>
}
