import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '40px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: '88px',
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.97)',
            letterSpacing: '-2px',
            lineHeight: 1,
            marginTop: '4px',
          }}
        >
          TG
        </div>
      </div>
    ),
    { ...size }
  )
}
