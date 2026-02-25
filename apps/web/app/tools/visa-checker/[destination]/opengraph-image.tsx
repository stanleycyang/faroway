import { ImageResponse } from 'next/og';
import { getGuideBySlug, getGuideSlugs } from '@/lib/destination-guides';
import { getVisaSummary } from '@/lib/tools/visa-data';

export const alt = 'Faroway Visa Checker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return getGuideSlugs().map((slug) => ({ destination: slug }));
}

export default async function OGImage({ params }: { params: Promise<{ destination: string }> }) {
  const { destination } = await params;
  const dest = getGuideBySlug(destination);
  const visaSummary = getVisaSummary(destination);

  const name = dest?.name || 'Destination';
  const country = dest?.country || '';
  const visaFreeCount = visaSummary['visa-free'] || 0;
  const voaCount = visaSummary['visa-on-arrival'] || 0;
  const easyAccessCount = visaFreeCount + voaCount;

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
        <div
          style={{
            display: 'flex',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #f97316, #f59e0b)',
              color: 'white',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            Visa Checker
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

        <div
          style={{
            fontSize: '28px',
            color: '#9ca3af',
            marginBottom: '16px',
            display: 'flex',
          }}
        >
          {country}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              background: 'rgba(249,115,22,0.2)',
              border: '1px solid rgba(249,115,22,0.3)',
              color: '#fb923c',
              fontSize: '20px',
              fontWeight: 600,
              display: 'flex',
            }}
          >
            {`${visaFreeCount} visa-free`}
          </div>
          <div style={{ color: '#6b7280', fontSize: '22px', display: 'flex' }}>
            {`${easyAccessCount} of 15 passports with easy access`}
          </div>
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
            faroway.ai/tools/visa-checker
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
