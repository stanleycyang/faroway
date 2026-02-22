import type { Metadata } from 'next';
import { CurrencyConverterClient } from '@/components/tools/currency/CurrencyConverterClient';

export const metadata: Metadata = {
  title: 'Currency Converter — Travel Money Calculator',
  description:
    'Convert between 11 travel currencies with approximate rates. Includes destination-specific tips for handling money abroad.',
  alternates: { canonical: '/tools/currency-converter' },
  openGraph: {
    title: 'Currency Converter | TripGenie',
    description: 'Free travel currency converter with tips for 14 destinations.',
    url: '/tools/currency-converter',
  },
};

export default function CurrencyConverterPage() {
  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Travel Currency Converter',
    description: 'Convert between travel currencies with destination-specific tips for handling money abroad.',
    url: 'https://www.tripgenie.ai/tools/currency-converter',
    applicationCategory: 'TravelApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    operatingSystem: 'All',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema).replace(/</g, '\\u003c') }} />
      <CurrencyConverterClient />
    </>
  );
}
