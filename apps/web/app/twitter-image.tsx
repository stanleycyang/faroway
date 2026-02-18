import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'TripGenie - AI-Powered Travel Planning'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          }}
        />

        {/* Content Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          {/* Logo/Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100px',
              height: '100px',
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.2)',
              marginBottom: '24px',
              fontSize: '50px',
            }}
          >
            ✨
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: 'white',
              margin: '0 0 16px 0',
              letterSpacing: '-2px',
            }}
          >
            TripGenie
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: '32px',
              color: 'rgba(255, 255, 255, 0.9)',
              margin: '0 0 40px 0',
            }}
          >
            AI Travel Planner • 60-Second Itineraries
          </p>

          {/* CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '16px 32px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50px',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
            }}
          >
            🌴 Plan Your Dream Trip Free
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
