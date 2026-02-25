import { ImageResponse } from 'next/og';
import { getGuideBySlug, getGuideSlugs } from '@/lib/destination-guides';

export const alt = 'Faroway Destination Guide';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return getGuideSlugs().map((slug) => ({ slug }));
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dest = getGuideBySlug(slug);

  const name = dest?.name || 'Destination Guide';
  const country = dest?.country || '';
  const tagline = dest?.tagline || 'Plan your perfect trip with AI';
  const continent = dest?.continent || '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '60px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}
      >
        <div style={{ display: 'flex', marginBottom: '20px' }}>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              background: 'rgba(249,115,22,0.2)',
              border: '1px solid rgba(249,115,22,0.3)',
              color: '#fb923c',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            {continent || 'Destination Guide'}
          </div>
        </div>

        <div
          style={{
            fontSize: name.length > 15 ? '64px' : '80px',
            fontWeight: 800,
            color: '#f3f4f6',
            lineHeight: 1.1,
            marginBottom: '8px',
            display: 'flex',
          }}
        >
          {name}
        </div>

        <div style={{ fontSize: '28px', color: '#9ca3af', marginBottom: '16px', display: 'flex' }}>
          {country}
        </div>

        <div
          style={{
            fontSize: '22px',
            color: '#6b7280',
            maxWidth: '700px',
            lineHeight: 1.4,
            marginBottom: '40px',
            display: 'flex',
          }}
        >
          {tagline}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f97316, #f59e0b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              fontWeight: 700,
            }}
          >
            TG
          </div>
          <div style={{ color: '#6b7280', fontSize: '20px', fontWeight: 500, display: 'flex' }}>
            faroway.ai/destinations
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
