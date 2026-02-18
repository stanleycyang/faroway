import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export const alt = 'Trip Itinerary - TripGenie'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Destination images for OG (fallback)
const destinationImages: Record<string, string> = {
  tokyo: '🗼',
  paris: '🗼',
  bali: '🏝️',
  london: '🎡',
  'new york': '🗽',
  rome: '🏛️',
  barcelona: '⛪',
  dubai: '🏙️',
  sydney: '🌉',
  default: '✈️',
}

function getDestinationEmoji(destination: string): string {
  const lowerDest = destination.toLowerCase()
  for (const [key, emoji] of Object.entries(destinationImages)) {
    if (lowerDest.includes(key)) return emoji
  }
  return destinationImages.default
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  // Fetch trip data
  let destination = 'Your Trip'
  let dates = ''
  let travelers = 2
  let duration = ''

  try {
    const supabase = await createClient()
    const { data: trip } = await supabase
      .from('trips')
      .select('destination, start_date, end_date, travelers')
      .eq('id', id)
      .single()

    if (trip) {
      destination = trip.destination
      travelers = trip.travelers || 2
      
      if (trip.start_date && trip.end_date) {
        const start = new Date(trip.start_date)
        const end = new Date(trip.end_date)
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        duration = `${days} days`
        dates = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      }
    }
  } catch {
    // Use defaults if fetch fails
  }

  const emoji = getDestinationEmoji(destination)

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background Gradient Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 30% 70%, rgba(255,255,255,0.15) 0%, transparent 60%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '60px',
          }}
        >
          {/* Destination Emoji */}
          <div
            style={{
              fontSize: '80px',
              marginBottom: '20px',
            }}
          >
            {emoji}
          </div>

          {/* Trip Title */}
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: 'white',
              margin: '0 0 16px 0',
              textAlign: 'center',
              letterSpacing: '-1px',
            }}
          >
            {destination}
          </h1>

          {/* Trip Details */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '30px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '26px',
              marginTop: '8px',
            }}
          >
            {duration && <span>📅 {duration}</span>}
            {dates && <span>🗓️ {dates}</span>}
            <span>👥 {travelers} traveler{travelers > 1 ? 's' : ''}</span>
          </div>

          {/* Badge */}
          <div
            style={{
              marginTop: '40px',
              padding: '12px 28px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50px',
              color: 'white',
              fontSize: '20px',
              fontWeight: '600',
            }}
          >
            ✨ AI-Generated Itinerary
          </div>
        </div>

        {/* Bottom Branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '22px',
          }}
        >
          <span style={{ fontWeight: 'bold' }}>TripGenie</span>
          <span>•</span>
          <span>tripgenie.ai</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
